/**
 * Composer drafts saved per matter, so a draft survives reload.
 * Adapted from dcolley/tourbillon@7a8595b
 * apps/web/components/assistant/composer/draft-store.ts.
 * The source store also keeps attachment refs. This store keeps text only.
 *
 * Key `chatlegal.composer.draft:{matterId}`; value `{ v: 1, text, updatedAt }`.
 * Text is cut at MAX_DRAFT_CHARS. At most MAX_DRAFTS drafts are kept (oldest dropped).
 * Storage failures (quota, private mode, no window) are ignored: a draft is a
 * convenience, never a reason to fail.
 */

export const DRAFT_KEY_PREFIX = 'chatlegal.composer.draft:'
export const MAX_DRAFT_CHARS = 8_000
export const MAX_DRAFTS = 50

export interface ComposerDraft {
  text: string
  updatedAt: number
}

/** The subset of the Web Storage API used here. */
export interface DraftStorage {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function draftKey(matterId: string): string {
  return `${DRAFT_KEY_PREFIX}${matterId}`
}

export function browserStorage(): DraftStorage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

function parse(raw: string | null): ComposerDraft | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as { v?: unknown; text?: unknown; updatedAt?: unknown }
    if (value?.v !== 1 || typeof value.text !== 'string') return null
    return {
      text: value.text.slice(0, MAX_DRAFT_CHARS),
      updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
    }
  } catch {
    return null
  }
}

export interface DraftStore {
  load(key: string): ComposerDraft | null
  /** Saves, or removes the draft when there is nothing in it. */
  save(key: string, draft: { text: string }): void
  clear(key: string): void
}

export function createDraftStore(storage: DraftStorage | null = browserStorage(), now: () => number = Date.now): DraftStore {
  const prune = () => {
    if (!storage) return
    const drafts: Array<{ key: string; updatedAt: number }> = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (!key?.startsWith(DRAFT_KEY_PREFIX)) continue
      drafts.push({ key, updatedAt: parse(storage.getItem(key))?.updatedAt ?? 0 })
    }
    if (drafts.length <= MAX_DRAFTS) return
    drafts.sort((a, b) => a.updatedAt - b.updatedAt)
    for (const draft of drafts.slice(0, drafts.length - MAX_DRAFTS)) storage.removeItem(draft.key)
  }
  return {
    load(key) {
      try {
        return parse(storage?.getItem(key) ?? null)
      } catch {
        return null
      }
    },
    save(key, draft) {
      if (!storage) return
      try {
        if (!draft.text.trim()) {
          storage.removeItem(key)
          return
        }
        storage.setItem(
          key,
          JSON.stringify({
            v: 1,
            text: draft.text.slice(0, MAX_DRAFT_CHARS),
            updatedAt: now(),
          }),
        )
        prune()
      } catch {
        /* quota or private mode: keep working without a saved draft */
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

/** In-memory storage for tests. */
export function memoryStorage(): DraftStorage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    key(index) {
      return [...map.keys()][index] ?? null
    },
    getItem(key) {
      return map.get(key) ?? null
    },
    setItem(key, value) {
      map.set(key, value)
    },
    removeItem(key) {
      map.delete(key)
    },
  }
}
