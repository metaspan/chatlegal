/**
 * Server-only OpenAI-compatible client for the LiteLLM router (G-00).
 *
 * The request carries the Bearer key. This module is imported by route
 * handlers and server code only. The key is never logged and never returned:
 * failures name the status, not the request.
 *
 * The request shape follows the OpenAI chat completions API the router
 * speaks. The stickiness header (chat stickiness, default
 * x-litellm-session-id) is adapted from dcolley/tourbillon@7a8595b
 * apps/web/lib/llm-providers.ts, so one matter keeps landing on the same
 * worker. The safe-fallback style (never a hard failure to the person, a
 * quiet console line instead) follows apps/web/lib/chat/concierge-model.ts
 * in the same commit.
 */

import { chatCompletionsEndpoint, type LiteLLMConfig } from './config'

export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessage = {
  role: ChatRole
  content: string
}

export type ChatCompletionRequest = {
  model: string
  messages: ChatMessage[]
  /** Visible content needs at least 64 tokens on the TaskRunner models. */
  maxTokens?: number
  /** Conversation key for router stickiness. The matter id is used. */
  sessionId?: string
  timeoutMs?: number
}

/** Below this the TaskRunner aliases can return an empty completion. */
export const MIN_VISIBLE_TOKENS = 64

const COMPLETION_TIMEOUT_MS = 30_000
const STREAM_TIMEOUT_MS = 120_000

/** The router is unreachable or refused. The message never carries the key. */
export class LiteLLMUnavailableError extends Error {
  constructor(message = 'The model could not be reached.') {
    super(message)
    this.name = 'LiteLLMUnavailableError'
  }
}

/**
 * One non-streamed completion. Returns the assistant text, or an empty string
 * when the reply carries no text. max_tokens is floored at 64: below that the
 * TaskRunner aliases can return nothing visible.
 */
export async function chatCompletion(
  config: LiteLLMConfig,
  request: ChatCompletionRequest,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<string> {
  const response = await callCompletions(config, request, false, fetchImpl)
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    console.error('LiteLLM completions endpoint returned unreadable JSON.')
    throw new LiteLLMUnavailableError()
  }
  return completionText(payload)
}

/**
 * One streamed completion. Yields the content deltas in order and stops at
 * the DONE marker. A line that is not a completion delta is skipped.
 */
export async function* streamChatCompletion(
  config: LiteLLMConfig,
  request: ChatCompletionRequest,
  fetchImpl: typeof fetch = globalThis.fetch,
): AsyncGenerator<string> {
  const response = await callCompletions(config, request, true, fetchImpl)
  const body = response.body
  if (!body) return
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (isDoneLine(line)) return
        const delta = deltaFromSseLine(line)
        if (delta) yield delta
        newline = buffer.indexOf('\n')
      }
    }
    const tail = buffer.trim()
    if (tail && !isDoneLine(tail)) {
      const delta = deltaFromSseLine(tail)
      if (delta) yield delta
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
}

async function callCompletions(
  config: LiteLLMConfig,
  request: ChatCompletionRequest,
  stream: boolean,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
    authorization: `Bearer ${config.apiKey}`,
  }
  if (request.sessionId?.trim()) headers[config.sessionHeader] = request.sessionId.trim()
  let response: Response
  try {
    response = await fetchImpl(chatCompletionsEndpoint(config.baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
        stream,
        max_tokens: visibleMaxTokens(request.maxTokens),
      }),
      signal: AbortSignal.timeout(request.timeoutMs ?? (stream ? STREAM_TIMEOUT_MS : COMPLETION_TIMEOUT_MS)),
    })
  } catch {
    console.error('The LiteLLM completions endpoint could not be reached.')
    throw new LiteLLMUnavailableError()
  }
  if (!response.ok) {
    // The status only. The key and the request body are never logged.
    console.error('The LiteLLM completions endpoint returned', response.status)
    throw new LiteLLMUnavailableError()
  }
  return response
}

function visibleMaxTokens(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return MIN_VISIBLE_TOKENS
  return Math.max(MIN_VISIBLE_TOKENS, Math.floor(raw))
}

function completionText(payload: unknown): string {
  const choices = payload && typeof payload === 'object' ? (payload as { choices?: unknown }).choices : undefined
  if (!Array.isArray(choices) || choices.length === 0) return ''
  const first = choices[0]
  const message = first && typeof first === 'object' ? (first as { message?: unknown }).message : undefined
  const content = message && typeof message === 'object' ? (message as { content?: unknown }).content : undefined
  return typeof content === 'string' ? content : ''
}

function isDoneLine(line: string): boolean {
  return line.startsWith('data:') && line.slice(5).trim() === '[DONE]'
}

/** content from one `data: {...}` completion chunk, or '' when the line carries none. */
function deltaFromSseLine(line: string): string {
  if (!line.startsWith('data:')) return ''
  const payload = line.slice(5).trim()
  if (!payload || payload === '[DONE]') return ''
  let value: unknown
  try {
    value = JSON.parse(payload) as unknown
  } catch {
    return ''
  }
  const choices = value && typeof value === 'object' ? (value as { choices?: unknown }).choices : undefined
  if (!Array.isArray(choices) || choices.length === 0) return ''
  const first = choices[0]
  const delta = first && typeof first === 'object' ? (first as { delta?: unknown }).delta : undefined
  const content = delta && typeof delta === 'object' ? (delta as { content?: unknown }).content : undefined
  return typeof content === 'string' ? content : ''
}
