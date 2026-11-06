import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  LiteLLMUnavailableError,
  MIN_VISIBLE_TOKENS,
  chatCompletion,
  streamChatCompletion,
  streamChatTurn,
  toolResultMessage,
  type ChatMessage,
  type ChatTurnEvent,
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

/** A tool-call delta: id and name on the first piece, arguments after. */
function toolCallFirstChunk(id: string, name: string, argsStart: string, index = 0): string {
  return `data: ${JSON.stringify({
    choices: [{ delta: { tool_calls: [{ index, id, function: { name, arguments: argsStart } }] } }] as unknown[],
  })}`
}

function toolCallArgsChunk(argsFragment: string, index = 0): string {
  return `data: ${JSON.stringify({
    choices: [{ delta: { tool_calls: [{ index, function: { arguments: argsFragment } }] } }] as unknown[],
  })}`
}

async function collectTurn(generator: AsyncGenerator<ChatTurnEvent>): Promise<ChatTurnEvent[]> {
  const events: ChatTurnEvent[] = []
  for await (const event of generator) events.push(event)
  return events
}

describe('LiteLLM client tool calls (G-01)', () => {
  it('sends the offered functions in the OpenAI tools shape', async () => {
    const calls: Call[] = []
    const fetchImpl = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return sseResponse(['data: [DONE]'])
    }) as unknown as typeof fetch
    await collectTurn(
      streamChatTurn(config, {
        ...baseRequest,
        tools: [{ name: 'askChoice', description: 'Ask one structured question.', parameters: { type: 'object' } }],
      }, fetchImpl),
    )
    const body = JSON.parse(String(calls[0].init.body)) as {
      tools: { type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }[]
    }
    assert.equal(body.tools.length, 1)
    assert.equal(body.tools[0].type, 'function')
    assert.equal(body.tools[0].function.name, 'askChoice')
    assert.deepEqual(body.tools[0].function.parameters, { type: 'object' })
  })

  it('omits the tools key entirely when none are offered', async () => {
    const calls: Call[] = []
    const fetchImpl = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return sseResponse(['data: [DONE]'])
    }) as unknown as typeof fetch
    await collectTurn(streamChatTurn(config, baseRequest, fetchImpl))
    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>
    assert.equal('tools' in body, false)
  })

  it('yields content live and one complete tool call after the stream', async () => {
    const args = JSON.stringify({ question: 'Papers?', options: [{ id: 'letter', label: 'A letter' }, { id: 'court', label: 'Court papers' }] })
    const fetchImpl = (async () =>
      sseResponse([
        deltaChunk('One line. '),
        toolCallFirstChunk('call-9', 'askChoice', args.slice(0, 20)),
        toolCallArgsChunk(args.slice(20, 60)),
        toolCallArgsChunk(args.slice(60)),
        'data: {"choices":[{"delta":{}}]}',
        'data: [DONE]',
      ])) as unknown as typeof fetch
    const events = await collectTurn(streamChatTurn(config, baseRequest, fetchImpl))
    assert.deepEqual(events.slice(0, 1), [{ type: 'content', text: 'One line. ' }])
    const last = events.at(-1)
    assert.equal(last?.type, 'tool_calls')
    const calls = (last as { calls: { id: string; name: string; arguments: string }[] }).calls
    assert.equal(calls.length, 1)
    assert.equal(calls[0].id, 'call-9')
    assert.equal(calls[0].name, 'askChoice')
    assert.equal(calls[0].arguments, args)
    assert.deepEqual(JSON.parse(calls[0].arguments), JSON.parse(args))
  })

  it('keeps two indexed calls in order and drops a call with no name', async () => {
    const fetchImpl = (async () =>
      sseResponse([
        toolCallFirstChunk('call-a', 'askChoice', '{"a":1}'),
        toolCallFirstChunk('call-b', 'otherTool', '{"b":2}', 1),
        toolCallArgsChunk('{"tail":true}', 1),
        // Index 2 only ever carries argument pieces: no name to route by.
        toolCallArgsChunk('{"orphan":1}', 2),
        'data: [DONE]',
      ])) as unknown as typeof fetch
    const events = await collectTurn(streamChatTurn(config, baseRequest, fetchImpl))
    const calls = (events.at(-1) as { calls: { id: string; name: string; arguments: string }[] }).calls
    assert.deepEqual(
      calls.map((call) => [call.id, call.name, call.arguments]),
      [
        ['call-a', 'askChoice', '{"a":1}'],
        ['call-b', 'otherTool', '{"b":2}{"tail":true}'],
      ],
    )
  })

  it('drops tool calls that carry no name', async () => {
    const fetchImpl = (async () =>
      sseResponse([toolCallArgsChunk('{"orphan":true}', 0), deltaChunk('text only'), 'data: [DONE]'])) as unknown as typeof fetch
    const events = await collectTurn(streamChatTurn(config, baseRequest, fetchImpl))
    assert.deepEqual(events, [{ type: 'content', text: 'text only' }])
  })

  it('streamChatCompletion ignores tool calls and yields content only', async () => {
    const fetchImpl = (async () =>
      sseResponse([deltaChunk('Hello '), toolCallFirstChunk('call-x', 'askChoice', '{}'), 'data: [DONE]'])) as unknown as typeof fetch
    const parts: string[] = []
    for await (const part of streamChatCompletion(config, baseRequest, fetchImpl)) parts.push(part)
    assert.deepEqual(parts, ['Hello '])
  })

  it('serialises assistant tool calls and tool results in the OpenAI wire shape', async () => {
    const calls: Call[] = []
    const fetchImpl = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return sseResponse(['data: [DONE]'])
    }) as unknown as typeof fetch
    const messages: ChatMessage[] = [
      { role: 'system', content: 'Be brief.' },
      { role: 'user', content: 'Where?' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call-1', name: 'askChoice', arguments: '{"question":"Where?","options":[]}' }],
      },
      toolResultMessage('call-1', '{"widget":"askChoice","version":2,"answer":{"choice":"england"}}'),
      { role: 'user', content: 'England.' },
    ]
    await collectTurn(streamChatTurn(config, { ...baseRequest, messages }, fetchImpl))
    const body = JSON.parse(String(calls[0].init.body)) as { messages: Record<string, unknown>[] }
    assert.deepEqual(body.messages[0], { role: 'system', content: 'Be brief.' })
    assert.deepEqual(body.messages[2], {
      role: 'assistant',
      content: '',
      tool_calls: [
        { id: 'call-1', type: 'function', function: { name: 'askChoice', arguments: '{"question":"Where?","options":[]}' } },
      ],
    })
    assert.deepEqual(body.messages[3], {
      role: 'tool',
      tool_call_id: 'call-1',
      content: '{"widget":"askChoice","version":2,"answer":{"choice":"england"}}',
    })
    assert.deepEqual(body.messages[4], { role: 'user', content: 'England.' })
  })
})
