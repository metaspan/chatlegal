import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'path'
import { fileURLToPath } from 'node:url'
import { withProcessEnvLock } from '../process-env-lock.ts'
import { createMatter, disconnectMatterStore, getMatterStore, getMatterThread } from './store.ts'
import { seedMatterFirstTurn } from './seed-first-turn.ts'

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

/** Put the LiteLLM gate into the named state for one case, restored after. */
function applyLiteLLMEnv(on: boolean, restore: Map<string, string | undefined>): void {
  for (const key of LITELLM_KEYS) restore.set(key, process.env[key])
  for (const key of LITELLM_KEYS) delete process.env[key]
  if (on) {
    process.env.CHATLEGAL_LITELLM_BASE_URL = 'http://127.0.0.1:9/v1'
    process.env.CHATLEGAL_LITELLM_API_KEY = '«redacted:sk-…»'
  }
}

function restoreLiteLLMEnv(restore: Map<string, string | undefined>): void {
  for (const [key, value] of restore) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe('askChoice routes', () => {
  it('stores a card for the signed-in user and refuses a second answer', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-widget-route-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousSession = process.env.CHATLEGAL_TEST_SESSION
      const previousLiteLLM = new Map<string, string | undefined>()
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_TEST_SESSION = 'signed-in'
      delete process.env.CHATLEGAL_OM_ENABLED
      delete process.env.CHATLEGAL_OM_MODEL
      applyLiteLLMEnv(false, previousLiteLLM)
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
        restoreLiteLLMEnv(previousLiteLLM)
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it('names the Concierge follow-up and does not call a model directly from the routes', () => {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../app/api/matters/[matterId]/widgets')
    const createSource = fs.readFileSync(path.join(root, 'route.ts'), 'utf8')
    const answerSource = fs.readFileSync(path.join(root, '[toolCallId]/answer/route.ts'), 'utf8')
    const source = createSource + answerSource
    assert.match(source, /requireConsumerSession/)
    // The answer route resumes the run through the gated agent loop, not a direct SDK.
    assert.match(answerSource, /streamConciergeTurn/)
    assert.match(answerSource, /isLiteLLMEnabled\(\)/)
    assert.doesNotMatch(source, /generateText|streamText|openai|CHATLEGAL_OM_MODEL/)
  })

  it('resumes the Concierge when a model-issued card is answered, over the stream', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-widget-resume-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousSession = process.env.CHATLEGAL_TEST_SESSION
      const previousLiteLLM = new Map<string, string | undefined>()
      const originalFetch = globalThis.fetch
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_TEST_SESSION = 'signed-in'
      delete process.env.CHATLEGAL_OM_ENABLED
      delete process.env.CHATLEGAL_OM_MODEL
      applyLiteLLMEnv(true, previousLiteLLM)
      await disconnectMatterStore()
      try {
        const { POST: createWidget } = await import('../../app/api/matters/[matterId]/widgets/route.ts')
        const { POST: answerWidget } = await import('../../app/api/matters/[matterId]/widgets/[toolCallId]/answer/route.ts')
        const store = await getMatterStore()
        const own = await createMatter(store, 'user_test', { title: 'Deposit' })
        const props = {
          question: 'Has the deposit been protected?',
          options: [
            { id: 'yes', label: 'Yes, with a scheme' },
            { id: 'no', label: 'No, or I do not know' },
          ],
        }
        const created = await createWidget(new Request('http://localhost/api/matters/' + own.id + '/widgets', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(props),
        }), { params: Promise.resolve({ matterId: own.id }) })
        const body = (await created.json()) as { message?: { widget?: { toolCallId?: string } } }
        const toolCallId = body.message?.widget?.toolCallId ?? ''
        assert.ok(toolCallId)

        const calls: { url: string; init: RequestInit }[] = []
        globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
          calls.push({ url: String(url), init: init ?? {} })
          return sse([deltaChunk('No scheme means '), deltaChunk('there are rules to check.'), 'data: [DONE]'])
        }) as unknown as typeof fetch

        const answered = await answerWidget(new Request('http://localhost/api/matters/' + own.id + '/widgets/' + toolCallId + '/answer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ choice: 'no' }),
        }), { params: Promise.resolve({ matterId: own.id, toolCallId }) })
        assert.equal(answered.status, 200)
        assert.match(answered.headers.get('content-type') ?? '', /application\/x-ndjson/)
        const events = (await answered.text())
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line) as { type: string; message?: { role?: string; text?: string; widget?: { status?: string; answer?: { choice?: string } } } })
        assert.deepEqual(
          events.map((event) => event.type),
          ['assistant', 'delta', 'delta', 'assistant'],
        )
        // The first event is the stored, answered card, not the reaction.
        assert.equal(events[0].message?.widget?.status, 'answered')
        assert.equal(events[0].message?.widget?.answer?.choice, 'no')
        // The reaction is stored as its own assistant message.
        assert.equal(events.at(-1)?.message?.text, 'No scheme means there are rules to check.')

        // One resumed model call, sticky to the matter, carrying the tool result.
        assert.equal(calls.length, 1)
        assert.equal(calls[0].url, 'http://127.0.0.1:9/v1/chat/completions')
        const headers = calls[0].init.headers as Record<string, string>
        assert.equal(headers['x-litellm-session-id'], own.id)
        const outbound = JSON.parse(String(calls[0].init.body)) as {
          messages: { role: string; content?: string; tool_calls?: unknown[] }[]
        }
        const roles = outbound.messages.map((message) => message.role)
        assert.equal(roles.at(-2), 'assistant')
        assert.ok(outbound.messages.at(-2)?.tool_calls)
        assert.equal(roles.at(-1), 'tool')
        assert.match(outbound.messages.at(-1)?.content ?? '', /"answer":\{"choice":"no"\}/)

        // The card keeps the pick on the thread.
        const thread = await getMatterThread(store, 'user_test', own.id)
        const storedAnswer = thread?.messages[0].widget?.answer as { choice?: string } | undefined
        assert.equal(storedAnswer?.choice, 'no')
        assert.equal(thread?.messages.at(-1)?.text, 'No scheme means there are rules to check.')
      } finally {
        globalThis.fetch = originalFetch
        await disconnectMatterStore()
        if (previousDb === undefined) delete process.env.CHATLEGAL_MATTERS_DB
        else process.env.CHATLEGAL_MATTERS_DB = previousDb
        if (previousSession === undefined) delete process.env.CHATLEGAL_TEST_SESSION
        else process.env.CHATLEGAL_TEST_SESSION = previousSession
        restoreLiteLLMEnv(previousLiteLLM)
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it('keeps the scripted first-turn notes templated: no model on answer, even with the gate on', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-widget-first-turn-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousSession = process.env.CHATLEGAL_TEST_SESSION
      const previousLiteLLM = new Map<string, string | undefined>()
      const originalFetch = globalThis.fetch
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_TEST_SESSION = 'signed-in'
      delete process.env.CHATLEGAL_OM_ENABLED
      delete process.env.CHATLEGAL_OM_MODEL
      applyLiteLLMEnv(true, previousLiteLLM)
      await disconnectMatterStore()
      try {
        const { POST: answerWidget } = await import('../../app/api/matters/[matterId]/widgets/[toolCallId]/answer/route.ts')
        const store = await getMatterStore()
        const own = await createMatter(store, 'user_test', { title: 'Housing' })
        const seeded = await seedMatterFirstTurn(store, 'user_test', own.id)
        assert.ok(seeded)
        const where = seeded.find((message) => message.widget?.question === 'Where is this happening?')
        const toolCallId = where?.widget?.toolCallId ?? ''
        assert.ok(toolCallId)

        let called = 0
        globalThis.fetch = (async () => {
          called += 1
          return sse([deltaChunk('never'), 'data: [DONE]'])
        }) as unknown as typeof fetch

        const answered = await answerWidget(new Request('http://localhost/api/matters/' + own.id + '/widgets/' + toolCallId + '/answer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ choice: 'england' }),
        }), { params: Promise.resolve({ matterId: own.id, toolCallId }) })
        assert.equal(answered.status, 200)
        // JSON, not the stream: the templated note path never runs the model.
        assert.match(answered.headers.get('content-type') ?? '', /application\/json/)
        const body = (await answered.json()) as { message?: unknown; followUp?: { text?: string } }
        assert.match(body.followUp?.text ?? '', /England/)
        assert.equal(called, 0)
      } finally {
        globalThis.fetch = originalFetch
        await disconnectMatterStore()
        if (previousDb === undefined) delete process.env.CHATLEGAL_MATTERS_DB
        else process.env.CHATLEGAL_MATTERS_DB = previousDb
        if (previousSession === undefined) delete process.env.CHATLEGAL_TEST_SESSION
        else process.env.CHATLEGAL_TEST_SESSION = previousSession
        restoreLiteLLMEnv(previousLiteLLM)
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })
  })
})
