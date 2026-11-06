import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'path'
import { appendMatterMessage, createMatter, createMatterStore, getMatterThread, type MatterStore } from '../matters/store.ts'
import type { MatterAskChoice, MatterMessage } from '../matters/types.ts'
import { CONCIERGE_REPLY_FAILED } from './concierge-reply.ts'
import { agentConversationMessages, streamConciergeTurn } from './concierge-agent.ts'

const LITELLM_ENV = {
  CHATLEGAL_LITELLM_BASE_URL: 'http://127.0.0.1:9/v1',
  CHATLEGAL_LITELLM_API_KEY: '«redacted:sk-…»',
}

type Call = { url: string; init: RequestInit }

function sse(lines: string[]): Response {
  return new Response(lines.join('\n'), { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

function deltaChunk(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`
}

/** The OpenAI delta form: id and name on the first piece, arguments after. */
function toolCallChunks(id: string, name: string, argsJson: string): string[] {
  const pieces = [
    `data: ${JSON.stringify({
      choices: [{ delta: { tool_calls: [{ index: 0, id, function: { name, arguments: '' } }] } }] as unknown[],
    })}`,
  ]
  for (let at = 0; at < argsJson.length; at += 24) {
    pieces.push(
      `data: ${JSON.stringify({
        choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: argsJson.slice(at, at + 24) } }] } }] as unknown[],
      })}`,
    )
  }
  return pieces
}

const DONE = 'data: [DONE]'

const GOOD_CARD_PROPS = {
  question: 'Which part of the UK is this about?',
  detail: 'The rules differ by country, so the country matters.',
  options: [
    { id: 'england', label: 'England' },
    { id: 'wales', label: 'Wales' },
    { id: 'scotland', label: 'Scotland' },
    { id: 'northern-ireland', label: 'Northern Ireland' },
  ],
  recommended: 'england',
}

function matterMessage(id: string, role: 'user' | 'assistant', text: string): MatterMessage {
  return { id, role, text, createdAt: new Date().toISOString() }
}

function cardMessage(toolCallId: string, widget: Partial<MatterAskChoice>): MatterMessage {
  return {
    id: `card-${toolCallId}`,
    role: 'assistant',
    text: '',
    createdAt: new Date().toISOString(),
    widget: {
      toolCallId,
      name: 'askChoice',
      version: 2,
      question: 'Which part of the UK is this about?',
      options: [
        { id: 'england', label: 'England' },
        { id: 'wales', label: 'Wales' },
      ],
      multiSelect: false,
      minSelected: 1,
      maxSelected: 1,
      status: 'pending',
      ...widget,
    },
  }
}

/** One throwaway file store per case. Close it in the case's finally block. */
async function openStore(): Promise<{ store: MatterStore; close: () => Promise<void> }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-concierge-agent-'))
  const store = await createMatterStore(`file:${path.join(dir, 'matters.db')}`, { env: {} })
  return {
    store,
    close: async () => {
      await store.close()
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

async function collectTurn(input: {
  store: MatterStore
  userId: string
  matterId: string
  userText?: string
  env: NodeJS.ProcessEnv
  fetchImpl: typeof fetch
}): Promise<Record<string, unknown>[]> {
  const events: Record<string, unknown>[] = []
  for await (const event of streamConciergeTurn(input)) {
    events.push(event as unknown as Record<string, unknown>)
  }
  return events
}

describe('agentConversationMessages (G-01)', () => {
  it('sends the agent prompt and the plain turns', () => {
    const messages = agentConversationMessages(
      [matterMessage('a', 'assistant', 'Not a solicitor here.'), matterMessage('u', 'user', 'My deposit?')],
      'And the deadline?',
    )
    assert.equal(messages[0].role, 'system')
    assert.match(messages[0].content, /not a solicitor/i)
    // The agent contract rides on top of the G-00 voice.
    assert.match(messages[0].content, /askChoice tool/)
    assert.deepEqual(messages.slice(1), [
      { role: 'assistant', content: 'Not a solicitor here.' },
      { role: 'user', content: 'My deposit?' },
      { role: 'user', content: 'And the deadline?' },
    ])
  })

  it('replays an answered card as the assistant call and the stored tool result', () => {
    const answered = cardMessage('tc-1', { status: 'answered', answer: { choice: 'england' } })
    const messages = agentConversationMessages([matterMessage('u', 'user', 'Tenancy.'), answered])
    assert.equal(messages[1]?.role, 'user')
    const call = messages[2] as unknown as {
      role: string
      content: string
      toolCalls: { id: string; name: string; arguments: string }[]
    }
    assert.equal(call.role, 'assistant')
    assert.equal(call.content, '')
    assert.equal(call.toolCalls.length, 1)
    assert.equal(call.toolCalls[0].id, 'tc-1')
    assert.equal(call.toolCalls[0].name, 'askChoice')
    assert.match(call.toolCalls[0].arguments, /"question"/)
    const toolMessage = messages[3] as unknown as { role: string; toolCallId: string; content: string }
    assert.equal(toolMessage.role, 'tool')
    assert.equal(toolMessage.toolCallId, 'tc-1')
    assert.match(toolMessage.content, /"answer":\{"choice":"england"\}/)
    assert.match(toolMessage.content, /"widget":"askChoice"/)
    const callArgs = JSON.parse(call.toolCalls[0].arguments) as { widgetVersion: number; question: string }
    assert.equal(callArgs.widgetVersion, 2)
    assert.equal(callArgs.question, 'Which part of the UK is this about?')
  })

  it('replays a waiting card without inventing the person pick', () => {
    const waiting = cardMessage('tc-2', {})
    const messages = agentConversationMessages([waiting])
    const toolMessage = messages[2] as { role: string; content: string }
    assert.equal(toolMessage.role, 'tool')
    assert.match(toolMessage.content, /awaiting_answer/)
    assert.doesNotMatch(toolMessage.content, /"answer"/)
  })
})

describe('streamConciergeTurn (G-01)', () => {
  it('off means no events and no model call', async () => {
    const { store, close } = await openStore()
    try {
      let called = 0
      const fetchImpl = (async () => {
        called += 1
        return sse([deltaChunk('never'), DONE])
      }) as unknown as typeof fetch
      const events = await collectTurn({
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

  it('answers in plain text like G-00 when the model does not use the tool', async () => {
    const { store, close } = await openStore()
    try {
      const matter = await createMatter(store, 'user_test', { title: 'Deposit' })
      await appendMatterMessage(store, 'user_test', matter.id, { role: 'user', text: 'My landlord kept my deposit.' })
      const calls: Call[] = []
      const fetchImpl = (async (url: unknown, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} })
        return sse([deltaChunk('Ask the landlord '), deltaChunk('in writing.'), DONE])
      }) as unknown as typeof fetch
      const events = await collectTurn({
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
      assert.equal((events[2].message as MatterMessage).text, 'Ask the landlord in writing.')
      assert.equal(calls.length, 1)
      const body = JSON.parse(String(calls[0].init.body)) as {
        model: string
        tools?: { type: string; function: { name: string } }[]
        messages: { role: string; content: string }[]
      }
      assert.equal(body.model, 'chatlegal-concierge')
      assert.equal(body.tools?.[0]?.function?.name, 'askChoice')
      assert.equal(body.messages[0].role, 'system')
      assert.match(body.messages[0].content, /askChoice tool/)
      const thread = await getMatterThread(store, 'user_test', matter.id)
      assert.deepEqual(thread?.messages.map((message) => message.role), ['user', 'assistant'])
    } finally {
      await close()
    }
  })

  it('stores a narration line and the card the model asks for, through the C-04 path', async () => {
    const { store, close } = await openStore()
    try {
      const matter = await createMatter(store, 'user_test', { title: 'Housing' })
      await appendMatterMessage(store, 'user_test', matter.id, { role: 'user', text: 'My landlord locked me out.' })
      const calls: Call[] = []
      const fetchImpl = (async (url: unknown, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} })
        return sse([
          deltaChunk('Locked out is serious. '),
          deltaChunk('First, the place.'),
          ...toolCallChunks('call-1', 'askChoice', JSON.stringify(GOOD_CARD_PROPS)),
          DONE,
        ])
      }) as unknown as typeof fetch
      const events = await collectTurn({
        store,
        userId: 'user_test',
        matterId: matter.id,
        userText: 'My landlord locked me out.',
        env: LITELLM_ENV,
        fetchImpl,
      })
      assert.deepEqual(
        events.map((event) => event.type),
        ['delta', 'delta', 'assistant', 'assistant'],
      )
      const narration = events[2].message as MatterMessage
      const card = events[3].message as MatterMessage
      assert.equal(narration.text, 'Locked out is serious. First, the place.')
      assert.equal(narration.widget, undefined)
      assert.equal(card.role, 'assistant')
      assert.equal(card.widget?.name, 'askChoice')
      assert.equal(card.widget?.status, 'pending')
      assert.equal(card.widget?.question, GOOD_CARD_PROPS.question)
      assert.deepEqual(
        card.widget?.options.map((option) => option.id),
        ['england', 'wales', 'scotland', 'northern-ireland'],
      )
      assert.deepEqual(card.widget?.recommended, ['england'])

      // Both messages are on the thread, in order, and nothing shows tool internals.
      const thread = await getMatterThread(store, 'user_test', matter.id)
      assert.deepEqual(thread?.messages.map((message) => message.role), ['user', 'assistant', 'assistant'])
      assert.equal(thread?.messages[2].widget?.toolCallId, card.widget?.toolCallId)
      const shown = JSON.stringify(thread?.messages)
      assert.doesNotMatch(shown, /tool_calls|"arguments"/)

      // The card can be answered through the C-04 read path.
      const answered = thread?.messages.find((message) => message.widget)
      assert.ok(answered?.widget)
    } finally {
      await close()
    }
  })

  it('refuses an invalid card, resets the streamed copy, and lets the model answer in words', async () => {
    const { store, close } = await openStore()
    try {
      const matter = await createMatter(store, 'user_test', { title: 'Notice' })
      await appendMatterMessage(store, 'user_test', matter.id, { role: 'user', text: 'A notice arrived.' })
      const calls: Call[] = []
      const fetchImpl = (async (url: unknown, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} })
        if (calls.length === 1) {
          // One option only: the C-04 gate needs two.
          return sse([
            ...toolCallChunks('call-bad', 'askChoice', JSON.stringify({ question: 'Papers?', options: [{ id: 'a', label: 'A' }] })),
            DONE,
          ])
        }
        return sse([deltaChunk('Upload a photo of the notice if you can.'), DONE])
      }) as unknown as typeof fetch
      const events = await collectTurn({
        store,
        userId: 'user_test',
        matterId: matter.id,
        userText: 'A notice arrived.',
        env: LITELLM_ENV,
        fetchImpl,
      })
      assert.deepEqual(
        events.map((event) => event.type),
        ['reset', 'delta', 'assistant'],
      )
      assert.equal(calls.length, 2)
      // The retry carries the refused call and the host error result.
      const retry = JSON.parse(String(calls[1].init.body)) as {
        messages: { role: string; content?: string; tool_calls?: unknown[] }[]
      }
      const refused = retry.messages.at(-2)
      const result = retry.messages.at(-1)
      assert.equal(refused?.role, 'assistant')
      assert.ok(refused?.tool_calls)
      assert.equal(result?.role, 'tool')
      assert.match(result?.content ?? '', /invalid_props/)
      // Nothing invalid was stored.
      const thread = await getMatterThread(store, 'user_test', matter.id)
      assert.deepEqual(thread?.messages.map((message) => message.text), [
        'A notice arrived.',
        'Upload a photo of the notice if you can.',
      ])
      assert.equal(thread?.messages[1].widget, undefined)
    } finally {
      await close()
    }
  })

  it('one refused card after another ends in one error event and stores nothing', async () => {
    const { store, close } = await openStore()
    try {
      const matter = await createMatter(store, 'user_test', { title: 'Debt' })
      await appendMatterMessage(store, 'user_test', matter.id, { role: 'user', text: 'A collector called.' })
      let calls = 0
      const fetchImpl = (async () => {
        calls += 1
        return sse([...toolCallChunks(`call-${calls}`, 'askChoice', '{"not":"a card"}'), DONE])
      }) as unknown as typeof fetch
      const events = await collectTurn({
        store,
        userId: 'user_test',
        matterId: matter.id,
        userText: 'A collector called.',
        env: LITELLM_ENV,
        fetchImpl,
      })
      assert.equal(calls, 3)
      assert.deepEqual(
        events.map((event) => event.type),
        ['reset', 'reset', 'reset', 'error'],
      )
      assert.equal((events[3] as { message: string }).message, CONCIERGE_REPLY_FAILED)
      const thread = await getMatterThread(store, 'user_test', matter.id)
      assert.deepEqual(thread?.messages.map((message) => message.role), ['user'])
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
      const events = await collectTurn({
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

  it('yields one error event when the model says nothing and asks nothing', async () => {
    const { store, close } = await openStore()
    try {
      const matter = await createMatter(store, 'user_test', { title: 'Notice' })
      await appendMatterMessage(store, 'user_test', matter.id, { role: 'user', text: 'A notice arrived.' })
      const fetchImpl = (async () => sse([DONE])) as unknown as typeof fetch
      const events = await collectTurn({
        store,
        userId: 'user_test',
        matterId: matter.id,
        userText: 'A notice arrived.',
        env: LITELLM_ENV,
        fetchImpl,
      })
      assert.deepEqual(events, [{ type: 'error', message: CONCIERGE_REPLY_FAILED }])
    } finally {
      await close()
    }
  })
})
