import type { MatterMessage, MatterObservations, MatterSummary, MatterThreadStatus, MatterToolUse } from './types'

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

type TextPart = {
  type?: string
  text?: string
  toolName?: unknown
  toolInvocation?: { toolName?: unknown }
}

type StoredContent = {
  parts?: TextPart[]
  toolInvocations?: { toolName?: unknown }[]
  content?: unknown
} | null | undefined

/** Plain text from a stored Mastra message. Tool and signal parts are skipped. */
export function matterMessageText(content: StoredContent): string {
  const parts = content?.parts ?? []
  const texts = parts.flatMap((part) => (part?.type === 'text' && typeof part.text === 'string' ? [part.text] : []))
  if (texts.length > 0) return texts.join('\n')
  if (typeof content?.content === 'string') return content.content
  return ''
}

const TOOL_NAME_MAX = 80

/** A tool name we can show. Anything that looks like a payload is dropped. */
function readToolName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim()
  if (!name || name.length > TOOL_NAME_MAX) return null
  if (!/^[A-Za-z][A-Za-z0-9_.:/-]*$/.test(name)) return null
  return name
}

function pushToolName(names: string[], value: unknown) {
  const name = readToolName(value)
  if (name && !names.includes(name)) names.push(name)
}

/**
 * Tool names on a stored message, in order, with duplicates removed.
 * Arguments, results, and raw JSON are not copied.
 */
export function matterMessageTools(content: StoredContent): MatterToolUse[] {
  const names: string[] = []
  for (const part of content?.parts ?? []) {
    if (!part || typeof part !== 'object') continue
    const type = part.type ?? ''
    if (type !== 'tool-invocation' && !type.startsWith('tool-')) continue
    pushToolName(names, part.toolInvocation?.toolName ?? part.toolName)
  }
  for (const call of content?.toolInvocations ?? []) {
    pushToolName(names, call?.toolName)
  }
  return names.map((name) => ({ name }))
}

/** One quiet line for a tool. No arguments and no JSON. */
export function toolUseLabel(name: string): string {
  const words = name
    .replace(/[_./:-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  if (!words) return 'Checked something.'
  return `Checked ${words}.`
}

export function matterThreadCopy(input: {
  title: string | null
  status: MatterThreadStatus
  messageCount: number
}): { title: string; detail: string } {
  if (!input.title || input.status === 'idle') {
    return {
      title: 'Start a matter',
      detail: 'New chat opens a place for what is happening. Write it in your own words. This is not legal advice.',
    }
  }
  if (input.status === 'loading') {
    return { title: input.title, detail: 'Opening this matter.' }
  }
  if (input.status === 'error') {
    return { title: input.title, detail: 'This matter could not be opened.' }
  }
  if (input.messageCount === 0) {
    return {
      title: input.title,
      detail: 'Write what has happened, in your own words. It stays with this matter. This is not legal advice.',
    }
  }
  return { title: input.title, detail: '' }
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
