import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mattersDatabaseAuthToken, mattersDatabaseUrl } from './database-url.ts'
import { draftText, writeDraft } from './draft.ts'
import { filterMatterHistory } from './filter.ts'
import { MatterMessageError, messagesAfterReload, messagesWithSaved, parseMatterMessageBody, resolveMatterMessageText } from './message.ts'
import { isMatterObservations, matterHistoryDetail, matterMessageText, matterMessageTools, matterObservationCopy, matterThreadCopy, toolUseLabel } from './present.ts'
import { matterResourceId } from './resource.ts'
import { MatterTitleError, resolveMatterTitle } from './title.ts'

describe('matter resource id', () => {
  it('scopes a matter to the Clerk user id', () => {
    assert.equal(matterResourceId('user_abc'), 'clerk:user_abc')
    assert.notEqual(matterResourceId('user_abc'), matterResourceId('user_def'))
  })

  it('refuses a blank user id', () => {
    assert.throws(() => matterResourceId('  '), /Clerk user id/)
    assert.throws(() => matterResourceId('user two'), /Clerk user id/)
  })
})

describe('matter titles', () => {
  it('uses New chat when no title is given', () => {
    assert.equal(resolveMatterTitle(undefined), 'New chat')
  })

  it('trims a provided title and refuses an empty or huge one', () => {
    assert.equal(resolveMatterTitle('  Deposit  '), 'Deposit')
    assert.throws(() => resolveMatterTitle('   '), MatterTitleError)
    assert.throws(() => resolveMatterTitle('a'.repeat(201)), MatterTitleError)
    assert.throws(() => resolveMatterTitle('bad\nname'), MatterTitleError)
  })
})

describe('matter history search', () => {
  const rows = [
    { id: 'a', title: 'Deposit', detail: 'Opened 3 Nov 2026' },
    { id: 'b', title: 'New chat', detail: 'Opened 1 Nov 2026' },
  ]

  it('keeps every row when the query is blank', () => {
    assert.equal(filterMatterHistory(rows, '  ').length, 2)
  })

  it('requires every word to match the title or the detail', () => {
    assert.deepEqual(
      filterMatterHistory(rows, 'deposit').map((row) => row.id),
      ['a'],
    )
    assert.deepEqual(
      filterMatterHistory(rows, 'opened nov').map((row) => row.id),
      ['a', 'b'],
    )
    assert.equal(filterMatterHistory(rows, 'deposit wages').length, 0)
  })
})

describe('matter drafts', () => {
  it('keeps each draft with its matter id', () => {
    const first = writeDraft({}, 'matter-a', 'hello')
    const both = writeDraft(first, 'matter-b', 'second')
    assert.equal(draftText(both, 'matter-a'), 'hello')
    assert.equal(draftText(both, 'matter-b'), 'second')
    assert.equal(draftText(both, null), '')
    assert.equal(draftText(writeDraft(both, 'matter-a', 'edited'), 'matter-b'), 'second')
  })
})

describe('matter presentation', () => {
  it('labels a row with the UTC open date', () => {
    assert.equal(matterHistoryDetail({ createdAt: '2026-11-03T18:00:00.000Z' }), 'Opened 3 Nov 2026')
  })

  it('reads text parts and ignores other parts', () => {
    assert.equal(
      matterMessageText({
        parts: [
          { type: 'text', text: 'Hello' },
          { type: 'tool-invocation' },
          { type: 'text', text: 'again' },
        ],
      }),
      'Hello\nagain',
    )
    assert.equal(matterMessageText({ content: 'plain' }), 'plain')
    assert.equal(matterMessageText(undefined), '')
  })

  it('keeps tool names and drops arguments and JSON', () => {
    const tools = matterMessageTools({
      parts: [
        { type: 'text', text: 'Here is what the notice says.' },
        {
          type: 'tool-invocation',
          toolInvocation: { toolName: 'search_sources', args: { secret: 'do-not-show' } },
        },
        { type: 'tool-result', toolName: 'search_sources', result: { token: 'json-dump' } },
        { type: 'tool-invocation', toolInvocation: { toolName: '{ "raw": true }' } },
        { type: 'step-start' },
      ],
      toolInvocations: [{ toolName: 'lookupStatute' }],
    })
    assert.deepEqual(tools, [{ name: 'search_sources' }, { name: 'lookupStatute' }])
    assert.equal(JSON.stringify(tools).includes('do-not-show'), false)
    assert.equal(JSON.stringify(tools).includes('json-dump'), false)
    assert.equal(toolUseLabel('search_sources'), 'Checked search sources.')
    assert.equal(toolUseLabel('lookupStatute'), 'Checked lookup statute.')
    assert.doesNotMatch(toolUseLabel('search_sources'), /\{|args|result/)
  })

  it('describes an empty thread as an invite, not as legal advice', () => {
    const idle = matterThreadCopy({ title: null, status: 'idle', messageCount: 0 })
    assert.equal(idle.title, 'Start a chat')
    assert.match(idle.detail, /New chat opens a place/)
    assert.match(idle.detail, /not legal advice/i)
    assert.doesNotMatch(idle.detail, /I act for you|solicitor will|we advise/i)
    const empty = matterThreadCopy({ title: 'New chat', status: 'ready', messageCount: 0 })
    assert.match(empty.detail, /in your own words/)
    assert.match(empty.detail, /not legal advice/i)
    assert.equal(matterThreadCopy({ title: 'Deposit', status: 'ready', messageCount: 2 }).title, 'Deposit')
    assert.equal(matterThreadCopy({ title: 'Deposit', status: 'ready', messageCount: 2 }).detail, '')
  })

  it('refuses an empty or huge message and keeps a normal one', () => {
    assert.equal(resolveMatterMessageText('  When is the deadline?  '), 'When is the deadline?')
    assert.equal(parseMatterMessageBody('{"text":"Hello\\nthere"}'), 'Hello\nthere')
    assert.throws(() => resolveMatterMessageText('   '), MatterMessageError)
    assert.throws(() => resolveMatterMessageText('a'.repeat(8001)), MatterMessageError)
    assert.throws(() => resolveMatterMessageText('bad\u0000name'), MatterMessageError)
    assert.throws(() => parseMatterMessageBody('{"text":1}'), MatterMessageError)
    assert.throws(() => parseMatterMessageBody('not json'), MatterMessageError)
  })

  it('keeps an in-flight send when a load finishes during it', () => {
    const optimistic = {
      id: 'local:1',
      role: 'user' as const,
      text: 'Hello',
      createdAt: '2026-11-03T00:00:00.000Z',
      pending: true,
    }
    assert.deepEqual(messagesAfterReload([optimistic], [], true), [optimistic])
    assert.deepEqual(messagesAfterReload([optimistic], [], false), [])
    const saved = { id: 'msg-1', role: 'user' as const, text: 'Hello', createdAt: '2026-11-03T00:00:01.000Z' }
    assert.deepEqual(messagesWithSaved([optimistic], 'local:1', saved), [saved])
  })

  it('shows a summary only for the open matter', () => {
    assert.equal(isMatterObservations({ enabled: false, summary: '' }), true)
    assert.equal(isMatterObservations({ enabled: 'no', summary: '' }), false)
    assert.match(matterObservationCopy({ matterId: null, status: 'idle', observations: null }).detail, /Open a chat/)
    assert.equal(
      matterObservationCopy({ matterId: null, status: 'idle', observations: { enabled: true, summary: 'Secret' } }).summary,
      null,
    )
    assert.match(
      matterObservationCopy({ matterId: 'm', status: 'ready', observations: { enabled: false, summary: '' } }).detail,
      /No summary for this chat yet/,
    )
    assert.equal(
      matterObservationCopy({ matterId: 'm', status: 'ready', observations: { enabled: false, summary: '' } }).summary,
      null,
    )
    const shown = matterObservationCopy({
      matterId: 'm',
      status: 'ready',
      observations: { enabled: true, summary: ' Deposit is due Friday. ' },
    })
    assert.equal(shown.summary, 'Deposit is due Friday.')
    assert.match(shown.detail, /only for the open chat/)
    assert.equal(
      matterObservationCopy({
        matterId: 'm',
        status: 'error',
        observations: { enabled: true, summary: 'Deposit is due Friday.' },
      }).summary,
      null,
    )
  })
})

describe('matter database url', () => {
  it('defaults to a local file and accepts a host path or remote URL', () => {
    const fallback = mattersDatabaseUrl({} as NodeJS.ProcessEnv)
    assert.match(fallback, /^file:/)
    assert.match(fallback, /data\/matters\.db$/)
    assert.equal(
      mattersDatabaseUrl({ CHATLEGAL_MATTERS_DB: '/var/lib/chatlegal/matters.db' }),
      'file:/var/lib/chatlegal/matters.db',
    )
    assert.equal(
      mattersDatabaseUrl({ CHATLEGAL_MATTERS_DB: 'libsql://matters.example' }),
      'libsql://matters.example',
    )
  })

  it('asks for an auth token only on a remote URL', () => {
    assert.equal(mattersDatabaseAuthToken('file:/tmp/matters.db', { CHATLEGAL_MATTERS_AUTH_TOKEN: 'secret' }), undefined)
    assert.equal(
      mattersDatabaseAuthToken('libsql://matters.example', { CHATLEGAL_MATTERS_AUTH_TOKEN: ' secret ' }),
      'secret',
    )
    assert.equal(mattersDatabaseAuthToken('libsql://matters.example', {}), undefined)
  })
})
