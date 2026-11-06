/**
 * The G-02 tool surfaces, both sides of the handoff. G-03 moved the
 * TaskRunner side onto the real tool bus (lib/task-runner/tool-bus.ts):
 * the stubs are now bus registrations with typed (Zod) input schemas and a
 * per-tool timeout, executed through the bus's never-throw path. The public
 * contract below is unchanged — same names, same JSON results, same
 * readable-error codes — so the G-02 tests migrate untouched.
 *
 * The TaskRunner side keeps the G-02 promise: the model calls, the host
 * executes, the result rides back as a tool message, exactly the way G-01's
 * askChoice call executes host-side in lib/llm/concierge-agent.ts. A bus
 * refusal, timeout, or crash inside a tool is a JSON error the model can
 * read (and the runner folds into its <task-result> path), never a throw:
 * one bad call must not sink the job, let alone the process.
 *
 * The Concierge side is ONE model-facing function, hand_off_to_task_runner:
 * the model hands over a brief and gets a plain-language summary back, the
 * way the WID-1 frontend tools in dcolley/tourbillon@7a8595b
 * packages/mastra/src/tools/widget-tools.ts let a model call a widget and
 * the host render it. Like askChoice, the model's arguments are NOT
 * trusted: the host re-reads every call and refuses what it cannot run.
 */

import { z } from 'zod'
import type { ChatToolCall, ChatToolDefinition } from './client'
import {
  createToolRegistry,
  defineTool,
  executeToolCall,
  type ToolRegistry,
  type ToolRunContext,
} from '../task-runner/tool-bus'

/** Marker kept from G-02: the stub surface was replaced by the bus in G-03. */
export const TASK_TOOLS_REPLACED_IN = 'G-03'

/** The three starter tools, now registered on the bus (same names OK). */
export const TASK_STUB_TOOL_NAMES = ['echo', 'timed_noop', 'count_words'] as const
export type TaskStubToolName = (typeof TASK_STUB_TOOL_NAMES)[number]

export function isTaskStubTool(name: string): name is TaskStubToolName {
  return (TASK_STUB_TOOL_NAMES as readonly string[]).includes(name)
}

/** The one tool the Concierge may call for background work (G-02). */
export const HANDOFF_NAME = 'hand_off_to_task_runner'

const ECHO_MAX_CHARS = 500
const NOOP_MAX_MS = 2_000
const COUNT_MAX_CHARS = 4_000
const BRIEF_MAX_CHARS = 2_000
const TITLE_MAX_CHARS = 120

/** Per-tool wall clocks (the bus enforces them; caps below are the tools' own). */
const ECHO_TIMEOUT_MS = 1_000
const NOOP_TIMEOUT_MS = 5_000
const COUNT_TIMEOUT_MS = 1_000

/**
 * The three starter tools as bus registrations. Descriptions keep the
 * promise honest: these prove the loop; they are the bus's seed content.
 * Arguments are untrusted: the schema validates before execute, and every
 * cap is re-applied there whatever the model was told.
 */
const echoTool = defineTool({
  name: 'echo',
  description: 'Repeat a short piece of text back. Useful to confirm what you are working with.',
  timeoutMs: ECHO_TIMEOUT_MS,
  inputSchema: z.strictObject({
    message: z.string().min(1).max(ECHO_MAX_CHARS),
  }),
  execute: ({ message }) => {
    const trimmed = message.trim().slice(0, ECHO_MAX_CHARS)
    if (!trimmed) return { tool: 'echo', error: 'message_required' }
    return { tool: 'echo', echoed: trimmed }
  },
})

const timedNoopTool = defineTool({
  name: 'timed_noop',
  description: 'Pause for a short moment. Real background waits come later; this one is capped.',
  timeoutMs: NOOP_TIMEOUT_MS,
  inputSchema: z.strictObject({
    // The cap is enforced by the clamp in execute (the G-02 contract: a
    // huge pause is clamped, not refused), so the schema only types it.
    ms: z.number().finite().nonnegative().optional(),
  }),
  execute: async ({ ms }, ctx: ToolRunContext) => {
    // Same contract as G-02: a missing pause is 0, anything huge is
    // clamped, and the wait goes through the injected sleep (tests never
    // really sleep).
    const raw = typeof ms === 'number' && Number.isFinite(ms) ? Math.floor(ms) : 0
    const waited = Math.max(0, Math.min(NOOP_MAX_MS, raw))
    await ctx.sleep(waited)
    return { tool: 'timed_noop', waited_ms: waited }
  },
})

const countWordsTool = defineTool({
  name: 'count_words',
  description: 'Count the words in a piece of text. Safe: it only counts, it stores nothing.',
  timeoutMs: COUNT_TIMEOUT_MS,
  inputSchema: z.strictObject({
    text: z.string().min(1).max(COUNT_MAX_CHARS),
  }),
  execute: ({ text }) => {
    // Pure computation over the text the model supplied: no I/O, no
    // storage, no keys — the one "safe local helper" of the slice.
    const clipped = text.slice(0, COUNT_MAX_CHARS)
    if (!clipped.trim()) return { tool: 'count_words', error: 'text_required' }
    const words = clipped.trim().split(/\s+/).length
    return { tool: 'count_words', words, characters: clipped.length }
  },
})

/** Build the TaskRunner's bus: a fresh registry with the starter set on it. */
export function createTaskToolRegistry(): ToolRegistry {
  const registry = createToolRegistry()
  registry.register(echoTool)
  registry.register(timedNoopTool)
  registry.register(countWordsTool)
  return registry
}

let defaultRegistry: ToolRegistry | null = null

function getDefaultRegistry(): ToolRegistry {
  if (!defaultRegistry) defaultRegistry = createTaskToolRegistry()
  return defaultRegistry
}

/**
 * The three starter tools, in the ChatToolDefinition shape the G-00 client
 * already sends (client.ts, G-01 function calling). G-03: the parameters
 * are the tools' Zod schemas serialized to plain JSON Schema by the bus
 * (serializeToolInputSchema, adapted from the pack's tool-schema-serialize).
 */
export function taskRunnerToolDefinitions(): ChatToolDefinition[] {
  return getDefaultRegistry().definitions()
}

/** The seams the stubs need, injectable so tests never really sleep. */
export type TaskToolRunDeps = {
  sleep: (ms: number) => Promise<void>
}

/**
 * Execute one worker tool call through the bus and return the tool message
 * content. Always a JSON string, never a throw: unknown_tool / not_json /
 * not_an_object / invalid_args / tool_timeout / tool_failed are what the
 * model reads, and the runner folds them toward the deliverable.
 */
export async function runTaskRunnerTool(
  name: string,
  argsJson: string,
  deps: TaskToolRunDeps,
): Promise<string> {
  return executeToolCall(getDefaultRegistry(), name, argsJson, { sleep: deps.sleep })
}

/**
 * The Concierge's hand-off function. The model never runs anything itself:
 * it describes the job, the host queues it (lib/task-runner/durable-queue.ts),
 * and the summary comes back as the tool result for the Concierge to narrate.
 */
export function handoffToolDefinition(): ChatToolDefinition {
  return {
    name: HANDOFF_NAME,
    description: [
      'Hand a piece of background work to the ChatLegal background assistant and get a plain-language summary back.',
      'Use it when the answer needs real effort rather than one short reply: going through what the person has told',
      'you, laying out the steps of a process, checking the dates against each other. Write the brief so it stands on',
      'its own: it must make sense without the chat. One job per call. Never put a password, card number, or any',
      'secret in a brief, and never name another person. You will speak the outcome yourself in your next line;',
      'do not promise a result before the tool answers. Do not mention this tool, a task id, or JSON in your words.',
    ].join(' '),
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['brief'],
      properties: {
        brief: {
          type: 'string',
          minLength: 1,
          maxLength: BRIEF_MAX_CHARS,
          description: 'What to work out, self-contained, plain words. No secrets, no other people named.',
        },
        title: {
          type: 'string',
          maxLength: TITLE_MAX_CHARS,
          description: 'A few words naming the job, e.g. "Deposit protection steps".',
        },
      },
    },
  }
}

export type HandoffCallRead =
  | { ok: true; brief: string; title?: string }
  | { ok: false; issues: string[] }

/**
 * Read one hand_off_to_task_runner call with the host gate. A brief that is
 * missing, blank, or over the cap fails here and nothing is queued.
 */
export function readHandoffCallArgs(call: ChatToolCall): HandoffCallRead {
  let parsed: unknown
  try {
    parsed = JSON.parse(call.arguments || '{}') as unknown
  } catch {
    return { ok: false, issues: ['(arguments): not_json'] }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, issues: ['(arguments): not_an_object'] }
  }
  const record = parsed as Record<string, unknown>
  const issues: string[] = []
  const rawBrief = typeof record.brief === 'string' ? record.brief.trim() : ''
  if (!rawBrief) issues.push('(brief): required')
  else if (rawBrief.length > BRIEF_MAX_CHARS) issues.push(`(brief): too_long_${BRIEF_MAX_CHARS}`)
  let title: string | undefined
  if (record.title !== undefined) {
    if (typeof record.title !== 'string') issues.push('(title): not_a_string')
    else {
      const trimmed = record.title.trim()
      if (trimmed.length > TITLE_MAX_CHARS) issues.push(`(title): too_long_${TITLE_MAX_CHARS}`)
      else if (trimmed) title = trimmed
    }
  }
  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, brief: rawBrief, ...(title ? { title } : {}) }
}
