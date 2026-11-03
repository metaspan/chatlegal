import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDraftStore, draftKey, MAX_DRAFT_CHARS, MAX_DRAFTS, memoryStorage, type DraftStorage } from './draft-store.ts'
import { createQueueStore, queueKey } from './queue-store.ts'

describe('composer draft store', () => {
  it('saves and loads a draft, and drops a blank one', () => {
    let now = 10
    const store = createDraftStore(memoryStorage(), () => now)
    store.save(draftKey('matter-a'), { text: '  Hello  ' })
    assert.equal(store.load(draftKey('matter-a'))?.text, '  Hello  ')
    assert.equal(store.load(draftKey('matter-a'))?.updatedAt, 10)
    store.save(draftKey('matter-a'), { text: '   ' })
    assert.equal(store.load(draftKey('matter-a')), null)
    now = 11
    store.save(draftKey('matter-b'), { text: 'Second' })
    assert.equal(store.load(draftKey('matter-b'))?.text, 'Second')
    store.clear(draftKey('matter-b'))
    assert.equal(store.load(draftKey('matter-b')), null)
  })

  it('cuts a huge draft and ignores a bad value', () => {
    const storage = memoryStorage()
    const store = createDraftStore(storage, () => 1)
    store.save(draftKey('m'), { text: 'a'.repeat(MAX_DRAFT_CHARS + 50) })
    assert.equal(store.load(draftKey('m'))?.text.length, MAX_DRAFT_CHARS)
    storage.setItem(draftKey('m'), '{')
    assert.equal(store.load(draftKey('m')), null)
    storage.setItem(draftKey('m'), JSON.stringify({ v: 2, text: 'nope' }))
    assert.equal(store.load(draftKey('m')), null)
  })

  it('drops the oldest drafts past the cap', () => {
    let now = 0
    const store = createDraftStore(memoryStorage(), () => ++now)
    for (let i = 0; i < MAX_DRAFTS + 2; i++) store.save(draftKey(`m-${i}`), { text: `draft ${i}` })
    assert.equal(store.load(draftKey('m-0')), null)
    assert.equal(store.load(draftKey('m-1')), null)
    assert.equal(store.load(draftKey(`m-${MAX_DRAFTS + 1}`))?.text, `draft ${MAX_DRAFTS + 1}`)
  })

  it('ignores storage failures', () => {
    const broken: DraftStorage = {
      length: 0,
      key: () => null,
      getItem: () => {
        throw new Error('private')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('quota')
      },
    }
    const store = createDraftStore(broken)
    assert.doesNotThrow(() => store.save(draftKey('m'), { text: 'Hello' }))
    assert.equal(store.load(draftKey('m')), null)
    assert.doesNotThrow(() => store.clear(draftKey('m')))
    assert.equal(createDraftStore(null).load(draftKey('m')), null)
  })
})

describe('composer queue store', () => {
  it('round-trips waiting messages and treats a stored send as waiting again', () => {
    const storage = memoryStorage()
    const store = createQueueStore(storage, () => 5)
    store.save(queueKey('matter-a'), [
      { id: 'a', text: 'Hello', state: 'failed' },
      { id: 'b', text: 'Next', state: 'sending' },
    ])
    assert.deepEqual(store.load(queueKey('matter-a'))?.items, [
      { id: 'a', text: 'Hello', state: 'failed' },
      { id: 'b', text: 'Next', state: 'pending' },
    ])
    store.save(queueKey('matter-a'), [])
    assert.equal(store.load(queueKey('matter-a')), null)
  })

  it('drops a row that is not text', () => {
    const storage = memoryStorage()
    storage.setItem(
      queueKey('m'),
      JSON.stringify({
        v: 1,
        items: [
          { id: 'ok', text: 'Hello', state: 'pending' },
          { id: 'blank', text: '  ', state: 'pending' },
          { id: '', text: 'no id', state: 'pending' },
          { text: 'missing id', state: 'pending' },
        ],
        updatedAt: 1,
      }),
    )
    const store = createQueueStore(storage)
    assert.deepEqual(store.load(queueKey('m'))?.items, [{ id: 'ok', text: 'Hello', state: 'pending' }])
    storage.setItem(queueKey('m'), 'not-json')
    assert.equal(store.load(queueKey('m')), null)
  })
})
