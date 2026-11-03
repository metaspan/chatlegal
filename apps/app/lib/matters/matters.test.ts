import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mattersDatabaseAuthToken, mattersDatabaseUrl } from './database-url.ts'
import { draftText, writeDraft } from './draft.ts'
import { filterMatterHistory } from './filter.ts'
import { matterHistoryDetail, matterMessageText, matterThreadCopy } from './present.ts'
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

  it('describes an empty thread and a missing matter without placeholder titles', () => {
    assert.match(matterThreadCopy({ title: null, status: 'idle', messageCount: 0 }).detail, /New chat opens one/)
    assert.match(
      matterThreadCopy({ title: 'New chat', status: 'ready', messageCount: 0 }).detail,
      /No messages in this matter yet/,
    )
    assert.equal(matterThreadCopy({ title: 'Deposit', status: 'ready', messageCount: 2 }).title, 'Deposit')
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
