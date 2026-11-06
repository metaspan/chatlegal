import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  LiteLLMUnavailableError,
  MIN_VISIBLE_TOKENS,
  chatCompletion,
  streamChatCompletion,
} from './client.ts'
import { DEFAULT_SESSION_HEADER, type LiteLLMConfig } from './config.ts'

const config: LiteLLMConfig = {
  baseUrl: 'http://192.168.10.181:4000/v1',
  apiKey: 'sk-secret-never-shown',
  conciergeModel: 'chatlegal-concierge',
  taskRunnerModel: 'chatlegal-taskrunner',
  sessionHeader: DEFAULT_SESSION_HEADER,
}

const baseRequest = {
  model: 'chatlegal-concierge',
  messages: [
    { role: 'system' as const, content: 'Be brief.' },
    { role: 'user' as const, content: 'My landlord locked me out.' },
  ],
  sessionId: 'matter-1',
}

type Call = { url: string; init: RequestInit }

function sseResponse(lines: string[]): Response {
  return new Response(lines.join('\n'), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

function deltaChunk(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`
}

async function collect(generator: AsyncGenerator<string>): Promise<string[]> {
  const parts: string[] = []
  for await (const part of generator) parts.push(part)
  return parts
}

describe('LiteLLM client (G-00)', () => {
  it('posts an OpenAI-shaped streaming request with the Bearer key and the stickiness header', async () => {
    const calls: Call[] = []
    const fetchImpl = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return sseResponse([deltaChunk('Hello '), deltaChunk('there.'), 'data: [DONE]', ''])
    }) as unknown as typeof fetch
    const parts = await collect(streamChatCompletion(config, { ...baseRequest, maxTokens: 512 }, fetchImpl))
    assert.equal(parts.join(''), 'Hello there.')
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'http://192.168.10.181:4000/v1/chat/completions')
    const headers = calls[0].init.headers as Record<string, string>
    assert.equal(headers.authorization, 'Bearer sk-secret-never-shown')
    assert.equal(headers[DEFAULT_SESSION_HEADER], 'matter-1')
    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>
    assert.equal(body.model, 'chatlegal-concierge')
    assert.equal(body.stream, true)
    assert.equal(body.max_tokens, 512)
    assert.deepEqual(body.messages, baseRequest.messages)
    assert.equal(calls[0].init.method, 'POST')
  })

  it('floors max_tokens at the visible minimum for the TaskRunner aliases', async () => {
    const calls: Call[] = []
    const fetchImpl = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return sseResponse(['data: [DONE]'])
    }) as unknown as typeof fetch
    await collect(streamChatCompletion(config, { ...baseRequest, maxTokens: 8 }, fetchImpl))
    const body = JSON.parse(String(calls[0].init.body)) as { max_tokens: number }
    assert.equal(body.max_tokens, MIN_VISIBLE_TOKENS)
  })

  it('skips blank lines, comments, malformed chunks, and stops at the DONE marker', async () => {
    const fetchImpl = (async () =>
      sseResponse([
        ': ping',
        '',
        'data: not json',
        deltaChunk('One'),
        'data: {"choices":[{"delta":{}}]}',
        deltaChunk('Two'),
        'data: [DONE]',
        deltaChunk('never shown'),
      ])) as unknown as typeof fetch
    const parts = await collect(streamChatCompletion(config, baseRequest, fetchImpl))
    assert.deepEqual(parts, ['One', 'Two'])
  })

  it('reassembles a chunk split across reads', async () => {
    const payload = new TextEncoder().encode(`${deltaChunk('split me')}\n`)
    const first = payload.slice(0, 12)
    const rest = payload.slice(12)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(first)
        controller.enqueue(rest)
        controller.close()
      },
    })
    const fetchImpl = (async () =>
      new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })) as unknown as typeof fetch
    const parts = await collect(streamChatCompletion(config, baseRequest, fetchImpl))
    assert.equal(parts.join(''), 'split me')
  })

  it('returns the message text from a non-streamed completion', async () => {
    const calls: Call[] = []
    const fetchImpl = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'Ask the council in writing.' } }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }) as unknown as typeof fetch
    const text = await chatCompletion(config, { ...baseRequest, maxTokens: 256 }, fetchImpl)
    assert.equal(text, 'Ask the council in writing.')
    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>
    assert.equal(body.stream, false)
    assert.equal(body.max_tokens, 256)
  })

  it('throws an unavailable error without leaking the key on a bad status', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch
    await assert.rejects(
      () => chatCompletion(config, baseRequest, fetchImpl),
      (error: unknown) => {
        assert.ok(error instanceof LiteLLMUnavailableError)
        assert.doesNotMatch(String(error), /sk-secret-never-shown/)
        return true
      },
    )
    await assert.rejects(
      async () => collect(streamChatCompletion(config, baseRequest, fetchImpl)),
      LiteLLMUnavailableError,
    )
  })

  it('throws an unavailable error when the endpoint cannot be reached', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    await assert.rejects(() => chatCompletion(config, baseRequest, fetchImpl), LiteLLMUnavailableError)
  })

  it('does not send a stickiness header when no session is given', async () => {
    const calls: Call[] = []
    const fetchImpl = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch
    const { sessionId: _omit, ...withoutSession } = baseRequest
    await chatCompletion(config, withoutSession, fetchImpl)
    const headers = calls[0].init.headers as Record<string, string>
    assert.equal(headers[DEFAULT_SESSION_HEADER], undefined)
  })
})
