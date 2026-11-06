/**
 * G-03: the tool bus.
 *
 * Registry (register/list/get, duplicate refusal), typed schemas (Zod
 * refuses BEFORE execute), per-tool timeouts, and the hard rule: every
 * failure mode — unknown tool, bad JSON, invalid args, a throw inside the
 * tool, a tool that never answers — comes back as a structured JSON tool
 * result. The bus never throws at the worker loop.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  createToolRegistry,
  defineTool,
  executeToolCall,
  serializeToolInputSchema,
  type ToolRegistry,
} from './tool-bus.ts'

const ctx = { sleep: async (_ms: number) => {} }

function registryWith(...tools: ReturnType<typeof defineTool>[]): ToolRegistry {
  const registry = createToolRegistry()
  for (const tool of tools) registry.register(tool)
  return registry
}

const addTool = defineTool({
  name: 'add',
  description: 'Add two numbers.',
  timeoutMs: 1_000,
  inputSchema: z.strictObject({
    a: z.number(),
    b: z.number(),
  }),
  execute: ({ a, b }) => ({ sum: a + b }),
})

describe('tool registry', () => {
  it('registers, lists in order, and gets by name', () => {
    const registry = registryWith(addTool)
    assert.deepEqual(
      registry.list().map((tool) => tool.name),
      ['add'],
    )
    assert.equal(registry.get('add')?.description, 'Add two numbers.')
    assert.equal(registry.get('missing'), undefined)
  })

  it('refuses duplicates, blank names, and non-positive timeouts at boot', () => {
    assert.throws(() => registryWith(addTool, addTool), /duplicate tool add/)
    assert.throws(
      () => registryWith(defineTool({
        name: '  ',
        description: 'x',
        timeoutMs: 100,
        inputSchema: z.strictObject({}),
        execute: () => ({}),
      })),
      /needs a name/,
    )
    assert.throws(
      () => registryWith(defineTool({
        name: 'never',
        description: 'x',
        timeoutMs: 0,
        inputSchema: z.strictObject({}),
        execute: () => ({}),
      })),
      /positive timeoutMs/,
    )
  })

  it('definitions are ChatToolDefinition shape with plain JSON Schema parameters', () => {
    const [definition] = registryWith(addTool).definitions()
    assert.equal(definition?.name, 'add')
    assert.equal(definition?.description, 'Add two numbers.')
    assert.equal(definition?.parameters.type, 'object')
    assert.equal(definition?.parameters.additionalProperties, false)
    assert.deepEqual(definition?.parameters.required, ['a', 'b'])
    // Plain data: structuredClone survives it (the Tourbillon clone rule).
    assert.deepEqual(structuredClone(definition).parameters, definition?.parameters)
  })

  it('serializeToolInputSchema handles Zod and plain schemas, never throws', () => {
    assert.equal(serializeToolInputSchema(z.strictObject({ x: z.string() }))?.type, 'object')
    assert.deepEqual(serializeToolInputSchema({ type: 'object' }), { type: 'object' })
    assert.equal(serializeToolInputSchema(null), null)
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    assert.equal(serializeToolInputSchema(cyclic), null)
  })
})

describe('executeToolCall: typed validation before execute', () => {
  it('runs a valid call and folds the payload into the tool result', async () => {
    const result = await executeToolCall(registryWith(addTool), 'add', '{"a":2,"b":3}', ctx)
    assert.deepEqual(JSON.parse(result), { tool: 'add', sum: 5 })
  })

  it('an unknown name is unknown_tool with the registry listed', async () => {
    const result = await executeToolCall(registryWith(addTool), 'rm_rf', '{}', ctx)
    const parsed = JSON.parse(result) as { error: string; note: string }
    assert.equal(parsed.error, 'unknown_tool')
    assert.match(parsed.note, /add/)
  })

  it('bad argument JSON answers not_json / not_an_object', async () => {
    assert.match(await executeToolCall(registryWith(addTool), 'add', 'not json', ctx), /"error":"not_json"/)
    assert.match(await executeToolCall(registryWith(addTool), 'add', '[1,2]', ctx), /"error":"not_an_object"/)
    assert.match(await executeToolCall(registryWith(addTool), 'add', 'null', ctx), /"error":"not_an_object"/)
  })

  it('the schema refuses before execute: wrong types and extra keys never reach the tool', async () => {
    let executed = 0
    const watched = defineTool({
      name: 'watched',
      description: 'x',
      timeoutMs: 1_000,
      inputSchema: z.strictObject({ n: z.number() }),
      execute: () => {
        executed += 1
        return { ok: true }
      },
    })
    const registry = registryWith(watched)
    assert.match(await executeToolCall(registry, 'watched', '{"n":"x"}', ctx), /"error":"invalid_args"/)
    assert.match(await executeToolCall(registry, 'watched', '{}', ctx), /"error":"invalid_args"/)
    assert.match(await executeToolCall(registry, 'watched', '{"n":1,"extra":2}', ctx), /"error":"invalid_args"/)
    const issues = JSON.parse(await executeToolCall(registry, 'watched', '{"n":"x"}', ctx)) as { issues: string[] }
    assert.match(issues.issues.join(','), /\(n\)/)
    assert.equal(executed, 0)
  })
})

describe('executeToolCall: timeouts and throws are results, never crashes', () => {
  it('a tool that ignores its deadline answers tool_timeout at the per-tool clock', async () => {
    const slow = defineTool({
      name: 'slow',
      description: 'x',
      timeoutMs: 20,
      inputSchema: z.strictObject({}),
      execute: async (_input, slowCtx) => {
        // A real timer: this tool genuinely ignores its deadline. (ctx.sleep
        // is the injectable seam — faking it would let the tool "finish".)
        await new Promise((resolve) => setTimeout(resolve, 5_000))
        void slowCtx
        return { never: true }
      },
    })
    const startedAt = Date.now()
    const result = await executeToolCall(registryWith(slow), 'slow', '{}', ctx)
    const parsed = JSON.parse(result) as { error: string; timeout_ms: number }
    assert.equal(parsed.error, 'tool_timeout')
    assert.equal(parsed.timeout_ms, 20)
    // The worker loop waited the deadline, not the sleep.
    assert.ok(Date.now() - startedAt < 1_000, 'the bus must not outlive the tool deadline')
  })

  it('a throwing tool answers tool_failed without leaking its message', async () => {
    const boom = defineTool({
      name: 'boom',
      description: 'x',
      timeoutMs: 1_000,
      inputSchema: z.strictObject({}),
      execute: () => {
        throw new Error('secret internals must not reach the model')
      },
    })
    const syncBoom = defineTool({
      name: 'syncboom',
      description: 'x',
      timeoutMs: 1_000,
      inputSchema: z.strictObject({}),
      execute: () => {
        // A sync throw: same contract, still never escapes the bus.
        JSON.parse('this is not json')
        return {}
      },
    })
    const registry = registryWith(boom, syncBoom)
    const result = await executeToolCall(registry, 'boom', '{}', ctx)
    assert.match(result, /"error":"tool_failed"/)
    assert.doesNotMatch(result, /secret internals/)
    assert.match(await executeToolCall(registry, 'syncboom', '{}', ctx), /"error":"tool_failed"/)
  })

  it('executeToolCall itself never throws, whatever the caller passes', async () => {
    const empty = createToolRegistry()
    assert.match(await executeToolCall(empty, 'anything', '', ctx), /"error":"unknown_tool"/)
    // A tool whose execute returns something unserialisable is tool_failed.
    const cyclic = defineTool({
      name: 'cyclic',
      description: 'x',
      timeoutMs: 1_000,
      inputSchema: z.strictObject({}),
      execute: () => {
        const value: Record<string, unknown> = {}
        value.self = value
        return value
      },
    })
    assert.match(await executeToolCall(registryWith(cyclic), 'cyclic', '{}', ctx), /"error":"tool_failed"/)
  })
})
