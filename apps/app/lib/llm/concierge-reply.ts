/**
 * The G-00 Concierge reply: one streamed model answer for the message the
 * person just sent. This is the whole assistant path for G-00. There are no
 * tools, no ask_user cards, and no protocol packs: that is G-01.
 *
 * The model id resolution (the Small class name chatlegal-1 maps to the
 * Concierge alias on the server, and an unset configuration means no call at
 * all, never a refusal to the person) follows apps/web/lib/chat/
 * concierge-model.ts in dcolley/tourbillon@7a8595b: a safe fallback, not a
 * pinned default.
 *
 * Server-only: this reads the LiteLLM configuration and calls the router.
 */

import { defaultModelClass } from '../model-class'
import { appendMatterMessage, getMatterThread, type MatterStore } from '../matters/store'
import type { MatterStreamEvent } from '../matters/chat-stream'
import type { MatterMessage } from '../matters/types'
import { litellmConfig, resolveOutboundModelId } from './config'
import { streamChatCompletion, type ChatMessage } from './client'
import { CONCIERGE_SYSTEM_PROMPT } from './concierge-prompt'

/** How many earlier turns the model may see. Oldest are dropped first. */
const HISTORY_MESSAGES = 12
/** Rough cap on the words sent to the router, so a long thread stays inside the window. */
const HISTORY_CHARS = 12_000
/** The Concierge answers are short. This keeps a rambling model off the screen. */
const REPLY_MAX_TOKENS = 1_024

export const CONCIERGE_REPLY_FAILED = 'The assistant could not reply. Your message is saved.'

/**
 * The messages sent to the router: the system prompt, then the recent thread,
 * oldest first, then the text just sent (unless the thread already ends on it).
 * Messages with no text (an askChoice card on its own) are not sent.
 */
export function conversationMessages(history: readonly MatterMessage[], userText: string): ChatMessage[] {
  const turns: ChatMessage[] = []
  let chars = 0
  for (let index = history.length - 1; index >= 0 && turns.length < HISTORY_MESSAGES; index -= 1) {
    const message = history[index]
    const content = message.text.trim()
    if (!content) continue
    if (turns.length > 0 && chars + content.length > HISTORY_CHARS) break
    chars += content.length
    turns.unshift({ role: message.role === 'assistant' ? 'assistant' : 'user', content })
  }
  const last = turns[turns.length - 1]
  if (!last || last.role !== 'user' || last.content !== userText) {
    turns.push({ role: 'user', content: userText })
  }
  return [{ role: 'system', content: CONCIERGE_SYSTEM_PROMPT }, ...turns]
}

/**
 * Streams the Concierge reply for the user message the route just stored.
 * Yields the content deltas in order, then the stored assistant message.
 * When the model cannot be reached or answers with nothing, it yields one
 * error event and stores nothing. Off means no events at all: no model call.
 */
export async function* streamConciergeReply(input: {
  store: MatterStore
  userId: string
  matterId: string
  userText: string
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
}): AsyncGenerator<MatterStreamEvent> {
  const env = input.env ?? process.env
  const config = litellmConfig(env)
  if (!config) return
  const model = resolveOutboundModelId(defaultModelClass.modelId, env) ?? config.conciergeModel
  const thread = await getMatterThread(input.store, input.userId, input.matterId)
  const messages = conversationMessages(thread?.messages ?? [], input.userText)
  let reply = ''
  try {
    for await (const delta of streamChatCompletion(
      config,
      { model, messages, maxTokens: REPLY_MAX_TOKENS, sessionId: input.matterId },
      input.fetchImpl ?? globalThis.fetch,
    )) {
      if (!delta) continue
      reply += delta
      yield { type: 'delta', text: delta }
    }
  } catch (error) {
    // The router failure is logged without the key (see client.ts). The
    // person keeps their message; a later send works the same as before G-00.
    console.error('concierge reply could not be completed', error)
    yield { type: 'error', message: CONCIERGE_REPLY_FAILED }
    return
  }
  const text = reply.trim()
  if (!text) {
    console.error('concierge reply was empty')
    yield { type: 'error', message: CONCIERGE_REPLY_FAILED }
    return
  }
  const assistant = await appendMatterMessage(input.store, input.userId, input.matterId, {
    role: 'assistant',
    text,
  })
  if (assistant) yield { type: 'assistant', message: assistant }
  else yield { type: 'error', message: CONCIERGE_REPLY_FAILED }
}
