/**
 * Unsent outbound messages saved per matter, so a reload does not drop them.
 * Storage shape follows dcolley/tourbillon@7a8595b
 * apps/web/components/assistant/composer/draft-store.ts (versioned JSON, prune, ignore quota).
 * The queue itself is text waiting to be stored, not a follow-up attachment list.
 *
 * Key `chatlegal.composer.queue:{matterId}`; value `{ v: 1, items, updatedAt }`.
 */

import { MAX_QUEUED, type QueuedMessage, type QueuedState } from './queue'
import { type DraftStorage, browserStorage } from './draft-store'

export const QUEUE_KEY_PREFIX = 'chatlegal.composer.queue:'
export const MAX_QUEUE_STORES = 50

export function queueKey(matterId: string): string {
  return `${QUEUE_KEY_PREFIX}${matterId}`
}

export interface StoredQueue {
  items: QueuedMessage[]
  updatedAt: number
}

function isState(value: unknown): value is QueuedState {
  return value === 'pending' || value === 'sending' || value === 'failed'
}

function parse(raw: string | null): StoredQueue | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as { v?: unknown; items?: unknown; updatedAt?: unknown }
    if (value?.v !== 1 || !Array.isArray(value.items)) return null
    const items: QueuedMessage[] = []
    for (const item of value.items) {
      if (!item || typeof item !== 'object') continue
      const row = item as { id?: unknown; text?: unknown; state?: unknown }
      if (typeof row.id !== 'string' || !row.id) continue
      if (typeof row.text !== 'string' || !row.text.trim()) continue
      if (!isState(row.state)) continue
      // A reload means the in-flight request is gone. Try it again.
      items.push({ id: row.id, text: row.text, state: row.state === 'sending' ? 'pending' : row.state })
      if (items.length >= MAX_QUEUED) break
    }
    return {
      items,
      updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
    }
  } catch {
    return null
  }
}

export interface QueueStore {
  load(key: string): StoredQueue | null
  save(key: string, items: readonly QueuedMessage[]): void
  clear(key: string): void
}

export function createQueueStore(storage: DraftStorage | null = browserStorage(), now: () => number = Date.now): QueueStore {
  const prune = () => {
    if (!storage) return
    const rows: Array<{ key: string; updatedAt: number }> = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (!key?.startsWith(QUEUE_KEY_PREFIX)) continue
      rows.push({ key, updatedAt: parse(storage.getItem(key))?.updatedAt ?? 0 })
    }
    if (rows.length <= MAX_QUEUE_STORES) return
    rows.sort((a, b) => a.updatedAt - b.updatedAt)
    for (const row of rows.slice(0, rows.length - MAX_QUEUE_STORES)) storage.removeItem(row.key)
  }
  return {
    load(key) {
      try {
        return parse(storage?.getItem(key) ?? null)
      } catch {
        return null
      }
    },
    save(key, items) {
      if (!storage) return
      try {
        if (items.length === 0) {
          storage.removeItem(key)
          return
        }
        storage.setItem(
          key,
          JSON.stringify({
            v: 1,
            items: items.slice(0, MAX_QUEUED).map((item) => ({ id: item.id, text: item.text, state: item.state })),
            updatedAt: now(),
          }),
        )
        prune()
      } catch {
        /* quota or private mode: the in-memory queue still works */
      }
    },
    clear(key) {
      try {
        storage?.removeItem(key)
      } catch {
        /* ignore */
      }
    },
  }
}
