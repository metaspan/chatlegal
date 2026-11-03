/**
 * Outbound chat messages waiting to send.
 * Pure helpers adapted from dcolley/tourbillon@7a8595b
 * apps/web/components/assistant/composer/queue.ts (enqueue, edit, remove, takeNext).
 * That file queues follow-ups while a run is open. This queue holds text that
 * has not been stored on the matter yet. Attachments are not part of it.
 */

export const MAX_QUEUED = 20

export type QueuedState = 'pending' | 'sending' | 'failed'

export interface QueuedMessage {
  id: string
  text: string
  /**
   * `pending` is waiting for a turn.
   * `sending` is the try in flight.
   * `failed` means the last try did not land.
   */
  state: QueuedState
}

export type QueueResult = { ok: true; queue: QueuedMessage[] } | { ok: false; reason: 'full' | 'empty' }

export function enqueue(queue: readonly QueuedMessage[], item: QueuedMessage): QueueResult {
  if (!item.text.trim()) return { ok: false, reason: 'empty' }
  if (queue.length >= MAX_QUEUED) return { ok: false, reason: 'full' }
  return { ok: true, queue: [...queue, { ...item, text: item.text }] }
}

/** Edits a queued item. An edit that leaves nothing to send removes the item. */
export function editQueued(queue: readonly QueuedMessage[], id: string, text: string): QueuedMessage[] {
  return queue.flatMap((item) => {
    if (item.id !== id) return [item]
    if (!text.trim()) return []
    return [{ ...item, text, state: 'pending' as const }]
  })
}

export function removeQueued(queue: readonly QueuedMessage[], id: string): QueuedMessage[] {
  return queue.filter((item) => item.id !== id)
}

export function takeNext(queue: readonly QueuedMessage[]): { next: QueuedMessage | undefined; rest: QueuedMessage[] } {
  const [next, ...rest] = queue
  return { next, rest }
}

/** Puts a message back at the front after a try that did not land. Keeps its id. */
export function requeueFront(queue: readonly QueuedMessage[], item: QueuedMessage): QueuedMessage[] {
  return [item, ...queue.filter((queued) => queued.id !== item.id)]
}
