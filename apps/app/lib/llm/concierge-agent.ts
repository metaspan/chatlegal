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
import { litellmConfig, resolveOutboundModelId } from './config'
import {
  streamChatTurn,
  toolResultMessage,
  type ChatMessage,
  type ChatToolCall,
} from './client'
import { appendAskChoice, appendMatterMessage, getMatterThread, type MatterStore } from '../matters/store'
import type { MatterMessage, MatterAskChoice } from '../matters/types'
import type { MatterStreamEvent } from '../matters/chat-stream'

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
 */
export function agentConversationMessages(
  history: readonly MatterMessage[],
  userText?: string,
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
  return [{ role: 'system', content: CONCIERGE_AGENT_PROMPT }, ...turns]
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
 */
export async function* streamConciergeTurn(input: {
  store: MatterStore
  userId: string
  matterId: string
  userText?: string
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
}): AsyncGenerator<MatterStreamEvent> {
  const env = input.env ?? process.env
  const config = litellmConfig(env)
  if (!config) return
  const model = resolveOutboundModelId(defaultModelClass.modelId, env) ?? config.conciergeModel
  const thread = await getMatterThread(input.store, input.userId, input.matterId)
  if (!thread) return
  const messages = agentConversationMessages(thread.messages, input.userText)
  const fetchImpl = input.fetchImpl ?? globalThis.fetch

  for (let step = 0; step < CONCIERGE_MAX_AGENT_STEPS; step += 1) {
    let reply = ''
    let toolCalls: ChatToolCall[] = []
    try {
      for await (const event of streamChatTurn(
        config,
        {
          model,
          messages,
          tools: [askChoiceToolDefinition()],
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

    const askCall = toolCalls.find((call) => call.name === ASK_CHOICE_NAME)
    const text = reply.trim()

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
