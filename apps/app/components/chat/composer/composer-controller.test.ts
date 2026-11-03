import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  createComposerController,
  RECONNECT_DELAYS_MS,
  type ComposerController,
  type ComposerControls,
  type SendOutcome,
} from './composer-controller.ts'
import { createDraftStore, draftKey, memoryStorage } from './draft-store.ts'
import { createQueueStore, queueKey } from './queue-store.ts'
import { MAX_QUEUED } from './queue.ts'

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function until(ready: () => boolean) {
  for (let i = 0; i < 30; i++) {
    if (ready()) return
    await Promise.resolve()
  }
  throw new Error('timed out waiting for the composer')
}

function create(
  overrides: Partial<{
    matterId: string | null
    ready: boolean
    connection: 'online' | 'offline'
    loadNow: boolean
    initialText: string
    controls: ComposerControls
    schedule: (fn: () => void, ms: number) => () => void
    makeId: () => string
  }> & {
    drafts?: ReturnType<typeof createDraftStore>
    queues?: ReturnType<typeof createQueueStore>
  } = {},
): ComposerController {
  let n = 0
  return createComposerController({
    matterId: 'matter-1',
    ready: true,
    schedule: () => () => {},
    makeId: () => `id-${++n}`,
    controls: { send: async () => ({ ok: true }) },
    ...overrides,
  })
}

describe('composer controller', () => {
  it('sends the open matter and clears the box', async () => {
    const sent: Array<{ text: string; matterId: string }> = []
    const controller = create({
      controls: {
        send: async (text, matterId) => {
          sent.push({ text, matterId })
          return { ok: true }
        },
      },
    })
    controller.setText('  When is the deadline?  ')
    assert.equal(await controller.primary(), true)
    assert.deepEqual(sent, [{ text: 'When is the deadline?', matterId: 'matter-1' }])
    assert.equal(controller.getState().text, '')
    assert.equal(controller.getState().queue.length, 0)
  })

  it('keeps a failed or timed-out send on the queue', async () => {
    const controller = create({
      controls: { send: async () => ({ ok: false, reason: 'timeout' }) },
    })
    controller.setText('Hello')
    assert.equal(await controller.primary(), true)
    const state = controller.getState()
    assert.equal(state.text, '')
    assert.equal(state.queue.length, 1)
    assert.equal(state.queue[0]?.text, 'Hello')
    assert.equal(state.queue[0]?.state, 'failed')
    assert.equal(state.connection, 'reconnecting')
    assert.match(state.notices.at(-1)?.message ?? '', /took too long/)

    const thrown = create({
      controls: {
        send: async () => {
          throw Object.assign(new Error('timed out'), { name: 'TimeoutError' })
        },
      },
    })
    thrown.setText('Still here')
    await thrown.primary()
    assert.equal(thrown.getState().queue[0]?.text, 'Still here')
    assert.equal(thrown.getState().queue[0]?.state, 'failed')
  })

  it('queues while offline and sends when the connection returns', async () => {
    const sent: string[] = []
    const controller = create({
      controls: {
        send: async (text) => {
          sent.push(text)
          return { ok: true }
        },
      },
    })
    await controller.setConnection('offline')
    controller.setText('First')
    await controller.primary()
    controller.setText('Second')
    await controller.primary()
    assert.deepEqual(sent, [])
    assert.deepEqual(
      controller.getState().queue.map((item) => item.text),
      ['First', 'Second'],
    )
    assert.match(controller.getState().notices.at(-1)?.message ?? '', /offline/)
    await controller.setConnection('online')
    assert.deepEqual(sent, ['First', 'Second'])
    assert.equal(controller.getState().queue.length, 0)
    assert.equal(controller.getState().connection, 'online')
  })

  it('sends a follow-up after the in-flight message, in order', async () => {
    const sent: string[] = []
    let release: (outcome: SendOutcome) => void = () => {}
    const controller = create({
      controls: {
        send: (text) => {
          sent.push(text)
          if (sent.length === 1) return new Promise<SendOutcome>((resolve) => { release = resolve })
          return { ok: true }
        },
      },
    })
    controller.setText('First')
    const pending = controller.primary()
    await until(() => controller.getState().submitting)
    controller.setText('Second')
    assert.equal(await controller.primary(), true)
    assert.deepEqual(
      controller.getState().queue.map((item) => item.text),
      ['First', 'Second'],
    )
    assert.equal(controller.getState().queue[0]?.state, 'sending')
    release({ ok: true })
    await pending
    assert.deepEqual(sent, ['First', 'Second'])
    assert.equal(controller.getState().queue.length, 0)
  })

  it('tries again on a short delay, then waits', async () => {
    const timers: Array<() => void> = []
    const delays: number[] = []
    let calls = 0
    const controller = create({
      schedule: (fn, ms) => {
        delays.push(ms)
        timers.push(fn)
        return () => {}
      },
      controls: {
        send: async () => {
          calls += 1
          return { ok: false, reason: 'failed' }
        },
      },
    })
    controller.setText('Hello')
    await controller.primary()
    assert.equal(calls, 1)
    assert.equal(timers.length, 1)
    timers.shift()?.()
    await tick()
    timers.shift()?.()
    await tick()
    timers.shift()?.()
    await tick()
    assert.equal(calls, 1 + RECONNECT_DELAYS_MS.length)
    assert.deepEqual(delays, [...RECONNECT_DELAYS_MS])
    assert.equal(timers.length, 0)
    assert.equal(controller.getState().connection, 'online')
    assert.equal(controller.getState().queue[0]?.state, 'failed')

    await controller.retry()
    assert.equal(calls, 2 + RECONNECT_DELAYS_MS.length)
    assert.equal(controller.getState().queue[0]?.text, 'Hello')
  })

  it('keeps each matter’s draft and queue', async () => {
    const sent: string[] = []
    const controller = create({
      matterId: 'a',
      controls: {
        send: async (text, matterId) => {
          sent.push(`${matterId}:${text}`)
          return { ok: false, reason: 'failed' }
        },
      },
    })
    await controller.setConnection('offline')
    controller.setText('for a')
    await controller.primary()
    controller.syncMatter('b')
    assert.equal(controller.getState().matterId, 'b')
    assert.equal(controller.getState().queue.length, 0)
    controller.setText('draft b')
    controller.syncMatter('a')
    assert.equal(controller.getState().queue[0]?.text, 'for a')
    assert.equal(controller.getState().text, '')
    controller.syncMatter('b')
    assert.equal(controller.getState().text, 'draft b')
    assert.deepEqual(sent, [])
  })

  it('puts a send back on the matter it started on', async () => {
    let release: (outcome: SendOutcome) => void = () => {}
    let matterSeen = ''
    const controller = create({
      matterId: 'a',
      controls: {
        send: (_text, matterId) =>
          new Promise<SendOutcome>((resolve) => {
            matterSeen = matterId
            release = resolve
          }),
      },
    })
    controller.setText('for a')
    const pending = controller.primary()
    await until(() => controller.getState().submitting)
    controller.syncMatter('b')
    release({ ok: false, reason: 'failed' })
    await pending
    assert.equal(matterSeen, 'a')
    assert.equal(controller.getState().matterId, 'b')
    assert.equal(controller.getState().queue.length, 0)
    await controller.setConnection('offline')
    controller.syncMatter('a')
    assert.equal(controller.getState().queue[0]?.text, 'for a')
    assert.equal(controller.getState().queue[0]?.state, 'failed')
  })

  it('refuses an empty or huge message and leaves it in the box', async () => {
    let calls = 0
    const controller = create({
      controls: {
        send: async () => {
          calls += 1
          return { ok: true }
        },
      },
    })
    controller.setText('   ')
    assert.equal(await controller.primary(), false)
    assert.match(controller.getState().notices.at(-1)?.message ?? '', /Write a message/)
    controller.setText('a'.repeat(8001))
    assert.equal(await controller.primary(), false)
    assert.match(controller.getState().notices.at(-1)?.message ?? '', /too long/)
    assert.equal(controller.getState().text.length, 8001)
    assert.equal(controller.getState().queue.length, 0)
    assert.equal(calls, 0)
  })

  it('does not send before the matter is ready, then flushes', async () => {
    const sent: string[] = []
    const storage = memoryStorage()
    const queues = createQueueStore(storage, () => 1)
    queues.save(queueKey('matter-1'), [{ id: 'saved', text: 'From before', state: 'pending' }])
    const controller = create({
      ready: false,
      loadNow: true,
      queues,
      controls: {
        send: async (text) => {
          sent.push(text)
          return { ok: true }
        },
      },
    })
    assert.equal(controller.getState().queue[0]?.text, 'From before')
    controller.setText('Not yet')
    assert.equal(await controller.primary(), false)
    assert.deepEqual(sent, [])
    await controller.setReady(true)
    assert.deepEqual(sent, ['From before'])
    assert.equal(controller.getState().text, 'Not yet')
  })

  it('edits and removes a waiting message', async () => {
    const controller = create()
    await controller.setConnection('offline')
    controller.setText('One')
    await controller.primary()
    controller.setText('Two')
    await controller.primary()
    controller.startEdit('id-1')
    controller.setEditText('One edited')
    controller.saveEdit()
    assert.equal(controller.getState().queue[0]?.text, 'One edited')
    assert.equal(controller.getState().editing, null)
    controller.startEdit('id-1')
    controller.setEditText('   ')
    controller.saveEdit()
    assert.deepEqual(
      controller.getState().queue.map((item) => item.id),
      ['id-2'],
    )
    controller.removeQueued('id-2')
    assert.equal(controller.getState().queue.length, 0)
  })

  it('stops when the queue is full', async () => {
    const controller = create()
    await controller.setConnection('offline')
    for (let i = 0; i < MAX_QUEUED; i++) {
      controller.setText(`Message ${i}`)
      assert.equal(await controller.primary(), true)
    }
    controller.setText('One more')
    assert.equal(await controller.primary(), false)
    assert.equal(controller.getState().text, 'One more')
    assert.equal(controller.getState().queue.length, MAX_QUEUED)
    assert.match(controller.getState().notices.at(-1)?.message ?? '', /queue is full/)
  })

  it('restores a draft from storage', () => {
    const storage = memoryStorage()
    const drafts = createDraftStore(storage, () => 1)
    const first = create({ drafts, matterId: 'matter-1' })
    first.setText('Kept for this matter')
    assert.equal(drafts.load(draftKey('matter-1'))?.text, 'Kept for this matter')
    const second = create({ drafts, matterId: 'matter-1', ready: false, loadNow: true, initialText: 'seed' })
    assert.equal(second.getState().text, 'Kept for this matter')
  })

  it('sends on Enter and leaves Shift+Enter alone', async () => {
    let sent = 0
    const controller = create({
      controls: {
        send: async () => {
          sent += 1
          return { ok: true }
        },
      },
    })
    controller.setText('Hello')
    let prevented = false
    assert.equal(
      controller.handleKeyDown({
        key: 'Enter',
        preventDefault() {
          prevented = true
        },
      }),
      true,
    )
    assert.equal(prevented, true)
    await tick()
    assert.equal(sent, 1)
    assert.equal(
      controller.handleKeyDown({
        key: 'Enter',
        shiftKey: true,
        preventDefault() {
          throw new Error('shift should not send')
        },
      }),
      false,
    )
  })

  it('does not read a new environment variable', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const source = fs.readFileSync(path.join(here, 'composer-controller.ts'), 'utf8')
    assert.doesNotMatch(source, /process\.env/)
    assert.match(source, /dcolley\/tourbillon@7a8595b/)
  })
})
