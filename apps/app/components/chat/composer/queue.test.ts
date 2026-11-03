import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { editQueued, enqueue, MAX_QUEUED, removeQueued, requeueFront, takeNext, type QueuedMessage } from './queue.ts'

function item(id: string, text = id, state: QueuedMessage['state'] = 'pending'): QueuedMessage {
  return { id, text, state }
}

describe('outbound queue', () => {
  it('adds a message and leaves the previous list alone', () => {
    const original = [item('a', 'Hello')]
    const added = enqueue(original, item('b', 'Next'))
    assert.equal(added.ok, true)
    if (!added.ok) return
    assert.deepEqual(added.queue.map((row) => row.id), ['a', 'b'])
    assert.deepEqual(original.map((row) => row.id), ['a'])
  })

  it('refuses an empty message and a full queue', () => {
    assert.deepEqual(enqueue([], item('a', '   ')), { ok: false, reason: 'empty' })
    const full = Array.from({ length: MAX_QUEUED }, (_, index) => item(String(index), 'Kept'))
    assert.equal(full.length, 20)
    assert.deepEqual(enqueue(full, item('extra', 'More')), { ok: false, reason: 'full' })
    assert.equal(full.length, 20)
  })

  it('edits text, drops a blank edit, and puts a retry back at the front', () => {
    const queue = [item('a', 'Hello', 'failed'), item('b', 'Second')]
    const edited = editQueued(queue, 'a', 'Hello there')
    assert.deepEqual(edited[0], { id: 'a', text: 'Hello there', state: 'pending' })
    assert.equal(queue[0]?.state, 'failed')
    assert.deepEqual(editQueued(edited, 'a', '  '), [item('b', 'Second')])
    assert.deepEqual(
      requeueFront([item('b', 'Second')], item('a', 'Hello', 'failed')).map((row) => row.id),
      ['a', 'b'],
    )
  })

  it('removes one item and takes the next without changing the rest in place', () => {
    const queue = [item('a', 'Hello'), item('b', 'Second')]
    assert.deepEqual(removeQueued(queue, 'a').map((row) => row.id), ['b'])
    const taken = takeNext(queue)
    assert.equal(taken.next?.id, 'a')
    assert.deepEqual(taken.rest.map((row) => row.id), ['b'])
    assert.equal(queue.length, 2)
  })
})
