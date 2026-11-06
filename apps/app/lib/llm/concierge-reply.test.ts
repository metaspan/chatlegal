import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { appendMatterMessage, createMatter, createMatterStore, getMatterThread, type MatterStore } from '../matters/store.ts'
import type { MatterMessage } from '../matters/types.ts'
import { CONCIERGE_REPLY_FAILED, conversationMessages, streamConciergeReply } from './concierge-reply.ts'

const LITELLM_ENV = {
  CHATLEGAL_LITELLM_BASE_URL: 'http://127.0.0.1:9/v1',
  CHATLEGAL_LITELLM_API_KEY: 'sk-test-value',
}

type Call = { url: string; init: RequestInit }

function sse(lines: string[]): Response {
  return new Response(lines.join('\n'), { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

function deltaChunk(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`
}

function matterMessage(id: string, role: 'user' | 'assistant', text: string): MatterMessage {
  return { id, role, text, createdAt: new Date().toISOString() }
}

/** One throwaway file store per case. Close it in the case's finally block. */
async function openStore(): Promise<{ store: MatterStore; close: () => Promise<void> }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-concierge-reply-'))
  const store = await createMatterStore(`file:${path.join(dir, 'matters.db')}`, { env: {} })
  return {
    store,
    close: async () => {
      await store.close()
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

async function collectReply(input: {
  store: MatterStore
  userId: string
  matterId: string
  userText: string
  env: NodeJS.ProcessEnv
  fetchImpl: typeof fetch
}): Promise<{ type: string; text?: string; message?: MatterMessage }[]> {
  const events: { type: string; text?: string; message?: MatterMessage }[] = []
  for await (const event of streamConciergeReply(input)) {
    events.push(event as { type: string; text?: string; message?: MatterMessage })
  }
  return events
}

describe('conversationMessages (G-00)', () => {
  it('sends the system prompt first and the sent text last', () => {
    const messages = conversationMessages(
      [matterMessage('a', 'assistant', 'ChatLegal is not a solicitor.'), matterMessage('u', 'user', 'My deposit?')],
      'And the deadline?',
    )
    assert.equal(messages[0].role, 'system')
    assert.match(messages[0].content, /not a solicitor/)
    assert.deepEqual(messages.slice(1), [
      { role: 'assistant', content: 'ChatLegal is not a solicitor.' },
      { role: 'user', content: 'My deposit?' },
      { role: 'user', content: 'And the deadline?' },
    ])
  })

  it('does not repeat the sent text when the thread already ends on it', () => {
    const sent = matterMessage('u2', 'user', 'Same words')
    const messages = conversationMessages([matterMessage('u1', 'user', 'First'), sent], 'Same words')
    assert.deepEqual(messages.slice(1), [
      { role: 'user', content: 'First' },
      { role: 'user', content: 'Same words' },
    ])
  })

  it('drops card-only messages and keeps the newest twelve turns', () => {
    const history: MatterMessage[] = []
    for (let index = 0; index < 20; index += 1) {
      history.push(matterMessage(`t${index}`, index % 2 === 0 ? 'user' : 'assistant', `Turn ${index}`))
      history.push(matterMessage(`c${index}`, 'assistant', '   '))
    }
    const messages = conversationMessages(history, 'What now?')
    // System prompt, twelve kept turns, then the text just sent.
    assert.equal(messages.length, 14)
    assert.deepEqual(messages.slice(1), [
      { role: 'user', content: 'Turn 8' },
      { role: 'assistant', content: 'Turn 9' },
      { role: 'user', content: 'Turn 10' },
      { role: 'assistant', content: 'Turn 11' },
      { role: 'user', content: 'Turn 12' },
      { role: 'assistant', content: 'Turn 13' },
      { role: 'user', content: 'Turn 14' },
      { role: 'assistant', content: 'Turn 15' },
      { role: 'user', content: 'Turn 16' },
      { role: 'assistant', content: 'Turn 17' },
      { role: 'user', content: 'Turn 18' },
      { role: 'assistant', content: 'Turn 19' },
      { role: 'user', content: 'What now?' },
    ])
  })
})

describe('streamConciergeReply (G-00)', () => {
  it('off means no events and no model call', async () => {
    const { store, close } = await openStore()
    try {
      let called = 0
      const fetchImpl = (async () => {
        called += 1
        return sse([deltaChunk('never'), 'data: [DONE]'])
      }) as unknown as typeof fetch
      const events = await collectReply({
        store,
        userId: 'user_test',
        matterId: 'anything',
        userText: 'Hello',
        env: {},
        fetchImpl,
      })
      assert.deepEqual(events, [])
      assert.equal(called, 0)
    } finally {
      await close()
    }
  })

  it('streams the deltas, stores the reply once, and yields the stored message', async () => {
    const { store, close } = await openStore()
    try {
      const matter = await createMatter(store, 'user_test', { title: 'Deposit' })
      const user = await appendMatterMessage(store, 'user_test', matter.id, {
        role: 'user',
        text: 'My landlord kept my deposit.',
      })
      assert.ok(user)
      const calls: Call[] = []
      const fetchImpl = (async (url: unknown, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} })
        return sse([deltaChunk('I am sorry '), deltaChunk('to hear that.'), 'data: [DONE]'])
      }) as unknown as typeof fetch
      const events = await collectReply({
        store,
        userId: 'user_test',
        matterId: matter.id,
        userText: 'My landlord kept my deposit.',
        env: LITELLM_ENV,
        fetchImpl,
      })
      assert.deepEqual(
        events.map((event) => event.type),
        ['delta', 'delta', 'assistant'],
      )
      assert.equal(events[0].text, 'I am sorry ')
      assert.equal(events[2].message?.role, 'assistant')
      assert.equal(events[2].message?.text, 'I am sorry to hear that.')
      assert.equal(calls.length, 1)
      assert.equal(calls[0].url, 'http://127.0.0.1:9/v1/chat/completions')
      const headers = calls[0].init.headers as Record<string, string>
      assert.equal(headers.authorization, 'Bearer sk-test-value')
      assert.equal(headers['x-litellm-session-id'], matter.id)
      const body = JSON.parse(String(calls[0].init.body)) as {
        model: string
        stream: boolean
        max_tokens: number
        messages: { role: string; content: string }[]
      }
      assert.equal(body.model, 'chatlegal-concierge')
      assert.equal(body.stream, true)
      assert.ok(body.max_tokens >= 64)
      assert.equal(body.messages[0].role, 'system')
      assert.equal(body.messages.at(-1)?.role, 'user')
      assert.equal(body.messages.at(-1)?.content, 'My landlord kept my deposit.')
      const thread = await getMatterThread(store, 'user_test', matter.id)
      assert.deepEqual(thread?.messages.map((message) => message.role), ['user', 'assistant'])
      assert.equal(thread?.messages[1].text, 'I am sorry to hear that.')
    } finally {
      await close()
    }
  })

  it('yields one error event when the router cannot be reached and stores nothing', async () => {
    const { store, close } = await openStore()
    try {
      const matter = await createMatter(store, 'user_test', { title: 'Rent' })
      await appendMatterMessage(store, 'user_test', matter.id, { role: 'user', text: 'Rent was raised.' })
      const fetchImpl = (async () => {
        throw new TypeError('fetch failed')
      }) as unknown as typeof fetch
      const events = await collectReply({
        store,
        userId: 'user_test',
        matterId: matter.id,
        userText: 'Rent was raised.',
        env: LITELLM_ENV,
        fetchImpl,
      })
      assert.deepEqual(events, [{ type: 'error', message: CONCIERGE_REPLY_FAILED }])
      const thread = await getMatterThread(store, 'user_test', matter.id)
      assert.deepEqual(thread?.messages.map((message) => message.role), ['user'])
    } finally {
      await close()
    }
  })

  it('yields one error event when the reply is empty', async () => {
    const { store, close } = await openStore()
    try {
      const matter = await createMatter(store, 'user_test', { title: 'Notice' })
      await appendMatterMessage(store, 'user_test', matter.id, { role: 'user', text: 'A notice arrived.' })
      const fetchImpl = (async () => sse(['data: [DONE]'])) as unknown as typeof fetch
      const events = await collectReply({
        store,
        userId: 'user_test',
        matterId: matter.id,
        userText: 'A notice arrived.',
        env: LITELLM_ENV,
        fetchImpl,
      })
      assert.deepEqual(events, [{ type: 'error', message: CONCIERGE_REPLY_FAILED }])
      const thread = await getMatterThread(store, 'user_test', matter.id)
      assert.deepEqual(thread?.messages.map((message) => message.role), ['user'])
    } finally {
      await close()
    }
  })
})
