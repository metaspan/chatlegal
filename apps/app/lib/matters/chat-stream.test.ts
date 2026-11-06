import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  iterateMatterStreamEvents,
  isMatterStreamResponse,
  messagesWithStreamingAssistant,
  messagesWithoutMessage,
  parseMatterStreamEvent,
} from './chat-stream.ts'
import type { MatterMessage } from './types.ts'

function stored(role: 'user' | 'assistant', text: string): MatterMessage {
  return { id: `m-${role}`, role, text, createdAt: '2026-11-06T09:00:00.000Z' }
}

function streamResponse(lines: string[], chunkAt?: number): Response {
  const bytes = new TextEncoder().encode(lines.join('\n'))
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (chunkAt === undefined) {
        controller.enqueue(bytes)
      } else {
        controller.enqueue(bytes.slice(0, chunkAt))
        controller.enqueue(bytes.slice(chunkAt))
      }
      controller.close()
    },
  })
  return new Response(stream, { status: 201, headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } })
}

async function collect(response: Response) {
  const events: unknown[] = []
  for await (const event of iterateMatterStreamEvents(response)) events.push(event)
  return events
}

describe('matter chat stream (G-00)', () => {
  it('recognises the stream by its content type', () => {
    assert.equal(isMatterStreamResponse(streamResponse([])), true)
    assert.equal(
      isMatterStreamResponse(new Response('{}', { headers: { 'content-type': 'application/json' } })),
      false,
    )
    assert.equal(isMatterStreamResponse(new Response('{}')), false)
  })

  it('reads the events in order and skips lines it does not understand', async () => {
    const events = await collect(
      streamResponse([
        JSON.stringify({ type: 'user', message: stored('user', 'Hello') }),
        'not json at all',
        JSON.stringify({ type: 'delta', text: 'Hi ' }),
        JSON.stringify({ type: 'delta' }),
        JSON.stringify({ type: 'delta', text: 'there.' }),
        JSON.stringify({ type: 'assistant', message: stored('assistant', 'Hi there.') }),
        '',
      ]),
    )
    assert.deepEqual(events, [
      { type: 'user', message: stored('user', 'Hello') },
      { type: 'delta', text: 'Hi ' },
      { type: 'delta', text: 'there.' },
      { type: 'assistant', message: stored('assistant', 'Hi there.') },
    ])
  })

  it('reassembles a line split across reads', async () => {
    const line = JSON.stringify({ type: 'delta', text: 'a line split in the middle' })
    const events = await collect(streamResponse([line], 20))
    assert.deepEqual(events, [{ type: 'delta', text: 'a line split in the middle' }])
  })

  it('rejects events with the wrong shape', () => {
    assert.equal(parseMatterStreamEvent('{"type":"delta","text":""}'), null)
    assert.equal(parseMatterStreamEvent('{"type":"assistant","message":{"role":"assistant"}}'), null)
    assert.equal(parseMatterStreamEvent('{"type":"user","message":{"id":"x","role":"tool","text":"x","createdAt":"y"}}'), null)
    assert.equal(parseMatterStreamEvent('{"type":"mystery"}'), null)
    assert.deepEqual(parseMatterStreamEvent('{"type":"error","message":"Nope."}'), {
      type: 'error',
      message: 'Nope.',
    })
  })

  it('grows one pending assistant copy while streaming, then drops it', () => {
    const before = [stored('user', 'Hello')]
    const once = messagesWithStreamingAssistant(before, 'local:a1', 'Hi ')
    assert.equal(once.length, 2)
    assert.equal(once[1].role, 'assistant')
    assert.equal(once[1].pending, true)
    assert.equal(once[1].text, 'Hi ')
    const twice = messagesWithStreamingAssistant(once, 'local:a1', 'Hi there.')
    assert.equal(twice.length, 2)
    assert.equal(twice[1].text, 'Hi there.')
    const cleared = messagesWithoutMessage(twice, 'local:a1')
    assert.deepEqual(cleared, before)
  })
})
