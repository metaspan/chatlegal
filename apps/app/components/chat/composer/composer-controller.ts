/**
 * Composer state for one centre pane: the draft, and outbound text that has not
 * been stored yet. Framework-free (the React view subscribes with useSyncExternalStore).
 *
 * Behaviour adapted from dcolley/tourbillon@7a8595b
 * apps/web/components/assistant/composer/composer-controller.ts.
 * That composer queues a follow-up while a run is open, and can steer or stop that run.
 * This controller does not. It keeps a send that fails or times out, and sends the
 * queue when the connection returns. Attachments, steer, and stop are not copied.
 *
 * Enter sends. Shift+Enter keeps a line break (lib/chat-composer).
 * A result `{ ok: false }` puts the text on the queue so nothing the person wrote is lost.
 */

import { composerSendsOnEnter } from '@/lib/chat-composer'
import { isSendTimeout } from '@/lib/chat/send-timeout'
import { MatterMessageError, resolveMatterMessageText } from '@/lib/matters/message'
import { createDraftStore, draftKey, type DraftStore } from './draft-store'
import { createQueueStore, queueKey, type QueueStore } from './queue-store'
import { editQueued, enqueue, removeQueued, type QueuedMessage } from './queue'

export const RECONNECT_DELAYS_MS = [2_000, 5_000, 12_000] as const

export type ConnectionStatus = 'online' | 'offline' | 'reconnecting'

export type SendReason = 'invalid' | 'timeout' | 'failed'

export type SendOutcome = { ok: true } | { ok: false; reason?: SendReason | string }

type MaybeResult = Promise<SendOutcome | boolean | void> | SendOutcome | boolean | void

/** What the composer needs from the matter session. */
export interface ComposerControls {
  /** Stores this text on the matter. `false` or `{ ok: false }` keeps it queued. */
  send(text: string, matterId: string): MaybeResult
}

export interface ComposerNotice {
  kind: 'error' | 'info'
  message: string
}

export interface ComposerState {
  text: string
  queue: QueuedMessage[]
  /** A send is in flight. */
  submitting: boolean
  connection: ConnectionStatus
  /** The open matter's thread is ready to take a message. */
  ready: boolean
  matterId: string | null
  notices: ComposerNotice[]
  editing: { id: string; text: string } | null
}

/** Minimal key shape (React synthetic events satisfy this). */
export interface KeyLike {
  key: string
  shiftKey?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  isComposing?: boolean
  preventDefault(): void
}

export interface ComposerControllerOptions {
  controls: ComposerControls
  matterId?: string | null
  /** Text already on screen for this matter (tests, first paint). Storage wins once loaded. */
  initialText?: string
  ready?: boolean
  connection?: ConnectionStatus
  drafts?: DraftStore
  queues?: QueueStore
  /** Read storage before the first paint. The React view leaves this off and calls syncMatter. */
  loadNow?: boolean
  makeId?: () => string
  /** Delay helper. Default is setTimeout. Tests pass a fake clock. */
  schedule?: (fn: () => void, ms: number) => () => void
}

const MAX_NOTICES = 3

type Slot = { text: string; queue: QueuedMessage[] }

function defaultSchedule(fn: () => void, ms: number): () => void {
  const id = setTimeout(fn, ms)
  return () => clearTimeout(id)
}

function noticeFor(reason: string): { kind: 'info'; message: string } {
  if (reason === 'timeout') {
    return { kind: 'info', message: 'That took too long. It stays here and sends when the connection returns.' }
  }
  return { kind: 'info', message: 'Not saved yet. It stays here and sends when the connection returns.' }
}

export function createComposerController(options: ComposerControllerOptions) {
  let seq = 0
  const makeId = options.makeId ?? (() => `q${Date.now().toString(36)}-${++seq}`)
  const drafts = options.drafts ?? createDraftStore()
  const queues = options.queues ?? createQueueStore()
  const schedule = options.schedule ?? defaultSchedule
  const listeners = new Set<() => void>()
  const memory = new Map<string, Slot>()
  const attempts = new Map<string, number>()
  const timers = new Map<string, () => void>()
  let flushing = false
  let controls = options.controls
  const seededMatter = options.matterId ?? null
  const seedText = options.initialText ?? ''

  let activeId: string | null = options.matterId ?? null
  let text = seedText
  let queue: QueuedMessage[] = []
  let submitting = false
  let connection: ConnectionStatus = options.connection ?? 'online'
  let ready = options.ready ?? false
  let notices: ComposerNotice[] = []
  let editing: { id: string; text: string } | null = null
  let state = snapshot()

  function snapshot(): ComposerState {
    return {
      text,
      queue,
      submitting,
      connection,
      ready,
      matterId: activeId,
      notices,
      editing,
    }
  }

  function publish() {
    if (activeId) memory.set(activeId, { text, queue })
    state = snapshot()
    for (const listener of listeners) listener()
  }

  function persistDraft(matterId: string, value: string) {
    drafts.save(draftKey(matterId), { text: value })
  }

  function persistQueue(matterId: string, items: readonly QueuedMessage[]) {
    queues.save(queueKey(matterId), items)
  }

  function persistActive() {
    if (!activeId) return
    persistDraft(activeId, text)
    persistQueue(activeId, queue)
  }

  function readSlot(matterId: string): Slot {
    const savedDraft = drafts.load(draftKey(matterId))
    const savedQueue = queues.load(queueKey(matterId))
    const storedText = savedDraft?.text ?? ''
    const keepSeed = seededMatter === matterId && !storedText ? seedText : ''
    return {
      text: storedText || keepSeed,
      queue: savedQueue?.items ?? [],
    }
  }

  function notify(notice: ComposerNotice) {
    if (notices.at(-1)?.message === notice.message) return
    notices = [...notices, notice].slice(-MAX_NOTICES)
  }

  function validationMessage(error: unknown): string {
    if (error instanceof MatterMessageError) {
      if (error.message === 'Message cannot be empty.') return 'Write a message before sending.'
      return error.message
    }
    return 'Write a message before sending.'
  }

  function cancelTimer(matterId: string) {
    timers.get(matterId)?.()
    timers.delete(matterId)
  }

  function remember(matterId: string, slot: Slot) {
    memory.set(matterId, slot)
    persistDraft(matterId, slot.text)
    persistQueue(matterId, slot.queue)
  }

  /** Updates one matter's queue and writes it, including when that matter is not on screen. */
  function updateQueue(matterId: string, fn: (items: readonly QueuedMessage[]) => QueuedMessage[]) {
    if (activeId === matterId) {
      queue = fn(queue)
      memory.set(matterId, { text, queue })
      persistQueue(matterId, queue)
      return
    }
    const slot = memory.get(matterId) ?? readSlot(matterId)
    const next = fn(slot.queue)
    memory.set(matterId, { text: slot.text, queue: next })
    persistQueue(matterId, next)
  }

  function restoreUnsent(matterId: string, value: string) {
    if (activeId === matterId) {
      text = text ? `${value}\n${text}` : value
      persistDraft(matterId, text)
      return
    }
    const slot = memory.get(matterId) ?? readSlot(matterId)
    const nextText = slot.text ? `${value}\n${slot.text}` : value
    remember(matterId, { text: nextText, queue: slot.queue })
  }

  function scheduleReconnect(matterId: string) {
    if (connection === 'offline') return
    const attempt = attempts.get(matterId) ?? 0
    if (attempt >= RECONNECT_DELAYS_MS.length) {
      if (activeId === matterId && connection === 'reconnecting') connection = 'online'
      return
    }
    attempts.set(matterId, attempt + 1)
    cancelTimer(matterId)
    const cancel = schedule(() => {
      timers.delete(matterId)
      if (connection === 'offline') return
      if (activeId !== matterId || submitting) return
      void flushQueue()
    }, RECONNECT_DELAYS_MS[attempt] ?? RECONNECT_DELAYS_MS[RECONNECT_DELAYS_MS.length - 1])
    timers.set(matterId, cancel)
  }

  function normalize(result: SendOutcome | boolean | void, thrown?: unknown): SendOutcome {
    if (thrown) {
      return { ok: false, reason: isSendTimeout(thrown) ? 'timeout' : 'failed' }
    }
    if (result === false) return { ok: false, reason: 'failed' }
    if (result && typeof result === 'object' && 'ok' in result) {
      if (result.ok) return { ok: true }
      const reason = result.reason
      if (reason === 'timeout' || reason === 'invalid' || reason === 'failed') return { ok: false, reason }
      return { ok: false, reason: 'failed' }
    }
    return { ok: true }
  }

  async function postOne(matterId: string, item: QueuedMessage): Promise<boolean> {
    submitting = true
    if (connection !== 'offline' && attempts.has(matterId)) connection = 'reconnecting'
    updateQueue(matterId, (items) => items.map((row) => (row.id === item.id ? { ...row, state: 'sending' } : row)))
    publish()
    let outcome: SendOutcome
    try {
      outcome = normalize(await controls.send(item.text, matterId))
    } catch (error) {
      outcome = normalize(undefined, error)
    }
    submitting = false
    if (!outcome.ok && outcome.reason === 'invalid') {
      updateQueue(matterId, (items) => items.filter((row) => row.id !== item.id))
      restoreUnsent(matterId, item.text)
      notify({ kind: 'error', message: 'That message could not be stored. It is back in the box.' })
      if (connection === 'reconnecting') connection = 'online'
      publish()
      return false
    }
    if (!outcome.ok) {
      updateQueue(matterId, (items) =>
        items.map((row) => (row.id === item.id ? { ...row, text: item.text, state: 'failed' } : row)),
      )
      notify(noticeFor(outcome.reason ?? 'failed'))
      if (connection !== 'offline') connection = 'reconnecting'
      scheduleReconnect(matterId)
      publish()
      return false
    }
    updateQueue(matterId, (items) => items.filter((row) => row.id !== item.id))
    attempts.delete(matterId)
    cancelTimer(matterId)
    if (activeId === matterId && queue.length === 0 && connection === 'reconnecting') connection = 'online'
    publish()
    return true
  }

  async function flushQueue(force = false): Promise<void> {
    if (flushing || !activeId || submitting || !ready) return
    if (connection === 'offline' && !force) return
    flushing = true
    try {
      while (activeId && ready && (connection !== 'offline' || force)) {
        force = false
        const next = queue[0]
        if (!next || next.state === 'sending') {
          if (!next && connection === 'reconnecting') connection = 'online'
          publish()
          return
        }
        if (editing?.id === next.id) editing = null
        const sendingMatterId: string | null = activeId
        if (!sendingMatterId) return
        const ok = await postOne(sendingMatterId, next)
        if (!ok || activeId !== sendingMatterId) return
      }
    } finally {
      flushing = false
    }
  }

  function loadMatter(id: string | null) {
    if (activeId && activeId !== id) remember(activeId, { text, queue })
    activeId = id
    editing = null
    if (!id) {
      text = ''
      queue = []
      publish()
      return
    }
    if (!memory.has(id)) {
      const slot = readSlot(id)
      memory.set(id, slot)
    }
    const slot = memory.get(id)!
    text = slot.text
    queue = slot.queue
    publish()
    if (ready && connection !== 'offline' && queue.length > 0) void flushQueue()
  }

  if (options.loadNow && activeId) {
    const slot = readSlot(activeId)
    text = slot.text
    queue = slot.queue
    memory.set(activeId, { text, queue })
    state = snapshot()
  }

  const controller = {
    getState: (): ComposerState => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    setControls(next: ComposerControls) {
      controls = next
    },

    /** Loads the matter's draft and queue. The open matter flushes once it is ready. */
    syncMatter(id: string | null) {
      if (id === activeId && (id === null || memory.has(id))) return
      loadMatter(id)
    },

    setReady(next: boolean): Promise<void> {
      if (ready === next) return Promise.resolve()
      ready = next
      publish()
      if (!ready) return Promise.resolve()
      return flushQueue()
    },

    /**
     * `online` after `offline` or `reconnecting` sends the open matter's queue.
     * A first call that is already online does nothing.
     */
    setConnection(next: 'online' | 'offline'): Promise<void> {
      if (next === 'offline') {
        if (connection === 'offline') return Promise.resolve()
        for (const cancel of timers.values()) cancel()
        timers.clear()
        connection = 'offline'
        publish()
        return Promise.resolve()
      }
      if (connection === 'online') return Promise.resolve()
      connection = 'online'
      if (activeId) attempts.delete(activeId)
      for (const cancel of timers.values()) cancel()
      timers.clear()
      publish()
      return flushQueue()
    },

    setText(value: string) {
      text = value
      persistActive()
      publish()
    },

    /**
     * Enter or Send. The text joins the queue first, so a timeout or a lost
     * response still has it. The open matter sends that queue while online.
     */
    async primary(): Promise<boolean> {
      if (!activeId || !ready) return false
      let parsed: string
      try {
        parsed = resolveMatterMessageText(text)
      } catch (error) {
        notify({ kind: 'error', message: validationMessage(error) })
        publish()
        return false
      }
      const item: QueuedMessage = { id: makeId(), text: parsed, state: 'pending' }
      const queued = enqueue(queue, item)
      if (!queued.ok) {
        notify({
          kind: 'error',
          message:
            queued.reason === 'full'
              ? 'The queue is full. Remove a waiting message, or wait until these send.'
              : 'Write a message before sending.',
        })
        publish()
        return false
      }
      queue = queued.queue
      text = ''
      persistActive()
      if (connection === 'offline') {
        notify({ kind: 'info', message: "You're offline. This stays here and sends when the connection returns." })
      }
      publish()
      if (connection !== 'offline' && !submitting && !flushing) await flushQueue()
      return true
    },

    /** Sends the open matter's queue now, including one try while the browser is offline. */
    async retry(): Promise<void> {
      if (!activeId || submitting || flushing || !ready) return
      attempts.delete(activeId)
      cancelTimer(activeId)
      if (connection === 'reconnecting') connection = 'online'
      publish()
      await flushQueue(connection === 'offline')
    },

    startEdit(id: string) {
      const item = queue.find((queued) => queued.id === id)
      if (!item || item.state === 'sending') return
      editing = { id, text: item.text }
      publish()
    },
    setEditText(value: string) {
      if (!editing) return
      editing = { ...editing, text: value }
      publish()
    },
    saveEdit() {
      if (!editing || !activeId) return
      const current = queue.find((item) => item.id === editing?.id)
      if (!current || current.state === 'sending') return
      if (!editing.text.trim()) {
        queue = editQueued(queue, editing.id, '')
        editing = null
        persistActive()
        publish()
        return
      }
      let parsed: string
      try {
        parsed = resolveMatterMessageText(editing.text)
      } catch (error) {
        notify({ kind: 'error', message: validationMessage(error) })
        publish()
        return
      }
      queue = editQueued(queue, current.id, parsed)
      editing = null
      persistActive()
      publish()
      if (connection !== 'offline' && !submitting && !flushing) void flushQueue()
    },
    cancelEdit() {
      editing = null
      publish()
    },
    removeQueued(id: string) {
      const item = queue.find((queued) => queued.id === id)
      if (!item || item.state === 'sending') return
      queue = removeQueued(queue, id)
      if (editing?.id === id) editing = null
      persistActive()
      publish()
    },

    dismissNotice(index: number) {
      notices = notices.filter((_, i) => i !== index)
      publish()
    },

    /** Textarea keydown. True when the key sent (and preventDefault ran). */
    handleKeyDown(event: KeyLike): boolean {
      if (!composerSendsOnEnter(event)) return false
      event.preventDefault()
      void controller.primary()
      return true
    },
  }
  return controller
}

export type ComposerController = ReturnType<typeof createComposerController>
