import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withProcessEnvLock } from '../process-env-lock.ts'
import { createMatter, disconnectMatterStore, getMatterStore, getMatterThread } from './store.ts'

describe('matter message route', () => {
  it('stores the signed-in user message and hides another user', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-message-route-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousSession = process.env.CHATLEGAL_TEST_SESSION
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_TEST_SESSION = 'signed-in'
      delete process.env.CHATLEGAL_OM_ENABLED
      delete process.env.CHATLEGAL_OM_MODEL
      await disconnectMatterStore()
      try {
        const { POST } = await import('../../app/api/matters/[matterId]/messages/route.ts')
        const store = await getMatterStore()
        const own = await createMatter(store, 'user_test', { title: 'Deposit' })
        const other = await createMatter(store, 'user_b', { title: 'Secret matter' })

        const saved = await POST(new Request('http://localhost/api/matters/' + own.id + '/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: '  When is the deadline?  ' }),
        }), { params: Promise.resolve({ matterId: own.id }) })
        assert.equal(saved.status, 201)
        const body = (await saved.json()) as { message?: { role?: string; text?: string } }
        assert.equal(body.message?.role, 'user')
        assert.equal(body.message?.text, 'When is the deadline?')

        const thread = await getMatterThread(store, 'user_test', own.id)
        assert.deepEqual(thread?.messages.map((message) => message.text), ['When is the deadline?'])

        const missing = await POST(new Request('http://localhost/api/matters/' + other.id + '/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: 'This must not land.' }),
        }), { params: Promise.resolve({ matterId: other.id }) })
        assert.equal(missing.status, 404)
        const hidden = await missing.text()
        assert.match(hidden, /Chat not found/)
        assert.doesNotMatch(hidden, /Secret matter/)
        assert.deepEqual((await getMatterThread(store, 'user_b', other.id))?.messages, [])

        const empty = await POST(new Request('http://localhost/api/matters/' + own.id + '/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: '   ' }),
        }), { params: Promise.resolve({ matterId: own.id }) })
        assert.equal(empty.status, 400)
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

  it('names the Concierge follow-up and does not call a model', () => {
    const source = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../../app/api/matters/[matterId]/messages/route.ts'),
      'utf8',
    )
    assert.match(source, /TODO\(G-01 Concierge\)/)
    assert.match(source, /role: 'user'/)
    assert.doesNotMatch(source, /generateText|streamText|openai|CHATLEGAL_OM_MODEL/)
  })
})
