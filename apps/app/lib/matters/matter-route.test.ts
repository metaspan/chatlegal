import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { matterResourceId } from './resource.ts'
import { createMatter, disconnectMatterStore, getMatterStore } from './store.ts'

describe('open matter route', () => {
  it('returns 404 for another user and does not include their summary', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-matter-route-'))
    const previousDb = process.env.CHATLEGAL_MATTERS_DB
    const previousSession = process.env.CHATLEGAL_TEST_SESSION
    process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
    process.env.CHATLEGAL_TEST_SESSION = 'signed-in'
    delete process.env.CHATLEGAL_OM_ENABLED
    delete process.env.CHATLEGAL_OM_MODEL
    await disconnectMatterStore()
    try {
      const { GET } = await import('../../app/api/matters/[matterId]/route.ts')
      const store = await getMatterStore()
      const own = await createMatter(store, 'user_test', { title: 'Deposit' })
      const other = await createMatter(store, 'user_b', { title: 'Secret matter' })
      const domain = await store.memory.storage.getStore('memory')
      if (!domain) throw new Error('memory store missing')
      const ownRecord = await domain.initializeObservationalMemory({
        threadId: own.id,
        resourceId: matterResourceId('user_test'),
        scope: 'thread',
        config: { scope: 'thread' },
      })
      await domain.updateActiveObservations({
        id: ownRecord.id,
        observations: 'The deposit deadline is Friday.',
        tokenCount: 8,
        lastObservedAt: new Date('2026-11-03T00:00:00.000Z'),
      })
      const secret = await domain.initializeObservationalMemory({
        threadId: other.id,
        resourceId: matterResourceId('user_b'),
        scope: 'thread',
        config: { scope: 'thread' },
      })
      await domain.updateActiveObservations({
        id: secret.id,
        observations: 'The other person owes a parking fine.',
        tokenCount: 8,
        lastObservedAt: new Date('2026-11-03T00:00:00.000Z'),
      })

      const opened = await GET(new Request('http://localhost/api/matters/' + own.id), {
        params: Promise.resolve({ matterId: own.id }),
      })
      assert.equal(opened.status, 200)
      const body = (await opened.json()) as { observations?: { enabled?: boolean; summary?: string } }
      assert.equal(body.observations?.enabled, false)
      assert.equal(body.observations?.summary, 'The deposit deadline is Friday.')

      const missing = await GET(new Request('http://localhost/api/matters/' + other.id), {
        params: Promise.resolve({ matterId: other.id }),
      })
      assert.equal(missing.status, 404)
      const hidden = await missing.text()
      assert.match(hidden, /Matter not found/)
      assert.doesNotMatch(hidden, /Secret matter|parking fine/)
    } finally {
      await disconnectMatterStore()
      if (previousDb === undefined) delete process.env.CHATLEGAL_MATTERS_DB
      else process.env.CHATLEGAL_MATTERS_DB = previousDb
      if (previousSession === undefined) delete process.env.CHATLEGAL_TEST_SESSION
      else process.env.CHATLEGAL_TEST_SESSION = previousSession
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
