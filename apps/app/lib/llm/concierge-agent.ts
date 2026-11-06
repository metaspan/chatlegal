/**
 * The G-01 Concierge agent loop.
 *
 * This is the path the messages route takes when LiteLLM is on. It turns
 * the G-00 streamed reply into a Concierge that owns the UI turn:
 *
 * - it speaks in the G-00 voice (the policy-locked prompt, plus the short
 *   agent contract in concierge-prompt.ts);
 * - it may call ONE tool, the C-04 askChoice card. A valid call is stored
 *   through the same store helper the C-04 route uses (appendAskChoice), so
 *   the card lands on the thread in exactly the shape the AskChoiceCard,
 *   the answer route, and the reload path already understand;
 * - the run then suspends, the way the WID-1 frontend tools suspend in
 *   dcolley/tourbillon@7a8595b packages/mastra/src/tools/widget-tools.ts.
 *   The answer route resumes it: the stored tool result
 *   `{ widget, version, answer }` rides the thread history back to the
 *   model on the next turn (see agentConversationMessages);
 * - tool internals never reach the person: only the model's own words and
 *   the card are stored and shown. Arguments, option ids, and JSON stay on
 *   the server, the way redact-tool-output.ts keeps payloads out of sight
 *   in that pack, and the way the centre pane shows a tool as one quiet
 *   line (message-list.tsx).
 *
 * A model that cannot use the tool is a model that behaves like G-00:
 * text in, streamed text out. A router failure is one error event and a
 * quiet console line, never a hard failure (the safe-fallback style of
 * apps/web/lib/chat/concierge-model.ts in that pack).
 *
 * Server-only: this reads the LiteLLM configuration and the matter store.
 */

import { defaultModelClass } from '../model-class'
import { ASK_CHOICE_NAME, askChoiceToolArgs } from '../matters/ask-choice'
import { askChoiceToolDefinition, awaitingAnswerToolResult, readAskChoiceCallArgs } from './concierge-tools'
import { CONCIERGE_AGENT_PROMPT } from './concierge-prompt'
import { CONCIERGE_REPLY_FAILED } from './concierge-reply'
import { getTaskRunnerModel, litellmConfig, resolveOutboundModelId } from './config'
import {
  streamChatTurn,
  toolResultMessage,
  type ChatMessage,
  type ChatToolCall,
} from './client'
import { appendAskChoice, appendMatterMessage, getMatterThread, type MatterStore } from '../matters/store'
import type { MatterMessage, MatterAskChoice } from '../matters/types'
import type { MatterStreamEvent } from '../matters/chat-stream'
import { CONCIERGE_TASKRUNNER_PROMPT, taskResultsContext, type TaskResultContext } from './task-runner-prompt'
import { HANDOFF_NAME, handoffToolDefinition, readHandoffCallArgs } from './task-runner-tools'
import { handoffWaitMs } from './task-runner'
import { TASK_FAILED_NOTE, type TaskRunnerJob, type TaskRunnerQueue } from '../task-runner/queue'

/** How many earlier turns the model may see. Oldest are dropped first. */
const HISTORY_MESSAGES = 12
/** Rough cap on the words sent to the router, so a long thread stays inside the window. */
const HISTORY_CHARS = 12_000
/** The Concierge answers are short. This keeps a rambling model off the screen. */
const REPLY_MAX_TOKENS = 1_024
/**
 * Model calls per turn. One answer, plus room for one refused-card retry:
 * the host never stores a card the C-04 gate would reject.
 */
export const CONCIERGE_MAX_AGENT_STEPS = 3

/**
 * The messages sent to the router: the agent system prompt, then the recent
 * thread replayed, oldest first. An askChoice card replays as the assistant
 * call the Concierge made, and its answer follows as the tool result the
 * person gave (the stored `{ widget, version, answer }`), so the model sees
 * its own question and the pick, exactly as memory replays widget tool
 * calls in dcolley/tourbillon@7a8595b. A card still waiting replays with an
 * awaiting_answer result: it states the state without inventing a pick.
 *
 * G-02 adds the optional options block: the TaskRunner prompt and the
 * finished background results ride on the system message as tagged XML
 * context (task-runner-prompt.ts, adapted from concierge-signal.ts — a
 * signal, never a fake user message). No options means the exact G-01
 * request, byte for byte.
 */
export type AgentConversationOptions = {
  systemPrompt?: string
  taskResults?: readonly TaskResultContext[]
}

export function agentConversationMessages(
  history: readonly MatterMessage[],
  userText?: string,
  options?: AgentConversationOptions,
): ChatMessage[] {
  const turns: ChatMessage[] = []
  let chars = 0
  for (let index = history.length - 1; index >= 0 && turns.length < HISTORY_MESSAGES; index -= 1) {
    const message = history[index]
    const content = message.text.trim()
    const widget = message.role === 'assistant' ? message.widget : undefined
    if (!content && !widget) continue
    if (turns.length > 0 && chars + content.length > HISTORY_CHARS) break
    chars += content.length
    if (widget) {
      turns.unshift(...replayAskChoice(widget, content))
      continue
    }
    turns.unshift({ role: message.role === 'assistant' ? 'assistant' : 'user', content })
  }
  const last = turns[turns.length - 1]
  const text = userText?.trim()
  if (text && (!last || last.role !== 'user' || last.content !== text)) {
    turns.push({ role: 'user', content: text })
  }
  const basePrompt = options?.systemPrompt ?? CONCIERGE_AGENT_PROMPT
  const taskBlock = options?.taskResults ? taskResultsContext(options.taskResults) : ''
  return [{ role: 'system', content: taskBlock ? `${basePrompt}\n\n${taskBlock}` : basePrompt }, ...turns]
}

/** The assistant tool call and its tool result, in wire order. */
function replayAskChoice(widget: MatterAskChoice, accompanyingText: string): ChatMessage[] {
  const multiSelect = widget.multiSelect === true
  const call: ChatToolCall = {
    id: widget.toolCallId,
    name: ASK_CHOICE_NAME,
    arguments: JSON.stringify(
      askChoiceToolArgs(
        {
          question: widget.question,
          ...(widget.detail ? { detail: widget.detail } : {}),
          options: widget.options,
          ...(widget.recommended ? { recommended: widget.recommended } : {}),
          ...(widget.defaultOption ? { defaultOption: widget.defaultOption } : {}),
          ...(multiSelect ? { multiSelect: true } : {}),
          ...(multiSelect && widget.minSelected !== undefined ? { minSelected: widget.minSelected } : {}),
          ...(multiSelect && widget.maxSelected !== undefined ? { maxSelected: widget.maxSelected } : {}),
        },
        widget.version,
      ),
    ),
  }
  const answered = widget.status === 'answered' && widget.answer
  return [
    { role: 'assistant', content: accompanyingText, toolCalls: [call] },
    toolResultMessage(
      widget.toolCallId,
      answered
        ? JSON.stringify({ widget: ASK_CHOICE_NAME, version: widget.version, answer: widget.answer })
        : awaitingAnswerToolResult(),
    ),
  ]
}

/**
 * Runs the Concierge turn for one send (userText just stored) or one card
 * answer (no userText: the thread already ends on the tool result). Yields
 * the stream events; stores every message it shows. Off means no events at
 * all: no model call, exactly the G-00 gate.
 *
 * G-02 (taskRunner present AND the TaskRunner alias gated on): the
 * Concierge is also offered hand_off_to_task_runner. A valid call enqueues
 * the brief on the background queue and awaits it briefly (handoffWaitMs):
 * a quick job answers in the same turn as a plain summary the Concierge
 * then narrates; a slower one answers 'accepted' and the finished result
 * rides a later turn as tagged task-result context. Half-shown copy before
 * a handoff is reset, the refused-card way — the citizen sees only the
 * Concierge's own words. An invalid brief is refused with nothing stored,
 * exactly like an invalid card. Off, or no queue: one tool (askChoice),
 * one prompt, and one behaviour — the G-01 path unchanged.
 */
export async function* streamConciergeTurn(input: {
  store: MatterStore
  userId: string
  matterId: string
  userText?: string
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  /** The G-02 background queue (getSharedTaskRunnerQueue at the routes). */
  taskRunner?: { queue: TaskRunnerQueue }
}): AsyncGenerator<MatterStreamEvent> {
  const env = input.env ?? process.env
  const config = litellmConfig(env)
  if (!config) return
  const model = resolveOutboundModelId(defaultModelClass.modelId, env) ?? config.conciergeModel
  const thread = await getMatterThread(input.store, input.userId, input.matterId)
  if (!thread) return
  const queue = input.taskRunner?.queue
  const taskRunnerOn = queue !== undefined && getTaskRunnerModel(env) !== null
  // Finished background work nobody has reported yet rides this turn's
  // system message as a tagged block (concierge-signal.ts style). Taking it
  // marks it delivered, so it is narrated at most once. The G-03 queue is
  // database-backed, so the pickup is async: a queue hiccup degrades to no
  // block (the next turn tries again), never to a failed turn.
  let taskResults: TaskResultContext[] = []
  if (taskRunnerOn && queue) {
    try {
      taskResults = (await queue.collectDeliverable(input.userId, input.matterId)).map((job) => ({
        id: job.id,
        title: job.title,
        status: job.status === 'done' ? ('done' as const) : ('failed' as const),
        summary: job.summary ?? TASK_FAILED_NOTE,
      }))
    } catch (error) {
      console.error('concierge deliverable pickup failed', String(error))
    }
  }
  const messages = agentConversationMessages(thread.messages, input.userText, {
    ...(taskRunnerOn ? { systemPrompt: CONCIERGE_TASKRUNNER_PROMPT } : {}),
    taskResults,
  })
  const fetchImpl = input.fetchImpl ?? globalThis.fetch
  const tools = taskRunnerOn ? [askChoiceToolDefinition(), handoffToolDefinition()] : [askChoiceToolDefinition()]

  for (let step = 0; step < CONCIERGE_MAX_AGENT_STEPS; step += 1) {
    let reply = ''
    let toolCalls: ChatToolCall[] = []
    try {
      for await (const event of streamChatTurn(
        config,
        {
          model,
          messages,
          tools,
          maxTokens: REPLY_MAX_TOKENS,
          sessionId: input.matterId,
        },
        fetchImpl,
      )) {
        if (event.type === 'content') {
          if (!event.text) continue
          reply += event.text
          yield { type: 'delta', text: event.text }
        } else {
          toolCalls = event.calls
        }
      }
    } catch (error) {
      // The router failure is logged without the key (see client.ts). The
      // person keeps their message; a later send works as before G-01.
      console.error('concierge turn could not be completed', error)
      yield { type: 'error', message: CONCIERGE_REPLY_FAILED }
      return
    }

    const handoffCall = taskRunnerOn ? toolCalls.find((call) => call.name === HANDOFF_NAME) : undefined
    const askCall = toolCalls.find((call) => call.name === ASK_CHOICE_NAME)
    const text = reply.trim()

    if (handoffCall && queue) {
      // The handoff itself is silent: anything streamed before the call was
      // a half-formed promise, so it is dropped (the reset event clears the
      // pane) and the Concierge speaks once, after the result is in hand.
      if (text) yield { type: 'reset' }
      const read = readHandoffCallArgs(handoffCall)
      if (!read.ok) {
        // Refused like an invalid card: nothing queued, nothing stored, one
        // chance to fix the brief or answer in plain words.
        console.error('concierge handoff call refused', read.issues.join(','))
        messages.push({ role: 'assistant', content: reply, toolCalls: [handoffCall] })
        messages.push(
          toolResultMessage(
            handoffCall.id,
            JSON.stringify({
              tool: HANDOFF_NAME,
              error: 'invalid_props',
              issues: read.issues,
              instruction: 'The job was not started. Ask in plain words, or hand off again with a clear brief.',
            }),
          ),
        )
        continue
      }
      // The G-03 queue persists before it pumps: a store that cannot be
      // reached refuses the handoff cleanly (the person keeps their chat),
      // the same refusal shape as an invalid brief.
      let job: TaskRunnerJob
      try {
        job = await queue.enqueue({
          userId: input.userId,
          matterId: input.matterId,
          title: read.title ?? 'Background check',
          brief: read.brief,
        })
      } catch (error) {
        console.error('concierge handoff could not be queued', String(error))
        messages.push({ role: 'assistant', content: reply, toolCalls: [handoffCall] })
        messages.push(
          toolResultMessage(
            handoffCall.id,
            JSON.stringify({
              tool: HANDOFF_NAME,
              error: 'queue_unavailable',
              instruction: 'The job was not started. Answer in plain words for now.',
            }),
          ),
        )
        continue
      }
      const settled = await queue.waitFor(job.id, handoffWaitMs(env)).catch((error: unknown) => {
        console.error('concierge handoff wait failed', String(error))
        return undefined
      })
      const finished = settled && (settled.status === 'done' || settled.status === 'failed')
      const result = finished
        ? {
            tool: HANDOFF_NAME,
            task_id: job.id,
            status: settled.status,
            summary: settled.summary ?? TASK_FAILED_NOTE,
          }
        : {
            tool: HANDOFF_NAME,
            task_id: job.id,
            status: 'accepted',
            instruction:
              'The job is still running. Tell the person in plain words you are looking into it and will report the outcome, then continue the turn.',
          }
      // The tool transcript stays in `messages` (model context only): like
      // the card internals in G-01, it never reaches the thread.
      messages.push({ role: 'assistant', content: reply, toolCalls: [handoffCall] })
      messages.push(toolResultMessage(handoffCall.id, JSON.stringify(result)))
      continue
    }

    if (!askCall) {
      if (!text) {
        console.error('concierge turn was empty')
        yield { type: 'error', message: CONCIERGE_REPLY_FAILED }
        return
      }
      const assistant = await appendMatterMessage(input.store, input.userId, input.matterId, {
        role: 'assistant',
        text,
      })
      if (assistant) yield { type: 'assistant', message: assistant }
      else yield { type: 'error', message: CONCIERGE_REPLY_FAILED }
      return
    }

    const read = readAskChoiceCallArgs(askCall)
    if (!read.ok) {
      // The host gate refused the card. The person never sees the attempt:
      // the pane drops the half-shown copy and the model gets one chance to
      // fix the card or answer in plain words. Arguments are not stored.
      console.error('concierge askChoice call refused', read.issues.join(','))
      yield { type: 'reset' }
      messages.push({ role: 'assistant', content: reply, toolCalls: [askCall] })
      messages.push(
        toolResultMessage(
          askCall.id,
          JSON.stringify({
            widget: ASK_CHOICE_NAME,
            error: 'invalid_props',
            issues: read.issues,
            instruction: 'The card was refused. Ask the question in plain words, or call askChoice again with valid props.',
          }),
        ),
      )
      continue
    }

    // Narration first: the Concierge's own words, stored as its own message
    // so the transcript reads narration, then card. Never tool internals.
    if (text) {
      const narration = await appendMatterMessage(input.store, input.userId, input.matterId, {
        role: 'assistant',
        text,
      })
      if (narration) yield { type: 'assistant', message: narration }
    }
    const card = await appendAskChoice(input.store, input.userId, input.matterId, read.props)
    if (!card) {
      yield { type: 'error', message: CONCIERGE_REPLY_FAILED }
      return
    }
    // The card is the end of the turn. It suspends here: the answer route
    // stores the pick as the tool result and resumes the run.
    yield { type: 'assistant', message: card }
    return
  }

  // Every attempt was refused. Nothing half-shown survives the error.
  console.error('concierge turn ran out of steps')
  yield { type: 'error', message: CONCIERGE_REPLY_FAILED }
}
