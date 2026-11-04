import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { withProcessEnvLock } from '../process-env-lock.ts'
import {
  FIRST_TURN_PAPERS_QUESTION,
  FIRST_TURN_WHERE_QUESTION,
  firstTurnOpeningText,
  matterOpenedFromCreate,
} from './first-turn.ts'
import { matterResourceId } from './resource.ts'
import { createMatter, disconnectMatterStore, getMatterStore, getMatterThread, listMatters } from './store.ts'
import type { MatterSummary } from './types.ts'

type Listed = { matters?: MatterSummary[] }

describe('matter list route', () => {
  it('scopes the list to the clerk user, keeps a rename, hides an archive, and still seeds the first turn', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-matter-list-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousSession = process.env.CHATLEGAL_TEST_SESSION
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_TEST_SESSION = 'signed-in'
      delete process.env.CHATLEGAL_OM_ENABLED
      delete process.env.CHATLEGAL_OM_MODEL
      await disconnectMatterStore()
      try {
        const { GET, POST } = await import('../../app/api/matters/route.ts')
        const { GET: openMatter, PATCH } = await import('../../app/api/matters/[matterId]/route.ts')
        const store = await getMatterStore()
        const foreign = await createMatter(store, 'user_b', { title: 'Secret matter' })

        const created = await POST(new Request('http://localhost/api/matters', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }))
        assert.equal(created.status, 201)
        const opened = matterOpenedFromCreate(await created.json())
        assert.ok(opened)
        assert.equal(opened.matter.title, 'New chat')
        assert.equal(opened.messages[0]?.role, 'assistant')
        assert.equal(opened.messages[0]?.text, firstTurnOpeningText())
        assert.equal(opened.messages[1]?.widget?.question, FIRST_TURN_WHERE_QUESTION)
        assert.equal(opened.messages[2]?.widget?.question, FIRST_TURN_PAPERS_QUESTION)
        assert.equal(await getMatterThread(store, 'user_b', opened.matter.id), null)

        const listed = await GET()
        assert.equal(listed.status, 200)
        const listBody = (await listed.json()) as Listed
        assert.deepEqual(
          listBody.matters?.map((matter) => matter.id),
          [opened.matter.id],
        )
        assert.equal(listBody.matters?.[0]?.title, 'New chat')
        const raw = await store.memory.getThreadById({
          threadId: opened.matter.id,
          resourceId: matterResourceId('user_test'),
        })
        assert.equal(raw?.resourceId, 'clerk:user_test')
        assert.equal((await listMatters(store, 'user_b')).map((matter) => matter.id).includes(foreign.id), true)
        assert.equal((await listMatters(store, 'user_test')).some((matter) => matter.id === foreign.id), false)

        const renamed = await PATCH(jsonRequest(opened.matter.id, { title: '  Deposit  ' }), {
          params: Promise.resolve({ matterId: opened.matter.id }),
        })
        assert.equal(renamed.status, 200)
        const renamedBody = (await renamed.json()) as { matter?: MatterSummary }
        assert.equal(renamedBody.matter?.title, 'Deposit')
        const afterRename = (await (await GET()).json()) as Listed
        assert.equal(afterRename.matters?.find((matter) => matter.id === opened.matter.id)?.title, 'Deposit')
        const stored = await getMatterThread(store, 'user_test', opened.matter.id)
        assert.equal(stored?.matter.title, 'Deposit')
        assert.equal(stored?.messages[0]?.text, firstTurnOpeningText())

        const blank = await PATCH(jsonRequest(opened.matter.id, { title: '   ' }), {
          params: Promise.resolve({ matterId: opened.matter.id }),
        })
        assert.equal(blank.status, 400)
        assert.equal((await getMatterThread(store, 'user_test', opened.matter.id))?.matter.title, 'Deposit')

        const stolen = await PATCH(jsonRequest(foreign.id, { title: 'Nope' }), {
          params: Promise.resolve({ matterId: foreign.id }),
        })
        assert.equal(stolen.status, 404)
        assert.equal((await getMatterThread(store, 'user_b', foreign.id))?.matter.title, 'Secret matter')

        const archived = await PATCH(jsonRequest(opened.matter.id, { archived: true }), {
          params: Promise.resolve({ matterId: opened.matter.id }),
        })
        assert.equal(archived.status, 200)
        const afterArchive = (await (await GET()).json()) as Listed
        assert.deepEqual(afterArchive.matters, [])
        assert.equal((await listMatters(store, 'user_b'))[0]?.id, foreign.id)

        const kept = await openMatter(new Request('http://localhost/api/matters/' + opened.matter.id), {
          params: Promise.resolve({ matterId: opened.matter.id }),
        })
        assert.equal(kept.status, 200)
        const keptBody = (await kept.json()) as { matter?: MatterSummary; messages?: { text?: string }[] }
        assert.equal(keptBody.matter?.title, 'Deposit')
        assert.equal(keptBody.messages?.[0]?.text, firstTurnOpeningText())
        assert.equal(await getMatterThread(store, 'user_b', opened.matter.id), null)
        const hidden = await store.memory.getThreadById({
          threadId: opened.matter.id,
          resourceId: matterResourceId('user_test'),
        })
        assert.equal(hidden?.metadata?.kind, 'matter')
        assert.equal(typeof hidden?.metadata?.archivedAt, 'string')
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
})

function jsonRequest(matterId: string, body: unknown): Request {
  return new Request('http://localhost/api/matters/' + matterId, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}
