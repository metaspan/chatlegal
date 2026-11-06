import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  chatStateNarration,
  datesViewModel,
  partiesViewCopy,
  statusViewModel,
} from './matter-views.ts'
import type { MatterMessage } from './types.ts'

const matter = {
  id: 'matter-1',
  title: 'Deposit',
  createdAt: '2026-11-03T00:00:00.000Z',
  updatedAt: '2026-11-03T18:30:00.000Z',
}

describe('matter pane views', () => {
  it('labels people as a stub and does not invent names', () => {
    const closed = partiesViewCopy(null)
    assert.match(closed.detail, /No chat is open/)
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
    assert.match(closed.detail, /No chat is open/)

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

  it('narrates where the chat stands, in citizen words (G-01)', () => {
    const card = (status: 'pending' | 'answered'): Pick<MatterMessage, 'role' | 'widget'> => ({
      role: 'assistant',
      widget: {
        name: 'askChoice',
        toolCallId: 'tc-1',
        version: 1,
        status,
        question: 'Do you have the letter?',
        options: [],
        multiSelect: false,
        minSelected: 1,
        maxSelected: 1,
      },
    })
    const plain = (role: 'user' | 'assistant'): Pick<MatterMessage, 'role' | 'widget'> => ({ role })
    const base = { status: 'ready' as const, messageCount: 2 }

    // A waiting card puts the turn with the person, in plain words.
    assert.match(
      chatStateNarration({ ...base, messages: [plain('user'), card('pending')] }) ?? '',
      /waiting for your answer/i,
    )
    // An answered card stops the nagging.
    assert.doesNotMatch(
      chatStateNarration({ ...base, messages: [plain('user'), card('answered')] }) ?? '',
      /waiting for your answer/i,
    )
    // A reply in progress is narrated without naming the machinery.
    assert.match(
      chatStateNarration({ ...base, messages: [plain('user')], replying: true }) ?? '',
      /replying/i,
    )
    // Whose turn it is, from the last note.
    assert.match(
      chatStateNarration({ ...base, messages: [plain('user'), plain('assistant')] }) ?? '',
      /write what happens next/i,
    )
    assert.match(
      chatStateNarration({ status: 'ready', messageCount: 1, messages: [plain('user')] }) ?? '',
      /message is saved/i,
    )
    // Nothing to say before there are notes, and nothing while loading.
    assert.equal(chatStateNarration({ status: 'ready', messageCount: 0, messages: [] }), null)
    assert.equal(chatStateNarration({ status: 'loading', messageCount: 2, messages: [plain('user')] }), null)

    // The narration never names tool/model/software internals (the no-dump ban).
    for (const line of [
      chatStateNarration({ ...base, messages: [plain('user'), card('pending')] }),
      chatStateNarration({ ...base, messages: [plain('user')], replying: true }),
      chatStateNarration({ ...base, messages: [plain('user'), plain('assistant')] }),
    ]) {
      const haystack = (line ?? '').toLowerCase()
      for (const banned of ['tool', 'json', 'prompt', 'model', 'litellm', 'token', 'widget', 'agent']) {
        assert.ok(!haystack.includes(banned), `narration must not contain "${banned}"`)
      }
    }
  })

  it('adds the plain-language Next row to the status view', () => {
    const view = statusViewModel({
      matterId: 'matter-1',
      status: 'ready',
      messageCount: 2,
      observations: null,
      messages: [
        { role: 'user' },
        { role: 'assistant' },
      ],
    })
    assert.equal(view.rows.find((row) => row.id === 'next')?.value, 'ChatLegal has replied. Write what happens next.')

    // No messages: no Next row.
    const quiet = statusViewModel({ matterId: 'matter-1', status: 'ready', messageCount: 0, observations: null })
    assert.equal(quiet.rows.find((row) => row.id === 'next'), undefined)
  })
})
