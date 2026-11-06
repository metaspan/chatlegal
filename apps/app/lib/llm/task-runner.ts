/**
 * The G-02 TaskRunner agent loop (server-only).
 *
 * One job in, one plain-language summary out. The loop is the G-01
 * Concierge loop (lib/llm/concierge-agent.ts) turned away from the person:
 * same streamed turns on the same G-00 wire (lib/llm/client.ts), the same
 * host-executes-the-tool rule, but nothing streams to a chat — the model
 * works with the G-02 stub tools and its final words become the summary
 * the Concierge narrates. The model id is CHATLEGAL_TASKRUNNER_MODEL on
 * the SAME LiteLLM env gate as the Concierge (lib/llm/config.ts): off
 * means no TaskRunner call exists, exactly the G-01 behaviour.
 *
 * The budget knobs follow dcolley/tourbillon@7a8595b
 * packages/scheduler/src/task-runner.ts: resolveMaxConcurrentRuns' parse
 * rules (unset/garbage → default, an explicit 0 is a VALID kill switch)
 * and one bounded runner, never an unlimited parallel stack.
 *
 * The queue (lib/task-runner/queue.ts) owns when a job runs; this module
 * owns how one attempt runs. getSharedTaskRunnerQueue() is the single
 * in-process queue the routes hand to the Concierge.
 */

import { getTaskRunnerModel, litellmConfig, type LiteLLMConfig } from './config'
import { streamChatTurn, toolResultMessage, type ChatMessage, type ChatToolCall } from './client'
import { runTaskRunnerTool, taskRunnerToolDefinitions } from './task-runner-tools'
import { TASK_RUNNER_SYSTEM_PROMPT } from './task-runner-prompt'
import {
  createTaskRunnerQueue,
  RUN_TASK_CAP,
  TASK_FAILED_NOTE,
  type TaskRunnerQueue,
  type TaskRunnerQueueDeps,
  type TaskRunOutcome,
} from '../task-runner/queue'

/** Model calls per job: work, tool round-trips, and the summary. */
export const TASK_RUNNER_MAX_STEPS = 4
/** Summaries are short; this keeps a rambling worker off the Concierge's desk. */
export const TASK_SUMMARY_MAX_TOKENS = 1_024
export const TASK_SUMMARY_MAX_CHARS = 1_200

export const TASK_RUNNER_DEFAULT_MAX_CONCURRENT = RUN_TASK_CAP
export const DEFAULT_HANDOFF_WAIT_MS = 8_000
export const MAX_HANDOFF_WAIT_MS = 30_000
export const DEFAULT_JOB_TIMEOUT_MS = 60_000
const MIN_JOB_TIMEOUT_MS = 1_000
const PER_CALL_TIMEOUT_MS = 30_000

/**
 * CHATLEGAL_TASKRUNNER_MAX_CONCURRENT: unset/blank/garbage → default 2;
 * an explicit 0 is the global kill switch (jobs queue, nothing runs) —
 * resolveMaxConcurrentRuns' rules from the TaskRunner pack, same edge.
 */
export function resolveTaskRunnerMaxConcurrent(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return TASK_RUNNER_DEFAULT_MAX_CONCURRENT
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return TASK_RUNNER_DEFAULT_MAX_CONCURRENT
  return Math.trunc(parsed)
}

function resolveBoundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

/**
 * How long a hand_off_to_task_runner call may hold the Concierge's turn
 * open waiting for a quick job (0 → always report 'accepted' and narrate
 * the outcome next turn). CHATLEGAL_TASKRUNNER_HANDOFF_WAIT_MS.
 */
export function handoffWaitMs(env: NodeJS.ProcessEnv = process.env): number {
  return resolveBoundedInt(env.CHATLEGAL_TASKRUNNER_HANDOFF_WAIT_MS, DEFAULT_HANDOFF_WAIT_MS, 0, MAX_HANDOFF_WAIT_MS)
}

/** Whole-job wall clock: a stuck worker is cut, retried, then parked. */
export function taskRunnerJobTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  return resolveBoundedInt(env.CHATLEGAL_TASKRUNNER_JOB_TIMEOUT_MS, DEFAULT_JOB_TIMEOUT_MS, MIN_JOB_TIMEOUT_MS, 120_000)
}

/** True when the TaskRunner exists for this environment: same key gate as G-00/G-01. */
export function isTaskRunnerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getTaskRunnerModel(env) !== null
}

/** The user message the worker starts from: the brief, with a title line. */
export function taskRunnerBriefMessage(title: string, brief: string): ChatMessage {
  const name = title.trim()
  return { role: 'user', content: name ? `Job: ${name}\n\n${brief.trim()}` : brief.trim() }
}

function clampSummary(text: string): string {
  const trimmed = text.trim()
  return trimmed.length > TASK_SUMMARY_MAX_CHARS ? `${trimmed.slice(0, TASK_SUMMARY_MAX_CHARS - 1)}…` : trimmed
}

/**
 * Run one attempt of one job. Returns done with the model's final plain
 * words, or failed with the generic note. A router failure is thrown from
 * the client as LiteLLMUnavailableError; the caller (the queue dep below)
 * turns it into a settle. Nothing here touches the chat: the only outward
 * thing is the returned summary.
 */
export async function runTaskRunnerJob(input: {
  config: LiteLLMConfig
  model: string
  title: string
  brief: string
  /** Conversation key for router stickiness: the matter id. */
  sessionId?: string
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}): Promise<TaskRunOutcome> {
  const env = input.env ?? process.env
  const fetchImpl = input.fetchImpl ?? globalThis.fetch
  const sleep =
    input.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const now = input.now ?? (() => Date.now())
  const jobTimeoutMs = taskRunnerJobTimeoutMs(env)
  const startedAt = now()
  const messages: ChatMessage[] = [
    { role: 'system', content: TASK_RUNNER_SYSTEM_PROMPT },
    taskRunnerBriefMessage(input.title, input.brief),
  ]
  let lastText = ''

  for (let step = 0; step < TASK_RUNNER_MAX_STEPS; step += 1) {
    if (now() - startedAt > jobTimeoutMs) break
    let reply = ''
    let toolCalls: ChatToolCall[] = []
    for await (const event of streamChatTurn(
      input.config,
      {
        model: input.model,
        messages,
        tools: taskRunnerToolDefinitions(),
        maxTokens: TASK_SUMMARY_MAX_TOKENS,
        timeoutMs: Math.min(PER_CALL_TIMEOUT_MS, jobTimeoutMs),
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      },
      fetchImpl,
    )) {
      if (event.type === 'content') {
        if (event.text) reply += event.text
      } else {
        toolCalls = event.calls
      }
    }
    const text = reply.trim()
    if (toolCalls.length === 0) {
      if (text) return { status: 'done', summary: clampSummary(text) }
      if (step === 0) {
        // The aliases can return an empty completion: nudge once, like the
        // MIN_VISIBLE_TOKENS floor, but on the words rather than the cap.
        messages.push({ role: 'user', content: 'Now answer with the plain-language summary of the job.' })
        continue
      }
      break
    }
    // Host-side tool execution. The transcripts stay in `messages` (model
    // context only): the person never sees them — the no-dump rule of the
    // TaskRunner pack, same as G-01 keeping card internals server-side.
    messages.push({ role: 'assistant', content: reply, toolCalls })
    for (const call of toolCalls) {
      const result = await runTaskRunnerTool(call.name, call.arguments, { sleep })
      messages.push(toolResultMessage(call.id, result))
    }
    if (text) lastText = text
  }

  if (lastText) return { status: 'done', summary: clampSummary(lastText) }
  return { status: 'failed', summary: TASK_FAILED_NOTE }
}

/**
 * The queue dep that turns a job into a real run: reads the gate at run
 * time (an env that turned off between handoff and run fails quietly) and
 * never rethrows — the queue's settle path owns the outcome.
 */
export function taskRunnerQueueDeps(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl?: typeof fetch,
): TaskRunnerQueueDeps {
  return {
    runJob: async (job) => {
      const config = litellmConfig(env)
      const model = getTaskRunnerModel(env)
      if (!config || !model) {
        console.error('task runner ran with the proxy off', { taskId: job.id })
        return { status: 'failed', summary: TASK_FAILED_NOTE }
      }
      try {
        return await runTaskRunnerJob({
          config,
          model,
          title: job.title,
          brief: job.brief,
          env,
          ...(fetchImpl ? { fetchImpl } : {}),
        })
      } catch (error) {
        // The client already logged the status without the key; one quiet
        // line here, the generic note for the person (no-dump rule).
        console.error('task runner job failed', { taskId: job.id, error: String(error) })
        return { status: 'failed', summary: TASK_FAILED_NOTE }
      }
    },
  }
}

let sharedQueue: TaskRunnerQueue | null = null

/**
 * The queue the routes hand to the Concierge: one per server process,
 * built once from the live env (kill switch included). In-memory only —
 * the durable queue is part of the G-03 tool bus.
 */
export function getSharedTaskRunnerQueue(env: NodeJS.ProcessEnv = process.env): TaskRunnerQueue {
  if (!sharedQueue) {
    sharedQueue = createTaskRunnerQueue(taskRunnerQueueDeps(env), {
      maxConcurrent: resolveTaskRunnerMaxConcurrent(env.CHATLEGAL_TASKRUNNER_MAX_CONCURRENT),
    })
  }
  return sharedQueue
}

/** Tests only: drop the process-wide queue. */
export function resetSharedTaskRunnerQueueForTests(): void {
  sharedQueue = null
}
