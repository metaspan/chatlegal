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
 *
 * G-01 adds function calling on the same wire: one tool per turn for the
 * Concierge (askChoice). streamChatTurn yields content deltas live and the
 * accumulated tool calls when the stream ends, the way the WID-1 frontend
 * tools in dcolley/tourbillon@7a8595b packages/mastra/src/tools/
 * widget-tools.ts let a model call a widget and the host render it. The
 * client stays widget-blind: it only moves the OpenAI shapes.
 */

import { chatCompletionsEndpoint, type LiteLLMConfig } from './config'

export type ChatRole = 'system' | 'user' | 'assistant'

/** One function call the model asked for. `arguments` is the raw JSON string. */
export type ChatToolCall = {
  id: string
  name: string
  arguments: string
}

/** One model-facing function. `parameters` is a JSON Schema object. */
export type ChatToolDefinition = {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type ChatMessage =
  | { role: ChatRole; content: string; toolCalls?: ChatToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string }

/** One OpenAI tool message must follow the assistant tool call it answers. */
export function toolResultMessage(toolCallId: string, content: string): ChatMessage {
  return { role: 'tool', toolCallId, content }
}

export type ChatCompletionRequest = {
  model: string
  messages: ChatMessage[]
  /** Visible content needs at least 64 tokens on the TaskRunner models. */
  maxTokens?: number
  /** Conversation key for router stickiness. The matter id is used. */
  sessionId?: string
  timeoutMs?: number
  /** Functions the model may call this turn (G-01). Absent means plain text. */
  tools?: ChatToolDefinition[]
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
 * Tool calls on the stream are dropped here: use streamChatTurn for those.
 */
export async function* streamChatCompletion(
  config: LiteLLMConfig,
  request: ChatCompletionRequest,
  fetchImpl: typeof fetch = globalThis.fetch,
): AsyncGenerator<string> {
  for await (const event of streamChatTurn(config, request, fetchImpl)) {
    if (event.type === 'content') yield event.text
  }
}

/** One streamed model turn: content deltas as they arrive, then the tool calls. */
export type ChatTurnEvent =
  | { type: 'content'; text: string }
  | { type: 'tool_calls'; calls: ChatToolCall[] }

/**
 * One streamed turn with function calling (G-01). Content deltas are yielded
 * live. The tool calls arrive in OpenAI's delta form (id and name on the
 * first chunk, argument fragments after) and are accumulated per index;
 * the complete calls are yielded once, after the stream ends. A call with
 * no name is not a call the host can route and is dropped.
 */
export async function* streamChatTurn(
  config: LiteLLMConfig,
  request: ChatCompletionRequest,
  fetchImpl: typeof fetch = globalThis.fetch,
): AsyncGenerator<ChatTurnEvent> {
  const response = await callCompletions(config, request, true, fetchImpl)
  const body = response.body
  if (!body) return
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const calls = new ToolCallAccumulator()
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
        if (isDoneLine(line)) {
          const finished = yieldDone(calls)
          if (finished) yield finished
          return
        }
        const chunk = chunkFromSseLine(line)
        if (!chunk) {
          newline = buffer.indexOf('\n')
          continue
        }
        if (chunk.content) yield { type: 'content', text: chunk.content }
        if (chunk.toolCalls) calls.add(chunk.toolCalls)
        newline = buffer.indexOf('\n')
      }
    }
    const tail = buffer.trim()
    if (tail && !isDoneLine(tail)) {
      const chunk = chunkFromSseLine(tail)
      if (chunk) {
        if (chunk.content) yield { type: 'content', text: chunk.content }
        if (chunk.toolCalls) calls.add(chunk.toolCalls)
      }
    }
    const finished = yieldDone(calls)
    if (finished) yield finished
  } finally {
    await reader.cancel().catch(() => {})
  }
}

function yieldDone(calls: ToolCallAccumulator): ChatTurnEvent | null {
  const completed = calls.completed()
  if (completed.length === 0) return null
  return { type: 'tool_calls', calls: completed }
}

/** One chunk of the delta stream: the text it carries and the tool-call pieces. */
type SseChunk = {
  content: string
  toolCalls?: RawToolCallDelta[]
}

function chunkFromSseLine(line: string): SseChunk | null {
  if (!line.startsWith('data:')) return null
  const payload = line.slice(5).trim()
  if (!payload || payload === '[DONE]') return null
  let value: unknown
  try {
    value = JSON.parse(payload) as unknown
  } catch {
    return null
  }
  const choices = value && typeof value === 'object' ? (value as { choices?: unknown }).choices : undefined
  if (!Array.isArray(choices) || choices.length === 0) return null
  const first = choices[0]
  const delta = first && typeof first === 'object' ? (first as { delta?: unknown }).delta : undefined
  const record = delta && typeof delta === 'object' ? (delta as Record<string, unknown>) : null
  if (!record) return null
  const content = typeof record.content === 'string' ? record.content : ''
  const toolCalls = rawToolCallDeltas(record.tool_calls)
  if (!content && !toolCalls) return null
  return { content, ...(toolCalls ? { toolCalls } : {}) }
}

/** One piece of an OpenAI tool_calls delta. The index ties the pieces together. */
type RawToolCallDelta = {
  index: number
  id?: string
  name?: string
  arguments?: string
}

function rawToolCallDeltas(value: unknown): RawToolCallDelta[] | null {
  if (!Array.isArray(value)) return null
  const pieces: RawToolCallDelta[] = []
  for (let position = 0; position < value.length; position += 1) {
    const item = value[position]
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const index = typeof record.index === 'number' && Number.isFinite(record.index) ? record.index : position
    const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : undefined
    const fn = record.function && typeof record.function === 'object'
      ? (record.function as Record<string, unknown>)
      : null
    const name = fn && typeof fn.name === 'string' && fn.name.trim() ? fn.name.trim() : undefined
    const args = fn && typeof fn.arguments === 'string' ? fn.arguments : undefined
    if (!id && !name && args === undefined) continue
    pieces.push({ index, ...(id ? { id } : {}), ...(name ? { name } : {}), ...(args !== undefined ? { arguments: args } : {}) })
  }
  return pieces.length > 0 ? pieces : null
}

/** Joins the per-index pieces of the delta stream into complete calls. */
class ToolCallAccumulator {
  private readonly byIndex = new Map<number, { id: string; name: string; fragments: string[] }>()

  add(pieces: RawToolCallDelta[]): void {
    for (const piece of pieces) {
      const current = this.byIndex.get(piece.index) ?? { id: '', name: '', fragments: [] }
      if (piece.id) current.id = piece.id
      if (piece.name) current.name = piece.name
      if (piece.arguments !== undefined) current.fragments.push(piece.arguments)
      this.byIndex.set(piece.index, current)
    }
  }

  completed(): ChatToolCall[] {
    const calls: ChatToolCall[] = []
    for (const index of [...this.byIndex.keys()].sort((a, b) => a - b)) {
      const entry = this.byIndex.get(index)
      // A call the host cannot route: no name to look the tool up by.
      if (!entry || !entry.name) continue
      calls.push({
        id: entry.id || `call_${index}`,
        name: entry.name,
        arguments: entry.fragments.join(''),
      })
    }
    return calls
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
        messages: request.messages.map(wireMessage),
        ...(request.tools && request.tools.length > 0
          ? {
              tools: request.tools.map((tool) => ({
                type: 'function',
                function: { name: tool.name, description: tool.description, parameters: tool.parameters },
              })),
            }
          : {}),
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

/**
 * One message in the OpenAI wire shape. Plain {role, content} unless the
 * message carries a tool call or answers one: assistant calls travel as
 * `tool_calls`, and each call is answered by a `tool` message with its id.
 * A plain message keeps its exact G-00 shape, so the router sees no change
 * when no tools are in play.
 */
function wireMessage(message: ChatMessage): Record<string, unknown> {
  if (message.role === 'tool') {
    return { role: 'tool', tool_call_id: message.toolCallId, content: message.content }
  }
  const wire: Record<string, unknown> = { role: message.role, content: message.content }
  if (message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0) {
    wire.tool_calls = message.toolCalls.map((call) => ({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: call.arguments },
    }))
  }
  return wire
}
