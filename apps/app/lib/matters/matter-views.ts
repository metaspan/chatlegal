import type { MatterMessage, MatterObservations, MatterSummary, MatterThreadStatus } from './types'

/**
 * People, dates, and status for the right pane.
 * Dates and the chat's standing are read from the matter and its messages.
 * People are not on the matter record. That card stays a labelled stub.
 * Nothing here invents a name, a letter date, or a waiting-on status.
 */

export type MatterViewMatter = Pick<MatterSummary, 'id' | 'title' | 'createdAt' | 'updatedAt'>

export type MatterViewRow = {
  id: string
  label: string
  value: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export function formatMatterStamp(iso: string, withTime: boolean): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const datePart = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
  if (!withTime) return datePart
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  return `${datePart}, ${hour}:${minute} UTC`
}

export function partiesViewCopy(matterId: string | null): { detail: string; stub: string | null } {
  if (!matterId) {
    return {
      detail: 'No chat is open. Open a chat to see who is involved.',
      stub: null,
    }
  }
  return {
    detail: 'People in this chat are not stored yet.',
    stub: 'Stub. Names and addresses are not on this chat yet.',
  }
}

export function datesViewModel(input: {
  matterId: string | null
  matter: MatterViewMatter | null
  messages: readonly Pick<MatterMessage, 'id' | 'role' | 'createdAt'>[]
}): { detail: string; rows: MatterViewRow[]; stub: string | null } {
  if (!input.matterId) {
    return {
      detail: 'No chat is open. Open a chat to see its dates.',
      rows: [],
      stub: null,
    }
  }
  const rows: MatterViewRow[] = []
  const opened = input.matter ? formatMatterStamp(input.matter.createdAt, false) : null
  const changed = input.matter ? formatMatterStamp(input.matter.updatedAt, true) : null
  if (opened) rows.push({ id: 'opened', label: 'Opened', value: opened })
  if (changed) rows.push({ id: 'updated', label: 'Last change', value: changed })
  for (const message of input.messages) {
    const stamp = formatMatterStamp(message.createdAt, true)
    if (!stamp) continue
    rows.push({
      id: message.id,
      label: message.role === 'user' ? 'You wrote' : 'Reply',
      value: stamp,
    })
  }
  return {
    detail: rows.length > 0 ? 'These dates are from this chat.' : 'No dates are stored for this chat yet.',
    rows,
    stub: 'Stub. Dates taken from letters are not stored yet.',
  }
}

export function statusViewModel(input: {
  matterId: string | null
  status: MatterThreadStatus
  messageCount: number
  observations: MatterObservations | null
  /** Messages of the open chat. Used for the plain-language next line (G-01). */
  messages?: readonly Pick<MatterMessage, 'role' | 'widget'>[]
  /** True while the Concierge stream is still filling the chat (G-01). */
  replying?: boolean
}): { detail: string; rows: MatterViewRow[]; stub: string | null } {
  if (!input.matterId || input.status === 'idle') {
    return {
      detail: 'No chat is open. Open a chat to see where it stands.',
      rows: [],
      stub: null,
    }
  }
  const standing =
    input.status === 'loading'
      ? 'Opening this chat.'
      : input.status === 'error'
        ? 'This chat could not be opened.'
        : 'This chat is open.'
  const notes =
    input.messageCount === 0
      ? 'Nothing written yet.'
      : input.messageCount === 1
        ? '1 note in this chat.'
        : `${input.messageCount} notes in this chat.`
  let summary = 'Not loaded yet.'
  if (input.status === 'ready' && input.observations) {
    summary = input.observations.summary.trim() ? 'A summary is saved for this chat.' : 'No summary yet.'
  } else if (input.status === 'error') {
    summary = 'No summary yet.'
  }
  const rows: MatterViewRow[] = [
    { id: 'standing', label: 'Chat', value: standing },
    { id: 'notes', label: 'Notes', value: notes },
    { id: 'summary', label: 'Summary', value: summary },
  ]
  const next = chatStateNarration(input)
  if (next) rows.push({ id: 'next', label: 'Next', value: next })
  return {
    detail: standing,
    rows,
    stub: 'Stub. Waiting on a letter, or a similar status, is not stored yet.',
  }
}

/**
 * One plain-language line on where the chat stands (G-01).
 * Derived from what is on screen, in the citizen's terms only: a card
 * waiting for a pick, the Concierge still replying, whose turn it is. It
 * never names a tool, a model, or anything about how the software works,
 * and it never speaks like a solicitor. Null when there is nothing to say.
 */
export function chatStateNarration(input: {
  status: MatterThreadStatus
  messageCount: number
  messages?: readonly Pick<MatterMessage, 'role' | 'widget'>[]
  replying?: boolean
}): string | null {
  if (input.status !== 'ready' || input.messageCount === 0) return null
  const messages = input.messages ?? []
  if (messages.length === 0) return null
  if (input.replying) return 'ChatLegal is replying.'
  const waiting = messages.find(
    (message) => message.widget && message.widget.status === 'pending',
  )
  if (waiting) return 'One question is waiting for your answer.'
  const last = messages[messages.length - 1]
  if (last.role === 'assistant') return 'ChatLegal has replied. Write what happens next.'
  return 'Your message is saved on this chat.'
}
