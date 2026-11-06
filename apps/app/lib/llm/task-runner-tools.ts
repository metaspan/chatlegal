/**
 * The G-02 tool surfaces, both sides of the handoff.
 *
 * The TaskRunner side is a deliberately tiny stub set — echo, timed_noop,
 * count_words — so the handoff is real and testable without a tool bus:
 * the model calls, the host executes, the result rides back as a tool
 * message, exactly the way G-01's askChoice call executes host-side in
 * lib/llm/concierge-agent.ts. Everything here is G-03-replaceable: the
 * full tool bus with permissions lands in G-03 and swaps this file out.
 * Nothing touches the filesystem, the network, or another person's data.
 *
 * The Concierge side is ONE model-facing function, hand_off_to_task_runner:
 * the model hands over a brief and gets a plain-language summary back, the
 * way the WID-1 frontend tools in dcolley/tourbillon@7a8595b
 * packages/mastra/src/tools/widget-tools.ts let a model call a widget and
 * the host render it. Like askChoice, the model's arguments are NOT
 * trusted: the host re-reads every call and refuses what it cannot run.
 */

import type { ChatToolCall, ChatToolDefinition } from './client'

/** Marker: these tools exist to prove the handoff. G-03 replaces them. */
export const TASK_TOOLS_REPLACED_IN = 'G-03'

/** The stub tools the TaskRunner may call this slice. */
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

/**
 * The three starter tools, in the ChatToolDefinition shape the G-00 client
 * already sends (client.ts, G-01 function calling). Descriptions keep the
 * promise honest: these prove the loop; they are not the real tool bus.
 */
export function taskRunnerToolDefinitions(): ChatToolDefinition[] {
  return [
    {
      name: 'echo',
      description: 'Repeat a short piece of text back. Useful to confirm what you are working with.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['message'],
        properties: {
          message: { type: 'string', minLength: 1, maxLength: ECHO_MAX_CHARS },
        },
      },
    },
    {
      name: 'timed_noop',
      description: 'Pause for a short moment. Real background waits come later; this one is capped.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: {
          ms: { type: 'integer', minimum: 0, maximum: NOOP_MAX_MS, description: 'How long to pause, in milliseconds.' },
        },
      },
    },
    {
      name: 'count_words',
      description: 'Count the words in a piece of text. Safe: it only counts, it stores nothing.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: {
          text: { type: 'string', minLength: 1, maxLength: COUNT_MAX_CHARS },
        },
      },
    },
  ]
}

/** The seams the stubs need, injectable so tests never really sleep. */
export type TaskToolRunDeps = {
  sleep: (ms: number) => Promise<void>
}

/**
 * Execute one stub tool call host-side and return the tool message content.
 * A call the host cannot run is a JSON error the model can read, never a
 * throw: one bad call must not sink the job. Arguments are untrusted: they
 * are re-read with hard caps here, whatever the model was told.
 */
export async function runTaskRunnerTool(
  name: string,
  argsJson: string,
  deps: TaskToolRunDeps,
): Promise<string> {
  if (!isTaskStubTool(name)) {
    return JSON.stringify({ tool: name.slice(0, 64), error: 'unknown_tool', note: `This starter set has only ${TASK_STUB_TOOL_NAMES.join(', ')}. ${TASK_TOOLS_REPLACED_IN} brings the real tools.` })
  }
  let args: Record<string, unknown>
  try {
    const parsed = JSON.parse(argsJson || '{}') as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return JSON.stringify({ tool: name, error: 'not_an_object' })
    }
    args = parsed as Record<string, unknown>
  } catch {
    return JSON.stringify({ tool: name, error: 'not_json' })
  }
  if (name === 'echo') {
    const message = typeof args.message === 'string' ? args.message.trim().slice(0, ECHO_MAX_CHARS) : ''
    if (!message) return JSON.stringify({ tool: name, error: 'message_required' })
    return JSON.stringify({ tool: name, echoed: message })
  }
  if (name === 'timed_noop') {
    const raw = typeof args.ms === 'number' && Number.isFinite(args.ms) ? Math.floor(args.ms) : 0
    const ms = Math.max(0, Math.min(NOOP_MAX_MS, raw))
    await deps.sleep(ms)
    return JSON.stringify({ tool: name, waited_ms: ms })
  }
  // count_words: pure computation over the text the model supplied. It is
  // the one "safe local helper" of the slice: no I/O, no storage, no keys.
  const text = typeof args.text === 'string' ? args.text.slice(0, COUNT_MAX_CHARS) : ''
  if (!text.trim()) return JSON.stringify({ tool: name, error: 'text_required' })
  const words = text.trim().split(/\s+/).length
  return JSON.stringify({ tool: name, words, characters: text.length })
}

/**
 * The Concierge's hand-off function. The model never runs anything itself:
 * it describes the job, the host queues it (lib/task-runner/queue.ts), and
 * the summary comes back as the tool result for the Concierge to narrate.
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
