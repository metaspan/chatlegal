import { canonicalAskChoice } from './ask-choice'
import type { AskChoiceAnswer, MatterMessage } from './types'

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
  return [...without, presentStoredMatterMessage(saved)]
}

/** Locks one card to a pick already on screen, before the server confirms it. */
export function messagesWithChoiceAnswer(
  current: readonly MatterMessage[],
  toolCallId: string,
  answer: AskChoiceAnswer,
  answeredAt: string,
): MatterMessage[] {
  return current.map((message) => {
    const widget = message.widget
    if (!widget || widget.toolCallId !== toolCallId || widget.status === 'answered') return message
    return {
      ...message,
      widget: { ...widget, status: 'answered', answer, answeredAt },
    }
  })
}

/** Puts the stored row back in place. An answered card keeps its position in the transcript. */
export function messagesReplacing(current: readonly MatterMessage[], saved: MatterMessage): MatterMessage[] {
  const next = presentStoredMatterMessage(saved)
  let found = false
  const mapped = current.map((message) => {
    if (message.id !== next.id) return message
    found = true
    return next
  })
  return found ? mapped : [...mapped, next]
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

function toolsAreNames(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  return value.every((tool) => {
    if (!tool || typeof tool !== 'object') return false
    return typeof (tool as { name?: unknown }).name === 'string' && (tool as { name: string }).name.trim().length > 0
  })
}

export function isStoredMatterMessage(value: unknown): value is MatterMessage {
  if (!value || typeof value !== 'object') return false
  const record = value as { id?: unknown; role?: unknown; text?: unknown; createdAt?: unknown; tools?: unknown; widget?: unknown }
  if (typeof record.id !== 'string' || !record.id.trim()) return false
  if (record.role !== 'user' && record.role !== 'assistant') return false
  if (typeof record.text !== 'string') return false
  if (typeof record.createdAt !== 'string' || !record.createdAt) return false
  if (record.tools !== undefined && !toolsAreNames(record.tools)) return false
  if (record.widget !== undefined && !canonicalAskChoice(record.widget)) return false
  return true
}

/** Drops anything except the fields the centre pane shows. */
export function presentStoredMatterMessage(value: MatterMessage): MatterMessage {
  const widget = canonicalAskChoice(value.widget)
  const tools = value.tools
    ?.map((tool) => ({ name: tool.name.trim() }))
    .filter((tool) => tool.name.length > 0 && !(widget && tool.name === widget.name))
  return {
    id: value.id,
    role: value.role,
    text: value.text,
    createdAt: value.createdAt,
    ...(tools && tools.length > 0 ? { tools } : {}),
    ...(widget ? { widget } : {}),
  }
}
