import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withProcessEnvLock } from '../process-env-lock.ts'
import { createMatter, disconnectMatterStore, getMatterStore, getMatterThread } from './store.ts'

describe('askChoice routes', () => {
  it('stores a card for the signed-in user and refuses a second answer', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-widget-route-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousSession = process.env.CHATLEGAL_TEST_SESSION
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_TEST_SESSION = 'signed-in'
      delete process.env.CHATLEGAL_OM_ENABLED
      delete process.env.CHATLEGAL_OM_MODEL
      await disconnectMatterStore()
      try {
        const { POST: createWidget } = await import('../../app/api/matters/[matterId]/widgets/route.ts')
        const { POST: answerWidget } = await import('../../app/api/matters/[matterId]/widgets/[toolCallId]/answer/route.ts')
        const store = await getMatterStore()
        const own = await createMatter(store, 'user_test', { title: 'Deposit' })
        const other = await createMatter(store, 'user_b', { title: 'Secret matter' })
        const props = {
          question: 'Which route fits this notice?',
          options: [
            { id: 'scheme', label: 'Deposit scheme' },
            { id: 'court', label: 'Court' },
          ],
        }

        const created = await createWidget(new Request('http://localhost/api/matters/' + own.id + '/widgets', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(props),
        }), { params: Promise.resolve({ matterId: own.id }) })
        assert.equal(created.status, 201)
        const body = (await created.json()) as { message?: { widget?: { toolCallId?: string; status?: string; question?: string } } }
        assert.equal(body.message?.widget?.status, 'pending')
        assert.equal(body.message?.widget?.question, 'Which route fits this notice?')
        const toolCallId = body.message?.widget?.toolCallId ?? ''
        assert.ok(toolCallId)

        const hidden = await createWidget(new Request('http://localhost/api/matters/' + other.id + '/widgets', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(props),
        }), { params: Promise.resolve({ matterId: other.id }) })
        assert.equal(hidden.status, 404)
        assert.deepEqual((await getMatterThread(store, 'user_b', other.id))?.messages, [])

        const answered = await answerWidget(new Request('http://localhost/api/matters/' + own.id + '/widgets/' + toolCallId + '/answer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ choice: 'scheme' }),
        }), { params: Promise.resolve({ matterId: own.id, toolCallId }) })
        assert.equal(answered.status, 200)
        const saved = (await answered.json()) as { message?: { widget?: { status?: string; answer?: { choice?: string } } } }
        assert.equal(saved.message?.widget?.status, 'answered')
        assert.equal(saved.message?.widget?.answer?.choice, 'scheme')

        const again = await answerWidget(new Request('http://localhost/api/matters/' + own.id + '/widgets/' + toolCallId + '/answer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ choice: 'court' }),
        }), { params: Promise.resolve({ matterId: own.id, toolCallId }) })
        assert.equal(again.status, 409)
        const locked = (await again.json()) as { message?: { widget?: { answer?: { choice?: string } } } }
        assert.equal(locked.message?.widget?.answer?.choice, 'scheme')
        assert.equal((await getMatterThread(store, 'user_test', own.id))?.messages[0]?.widget?.answer?.choice, 'scheme')

        const stranger = await answerWidget(new Request('http://localhost/api/matters/' + own.id + '/widgets/' + toolCallId + '/answer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ choice: 'court' }),
        }), { params: Promise.resolve({ matterId: other.id, toolCallId }) })
        assert.equal(stranger.status, 404)
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
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../app/api/matters/[matterId]/widgets')
    const source = fs.readFileSync(path.join(root, 'route.ts'), 'utf8')
      + fs.readFileSync(path.join(root, '[toolCallId]/answer/route.ts'), 'utf8')
    assert.match(source, /TODO\(G-01 Concierge\)/)
    assert.match(source, /requireConsumerSession/)
    assert.doesNotMatch(source, /generateText|streamText|openai|CHATLEGAL_OM_MODEL|LiteLLM/)
  })
})
