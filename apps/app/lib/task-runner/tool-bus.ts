/**
 * The G-03 tool bus (server-only).
 *
 * The TaskRunner's tools move from the G-02 hand-written stub switch onto a
 * real bus: a registry (register/list/get), typed input schemas validated
 * BEFORE execute, a per-tool timeout, and structured failure — every
 * refusal, timeout, and crash inside a tool comes back as a JSON tool
 * result the worker loop folds into its transcript, never as a throw. One
 * bad tool call must never sink the job, let alone the process.
 *
 * Reuse sources (named in the PR body):
 * - dcolley/tourbillon@7a8595b packages/mastra/src/tools/tool-schema-serialize.ts
 *   — serializeToolInputSchema below is adapted from it: a Zod v4 schema is
 *   turned into a plain, structuredClone-safe JSON Schema before it goes on
 *   the wire (a raw schema carries bound functions and dies on clone).
 * - dcolley/tourbillon@7a8595b packages/mastra/src/tools/ — the registry/
 *   definition pattern the tool modules follow (name + description +
 *   inputSchema, host executes).
 * - hitly-net/hitly@94b2e92 packages/core/src/destination-check.ts — the
 *   per-call timeout that returns a STRUCTURED failure ('timeout', never a
 *   crash to the caller), cleared in finally: withToolTimeout below is the
 *   same connect/total-timeout discipline trimmed to one deadline.
 * - the G-02 stubs (lib/llm/task-runner-tools.ts) — the host-executes-the-
 *   tool rule and the readable-error contract survive here unchanged.
 *
 * Permissions / protocol packs stay out of scope (G-04+): the bus answers
 * WHAT runs and HOW it fails, not WHO may ask.
 */

import { z } from 'zod'
import type { ChatToolDefinition } from '../llm/client'

/** The seams a tool may use. Injectable so tests never really sleep. */
export type ToolRunContext = {
  sleep: (ms: number) => Promise<void>
}

/** What a tool returns: a plain record folded into the tool-result JSON. */
export type ToolPayload = Record<string, unknown>

/** A tool as authored: the input schema types the execute callback. */
export type TaskTool<TInput> = {
  name: string
  description: string
  /** Wall clock for ONE execute. On expiry the call becomes tool_timeout. */
  timeoutMs: number
  inputSchema: z.ZodType<TInput>
  execute: (input: TInput, ctx: ToolRunContext) => ToolPayload | Promise<ToolPayload>
}

/** The registry's erased view of a tool (schema/output types hidden). */
export type AnyTaskTool = {
  name: string
  description: string
  timeoutMs: number
  inputSchema: z.ZodType<unknown>
  execute: (input: unknown, ctx: ToolRunContext) => ToolPayload | Promise<ToolPayload>
}

/** Author a tool: the only place the input type is known, then erased. */
export function defineTool<TInput>(tool: TaskTool<TInput>): AnyTaskTool {
  return tool as unknown as AnyTaskTool
}

export type ToolRegistry = {
  /** Register (or replace nothing and refuse): duplicate names throw at boot. */
  register: (tool: AnyTaskTool) => void
  list: () => readonly AnyTaskTool[]
  get: (name: string) => AnyTaskTool | undefined
  /** The model-facing definitions, in registration order. */
  definitions: () => ChatToolDefinition[]
}

export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, AnyTaskTool>()
  return {
    register(tool) {
      const name = tool.name.trim()
      if (!name) throw new Error('tool bus: a tool needs a name')
      if (tool.timeoutMs <= 0 || !Number.isFinite(tool.timeoutMs)) {
        throw new Error(`tool bus: ${name} needs a positive timeoutMs`)
      }
      if (tools.has(name)) throw new Error(`tool bus: duplicate tool ${name}`)
      tools.set(name, tool)
    },
    list() {
      return [...tools.values()]
    },
    get(name) {
      return tools.get(name)
    },
    definitions() {
      return [...tools.values()].map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: serializeToolInputSchema(tool.inputSchema) ?? {},
      }))
    },
  }
}

/**
 * Adapted from dcolley/tourbillon@7a8595b
 * packages/mastra/src/tools/tool-schema-serialize.ts: turn a tool's
 * inputSchema into a plain, structuredClone-safe JSON Schema. A raw Zod v4
 * schema carries bound functions and throws on clone, so it never goes on
 * the wire as it is.
 */
export function serializeToolInputSchema(schema: unknown): Record<string, unknown> | null {
  if (!schema || typeof schema !== 'object') return null

  // Zod v4 (z.strictObject/z.object — createTool and MCP tools convert to Zod)
  if ('_zod' in schema) {
    try {
      return z.toJSONSchema(schema as z.ZodType, { io: 'input', unrepresentable: 'any' }) as Record<
        string,
        unknown
      >
    } catch {
      // fall through to the plain-data path
    }
  }

  // Plain JSON Schema passed through as authored
  try {
    // Drops functions/symbols; throws on cycles/BigInt.
    const plain = JSON.parse(JSON.stringify(schema)) as unknown
    return plain && typeof plain === 'object' ? (plain as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Marker for the race below: the deadline fired, the tool did not answer. */
class ToolTimeout extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`tool timed out after ${timeoutMs}ms`)
    this.name = 'ToolTimeout'
  }
}

/**
 * HITLy destination-check.ts shape (connect/total timeout returning
 * failure('timeout', ...) instead of crashing the caller): run the tool
 * against its deadline, structured failure on expiry, timer always cleared.
 * A tool that ignores its abort keeps running to completion in the
 * background — the runner never waits for it and never sees it throw.
 */
async function withToolTimeout(
  run: () => ToolPayload | Promise<ToolPayload>,
  timeoutMs: number,
): Promise<ToolPayload> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new ToolTimeout(timeoutMs)), timeoutMs)
  })
  try {
    return await Promise.race([
      // A sync throw inside execute rejects the racer, not the process.
      Promise.resolve().then(run),
      deadline,
    ])
  } finally {
    clearTimeout(timer)
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Execute one tool call through the bus and return the tool-message
 * CONTENT: always a JSON string, never a throw. The codes are what the
 * worker's transcript (and, for a job that cannot recover, the eventual
 * <task-result>) carries:
 * - unknown_tool: the name is not on the registry;
 * - not_json / not_an_object: the arguments are not a JSON object;
 * - invalid_args: the Zod schema refused before execute — the tool body
 *   never runs on input it was not typed for;
 * - tool_timeout: the per-tool deadline expired;
 * - tool_failed: execute threw — the message stays server-side (no-dump).
 */
export async function executeToolCall(
  registry: ToolRegistry,
  name: string,
  argsJson: string,
  ctx: ToolRunContext,
): Promise<string> {
  const label = name.slice(0, 64)
  try {
    const tool = registry.get(name)
    if (!tool) {
      return JSON.stringify({
        tool: label,
        error: 'unknown_tool',
        note: `The tool bus has: ${registry.list().map((entry) => entry.name).join(', ') || '(nothing registered)'}.`,
      })
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(argsJson || '{}') as unknown
    } catch {
      return JSON.stringify({ tool: label, error: 'not_json' })
    }
    if (!isPlainObject(parsed)) {
      return JSON.stringify({ tool: label, error: 'not_an_object' })
    }
    const validated = tool.inputSchema.safeParse(parsed)
    if (!validated.success) {
      return JSON.stringify({
        tool: label,
        error: 'invalid_args',
        issues: validated.error.issues.map(
          (issue) => `(${issue.path.length > 0 ? issue.path.join('.') : 'root'}): ${issue.code}`,
        ),
      })
    }
    const payload = await withToolTimeout(() => tool.execute(validated.data, ctx), tool.timeoutMs)
    return JSON.stringify({ tool: label, ...payload })
  } catch (error) {
    // Timeout is expected; everything else is the tool's own bug. The
    // person never hears the message — the runner's no-dump rule holds.
    if (error instanceof ToolTimeout) {
      return JSON.stringify({ tool: label, error: 'tool_timeout', timeout_ms: error.timeoutMs })
    }
    return JSON.stringify({ tool: label, error: 'tool_failed' })
  }
}
