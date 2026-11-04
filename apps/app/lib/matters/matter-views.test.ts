import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { datesViewModel, partiesViewCopy, statusViewModel } from './matter-views.ts'

const matter = {
  id: 'matter-1',
  title: 'Deposit',
  createdAt: '2026-11-03T00:00:00.000Z',
  updatedAt: '2026-11-03T18:30:00.000Z',
}

describe('matter pane views', () => {
  it('labels people as a stub and does not invent names', () => {
    const closed = partiesViewCopy(null)
    assert.match(closed.detail, /No matter is open/)
    assert.equal(closed.stub, null)

    const open = partiesViewCopy('matter-1')
    assert.match(open.detail, /not stored yet/)
    assert.match(open.stub ?? '', /^Stub\./)
    assert.doesNotMatch(`${open.detail} ${open.stub}`, /claimant|defendant|solicitor|Alice|Bob/i)
  })

  it('reads dates from the matter and its messages', () => {
    const closed = datesViewModel({ matterId: null, matter: null, messages: [] })
    assert.equal(closed.rows.length, 0)
    assert.equal(closed.stub, null)

    const open = datesViewModel({
      matterId: 'matter-1',
      matter,
      messages: [
        { id: 'msg-1', role: 'user', createdAt: '2026-11-03T00:05:00.000Z' },
        { id: 'msg-2', role: 'assistant', createdAt: '2026-11-03T00:06:00.000Z' },
      ],
    })
    assert.equal(open.rows.find((row) => row.id === 'opened')?.value, '3 Nov 2026')
    assert.equal(open.rows.find((row) => row.id === 'updated')?.value, '3 Nov 2026, 18:30 UTC')
    assert.equal(open.rows.find((row) => row.id === 'msg-1')?.label, 'You wrote')
    assert.equal(open.rows.find((row) => row.id === 'msg-2')?.label, 'Reply')
    assert.match(open.stub ?? '', /Stub\. Dates taken from letters/)
    assert.doesNotMatch(open.rows.map((row) => row.value).join(' '), /notice served|limitation/i)
  })

  it('reads chat status and leaves a waiting status as a stub', () => {
    const closed = statusViewModel({ matterId: null, status: 'idle', messageCount: 4, observations: null })
    assert.equal(closed.rows.length, 0)
    assert.match(closed.detail, /No matter is open/)

    const open = statusViewModel({
      matterId: 'matter-1',
      status: 'ready',
      messageCount: 2,
      observations: { enabled: false, summary: 'Friday.' },
    })
    assert.equal(open.rows.find((row) => row.id === 'standing')?.value, 'This chat is open.')
    assert.equal(open.rows.find((row) => row.id === 'notes')?.value, '2 notes in this chat.')
    assert.match(open.rows.find((row) => row.id === 'summary')?.value ?? '', /summary is saved/)
    assert.match(open.stub ?? '', /^Stub\./)
    assert.doesNotMatch(open.rows.map((row) => row.value).join(' '), /waiting on a letter/i)
  })
})
