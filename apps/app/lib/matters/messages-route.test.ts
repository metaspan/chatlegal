import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withProcessEnvLock } from '../process-env-lock.ts'
import { createMatter, disconnectMatterStore, getMatterStore, getMatterThread } from './store.ts'

const LITELLM_KEYS = [
  'CHATLEGAL_LITELLM_BASE_URL',
  'CHATLEGAL_LITELLM_API_KEY',
  'CHATLEGAL_CONCIERGE_MODEL',
  'CHATLEGAL_TASKRUNNER_MODEL',
  'CHATLEGAL_LITELLM_SESSION_HEADER',
] as const

function sse(lines: string[]): Response {
  return new Response(lines.join('\n'), { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

function deltaChunk(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`
}

describe('matter message route', () => {
  it('stores the signed-in user message and hides another user', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-message-route-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousSession = process.env.CHATLEGAL_TEST_SESSION
      const previousLiteLLM = new Map(LITELLM_KEYS.map((key) => [key, process.env[key]]))
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_TEST_SESSION = 'signed-in'
      delete process.env.CHATLEGAL_OM_ENABLED
      delete process.env.CHATLEGAL_OM_MODEL
      for (const key of LITELLM_KEYS) delete process.env[key]
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
        // LiteLLM is off: one JSON body, no stream, no model call.
        assert.match(saved.headers.get('content-type') ?? '', /application\/json/)
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
        for (const [key, value] of previousLiteLLM) {
          if (value === undefined) delete process.env[key]
          else process.env[key] = value
        }
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it('streams the Concierge reply when LiteLLM is on, and stores it once', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-message-stream-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousSession = process.env.CHATLEGAL_TEST_SESSION
      const previousLiteLLM = new Map(LITELLM_KEYS.map((key) => [key, process.env[key]]))
      const originalFetch = globalThis.fetch
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_TEST_SESSION = 'signed-in'
      delete process.env.CHATLEGAL_OM_ENABLED
      delete process.env.CHATLEGAL_OM_MODEL
      process.env.CHATLEGAL_LITELLM_BASE_URL = 'http://127.0.0.1:9/v1'
      process.env.CHATLEGAL_LITELLM_API_KEY = 'sk-test-value'
      for (const key of ['CHATLEGAL_CONCIERGE_MODEL', 'CHATLEGAL_TASKRUNNER_MODEL', 'CHATLEGAL_LITELLM_SESSION_HEADER'] as const) {
        delete process.env[key]
      }
      await disconnectMatterStore()
      try {
        const { POST } = await import('../../app/api/matters/[matterId]/messages/route.ts')
        const store = await getMatterStore()
        const own = await createMatter(store, 'user_test', { title: 'Deposit' })

        const calls: { url: string; init: RequestInit }[] = []
        globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
          calls.push({ url: String(url), init: init ?? {} })
          return sse([deltaChunk('Ask the landlord '), deltaChunk('in writing.'), 'data: [DONE]'])
        }) as unknown as typeof fetch

        const response = await POST(new Request('http://localhost/api/matters/' + own.id + '/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: 'My landlord kept my deposit.' }),
        }), { params: Promise.resolve({ matterId: own.id }) })
        assert.equal(response.status, 201)
        assert.match(response.headers.get('content-type') ?? '', /application\/x-ndjson/)
        const raw = await response.text()
        const events = raw
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line) as { type: string; text?: string; message?: { role?: string; text?: string } })

        assert.deepEqual(
          events.map((event) => event.type),
          ['user', 'delta', 'delta', 'assistant'],
        )
        assert.equal(events[0].message?.role, 'user')
        assert.equal(events[0].message?.text, 'My landlord kept my deposit.')
        assert.equal(events[1].text, 'Ask the landlord ')
        assert.equal(events[3].message?.role, 'assistant')
        assert.equal(events[3].message?.text, 'Ask the landlord in writing.')

        // One outbound call, to the router, as the Concierge alias, sticky to the matter.
        assert.equal(calls.length, 1)
        assert.equal(calls[0].url, 'http://127.0.0.1:9/v1/chat/completions')
        const headers = calls[0].init.headers as Record<string, string>
        assert.equal(headers.authorization, 'Bearer sk-test-value')
        assert.equal(headers['x-litellm-session-id'], own.id)
        const outbound = JSON.parse(String(calls[0].init.body)) as {
          model: string
          stream: boolean
          messages: { role: string; content: string }[]
        }
        assert.equal(outbound.model, 'chatlegal-concierge')
        assert.equal(outbound.stream, true)
        assert.equal(outbound.messages[0].role, 'system')
        assert.match(outbound.messages[0].content, /not a solicitor/i)

        // The reply is stored once on the thread.
        const thread = await getMatterThread(store, 'user_test', own.id)
        assert.deepEqual(thread?.messages.map((message) => message.role), ['user', 'assistant'])
        assert.equal(thread?.messages[1].text, 'Ask the landlord in writing.')
      } finally {
        globalThis.fetch = originalFetch
        await disconnectMatterStore()
        if (previousDb === undefined) delete process.env.CHATLEGAL_MATTERS_DB
        else process.env.CHATLEGAL_MATTERS_DB = previousDb
        if (previousSession === undefined) delete process.env.CHATLEGAL_TEST_SESSION
        else process.env.CHATLEGAL_TEST_SESSION = previousSession
        for (const [key, value] of previousLiteLLM) {
          if (value === undefined) delete process.env[key]
          else process.env[key] = value
        }
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it('keeps the model call behind the gate and leaves the G-01 note in place', () => {
    const source = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../../app/api/matters/[matterId]/messages/route.ts'),
      'utf8',
    )
    assert.match(source, /TODO\(G-01 Concierge\)/)
    assert.match(source, /role: 'user'/)
    // No direct model SDK in the route: the call lives behind the gate in lib/llm.
    assert.doesNotMatch(source, /generateText|streamText|openai|CHATLEGAL_OM_MODEL/)
    // Off is the default: the route checks the gate before any stream.
    assert.match(source, /isLiteLLMEnabled\(\)/)
  })
})
