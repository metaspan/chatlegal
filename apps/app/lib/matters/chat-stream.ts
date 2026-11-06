/**
 * The centre-pane chat stream (G-00).
 *
 * When LiteLLM is on, POST /api/matters/:id/messages answers with
 * newline-delimited JSON instead of one JSON body: one event per line.
 * This module parses those lines and holds the on-screen updates for them.
 *
 * Client-safe: no env is read here and no server module is imported. The
 * server side of the protocol lives in lib/llm/concierge-reply.ts.
 */

import { isStoredMatterMessage } from './message'
import type { MatterMessage } from './types'

/** One JSON event per line. */
export const MATTER_STREAM_CONTENT_TYPE = 'application/x-ndjson'

export type MatterStreamEvent =
  /** The user message the server just stored (the same body the off state returns). */
  | { type: 'user'; message: MatterMessage }
  /** One piece of the assistant reply. The centre pane appends these. */
  | { type: 'delta'; text: string }
  /** The assistant reply, stored. This replaces the streamed copy. */
  | { type: 'assistant'; message: MatterMessage }
  /** The reply did not arrive. The user's own message is still stored. */
  | { type: 'error'; message: string }

export function isMatterStreamResponse(response: Response): boolean {
  return (response.headers.get('content-type') ?? '').includes(MATTER_STREAM_CONTENT_TYPE)
}

/**
 * Reads the events in order. A line that is not a valid event is skipped,
 * so one broken line does not end the reply. The read ends with the stream.
 */
export async function* iterateMatterStreamEvents(response: Response): AsyncGenerator<MatterStreamEvent> {
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
        const event = line ? parseMatterStreamEvent(line) : null
        if (event) yield event
        newline = buffer.indexOf('\n')
      }
    }
    const tail = buffer.trim()
    const lastEvent = tail ? parseMatterStreamEvent(tail) : null
    if (lastEvent) yield lastEvent
  } finally {
    await reader.cancel().catch(() => {})
  }
}

/** One line of the stream, or null when it is not an event this pane understands. */
export function parseMatterStreamEvent(line: string): MatterStreamEvent | null {
  let value: unknown
  try {
    value = JSON.parse(line) as unknown
  } catch {
    return null
  }
  if (!value || typeof value !== 'object') return null
  const record = value as { type?: unknown; message?: unknown; text?: unknown }
  switch (record.type) {
    case 'user':
    case 'assistant':
      return isStoredMatterMessage(record.message) ? { type: record.type, message: record.message } : null
    case 'delta':
      return typeof record.text === 'string' && record.text.length > 0 ? { type: 'delta', text: record.text } : null
    case 'error':
      return typeof record.message === 'string' && record.message.trim().length > 0
        ? { type: 'error', message: record.message }
        : null
    default:
      return null
  }
}

/**
 * Shows the reply as it streams: one pending assistant message that grows.
 * The final stored message replaces it through messagesWithSaved.
 */
export function messagesWithStreamingAssistant(
  current: readonly MatterMessage[],
  placeholderId: string,
  text: string,
): MatterMessage[] {
  if (current.some((message) => message.id === placeholderId)) {
    return current.map((message) => (message.id === placeholderId ? { ...message, text } : message))
  }
  return [
    ...current,
    { id: placeholderId, role: 'assistant', text, createdAt: new Date().toISOString(), pending: true },
  ]
}

/** Drops the streamed copy (a failed or dropped reply leaves nothing half-shown). */
export function messagesWithoutMessage(current: readonly MatterMessage[], id: string): MatterMessage[] {
  return current.filter((message) => message.id !== id)
}
