import type { MatterObservations, MatterSummary, MatterThreadStatus } from './types'

export function toIso(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  return new Date(0).toISOString()
}

export function matterHistoryDetail(matter: Pick<MatterSummary, 'createdAt'>): string {
  const date = new Date(matter.createdAt)
  if (Number.isNaN(date.getTime())) return 'Matter'
  const formatted = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
  return `Opened ${formatted}`
}

type TextPart = { type?: string; text?: string }

/** Plain text from a stored Mastra message. Tool and signal parts are skipped. */
export function matterMessageText(content: { parts?: TextPart[]; content?: unknown } | null | undefined): string {
  const parts = content?.parts ?? []
  const texts = parts.flatMap((part) => (part?.type === 'text' && typeof part.text === 'string' ? [part.text] : []))
  if (texts.length > 0) return texts.join('\n')
  if (typeof content?.content === 'string') return content.content
  return ''
}

export function matterThreadCopy(input: {
  title: string | null
  status: MatterThreadStatus
  messageCount: number
}): { title: string; detail: string } {
  if (!input.title || input.status === 'idle') {
    return {
      title: 'New chat',
      detail: 'No matter is open. New chat opens one and lists it on the left.',
    }
  }
  if (input.status === 'loading') {
    return { title: input.title, detail: 'Loading this matter…' }
  }
  if (input.status === 'error') {
    return { title: input.title, detail: 'This matter could not be opened.' }
  }
  if (input.messageCount === 0) {
    return {
      title: input.title,
      detail: 'No messages in this matter yet. Sending stays off until a model is connected.',
    }
  }
  return {
    title: input.title,
    detail: 'Messages saved with this matter. Sending stays off until a model is connected.',
  }
}

export function isMatterObservations(value: unknown): value is MatterObservations {
  if (!value || typeof value !== 'object') return false
  const record = value as { enabled?: unknown; summary?: unknown }
  return typeof record.enabled === 'boolean' && typeof record.summary === 'string'
}

/**
 * Plain-language summary for the open matter.
 * A summary is shown only when this matter is ready. Loading and errors stay blank.
 */
export function matterObservationCopy(input: {
  matterId: string | null
  status: MatterThreadStatus
  observations: MatterObservations | null
}): { detail: string; summary: string | null } {
  if (!input.matterId || input.status === 'idle') {
    return {
      detail: 'No matter is open. Open a chat to see its summary.',
      summary: null,
    }
  }
  if (input.status === 'error') {
    return { detail: 'This matter could not be opened.', summary: null }
  }
  if (input.status === 'loading' || !input.observations) {
    return { detail: 'Loading the summary for this matter…', summary: null }
  }
  const summary = input.observations.summary.trim()
  if (summary) {
    return { detail: 'This summary is only for the open matter.', summary }
  }
  return { detail: 'No summary for this matter yet.', summary: null }
}
