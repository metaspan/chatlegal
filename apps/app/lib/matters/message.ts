import type { MatterMessage } from './types'

/**
 * Text the composer may store on a matter.
 * A blank message is refused. Newlines stay. Other control characters do not.
 */

export const MATTER_MESSAGE_MAX = 8_000

export class MatterMessageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MatterMessageError'
  }
}

export function resolveMatterMessageText(raw: unknown): string {
  if (typeof raw !== 'string') throw new MatterMessageError('Message must be text.')
  const text = raw.trim()
  if (!text) throw new MatterMessageError('Message cannot be empty.')
  if (text.length > MATTER_MESSAGE_MAX) {
    throw new MatterMessageError(`Message is too long (${MATTER_MESSAGE_MAX} characters max).`)
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
    throw new MatterMessageError('Message cannot include control characters.')
  }
  return text
}

export function parseMatterMessageBody(raw: string): string {
  let body: unknown
  try {
    body = JSON.parse(raw) as unknown
  } catch {
    throw new MatterMessageError('The request must be JSON.')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new MatterMessageError('The request must be a JSON object.')
  }
  return resolveMatterMessageText((body as { text?: unknown }).text)
}

export function messagesWithOptimistic(current: readonly MatterMessage[], optimistic: MatterMessage): MatterMessage[] {
  return [...current, optimistic]
}

/** Swaps the on-screen copy for the row the server stored. */
export function messagesWithSaved(
  current: readonly MatterMessage[],
  localId: string,
  saved: MatterMessage,
): MatterMessage[] {
  const without = current.filter((message) => message.id !== localId && message.id !== saved.id)
  const next: MatterMessage = {
    id: saved.id,
    role: saved.role,
    text: saved.text,
    createdAt: saved.createdAt,
    ...(saved.tools && saved.tools.length > 0 ? { tools: saved.tools } : {}),
  }
  return [...without, next]
}

/**
 * A load that overlapped Send keeps the messages already on screen.
 * Otherwise the stored thread replaces them.
 */
export function messagesAfterReload(
  current: readonly MatterMessage[] | null,
  loaded: readonly MatterMessage[],
  sentDuringLoad: boolean,
): MatterMessage[] {
  if (sentDuringLoad && current && current.length > 0) return [...current]
  return [...loaded]
}

export function isStoredMatterMessage(value: unknown): value is MatterMessage {
  if (!value || typeof value !== 'object') return false
  const record = value as { id?: unknown; role?: unknown; text?: unknown; createdAt?: unknown; tools?: unknown }
  if (typeof record.id !== 'string' || !record.id.trim()) return false
  if (record.role !== 'user' && record.role !== 'assistant') return false
  if (typeof record.text !== 'string') return false
  if (typeof record.createdAt !== 'string' || !record.createdAt) return false
  if (record.tools === undefined) return true
  if (!Array.isArray(record.tools)) return false
  return record.tools.every((tool) => {
    if (!tool || typeof tool !== 'object') return false
    return typeof (tool as { name?: unknown }).name === 'string' && (tool as { name: string }).name.trim().length > 0
  })
}

/** Drops anything except the fields the centre pane shows. */
export function presentStoredMatterMessage(value: MatterMessage): MatterMessage {
  const tools = value.tools
    ?.map((tool) => ({ name: tool.name.trim() }))
    .filter((tool) => tool.name.length > 0)
  return {
    id: value.id,
    role: value.role,
    text: value.text,
    createdAt: value.createdAt,
    ...(tools && tools.length > 0 ? { tools } : {}),
  }
}
