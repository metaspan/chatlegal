import { NextResponse } from 'next/server'
import { isLiteLLMEnabled } from '@/lib/llm/config'
import { CONCIERGE_REPLY_FAILED, streamConciergeReply } from '@/lib/llm/concierge-reply'
import { MATTER_STREAM_CONTENT_TYPE, type MatterStreamEvent } from '@/lib/matters/chat-stream'
import { MatterMessageError, parseMatterMessageBody } from '@/lib/matters/message'
import { appendMatterMessage, getMatterStore, type MatterStore } from '@/lib/matters/store'
import { requireConsumerSession } from '@/lib/session-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ matterId: string }> }

/**
 * Stores the signed-in user's message on their matter thread (`clerk:<userId>`).
 *
 * LiteLLM off (no base URL and key): one JSON reply, 201, no model is called.
 * That is the F-04 / D-03 gate style: the proxy is a key-gated service.
 *
 * LiteLLM on: the same append, then the Concierge reply streams back as
 * newline-delimited JSON events (lib/matters/chat-stream.ts). The reply is
 * stored on the thread through the same store helper. The outbound model id
 * resolves server-side in lib/llm (the Small class label maps to the
 * Concierge alias there, not here).
 *
 * TODO(G-01 Concierge): ask_user cards, tools, and protocol packs come from
 * the model. This route only streams plain text for G-00.
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await requireConsumerSession()
  const { matterId } = await context.params
  try {
    const text = parseMatterMessageBody(await request.text())
    const store = await getMatterStore()
    const message = await appendMatterMessage(store, session.userId, matterId, {
      role: 'user',
      text,
    })
    if (!message) return NextResponse.json({ error: 'Chat not found.' }, { status: 404 })
    if (!isLiteLLMEnabled()) return NextResponse.json({ message }, { status: 201 })
    return new Response(matterReplyStream(store, session.userId, matterId, text, message), {
      status: 201,
      headers: {
        'content-type': `${MATTER_STREAM_CONTENT_TYPE}; charset=utf-8`,
        'cache-control': 'no-store',
        'x-accel-buffering': 'no',
      },
    })
  } catch (error) {
    if (error instanceof MatterMessageError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('save matter message failed', error)
    return NextResponse.json({ error: 'That message could not be saved.' }, { status: 500 })
  }
}

/**
 * The events for one send, one JSON object per line: the stored user
 * message, the reply deltas, then the stored assistant message. A model that
 * cannot be reached is one error event: the person's message is already
 * stored, so the send still counted.
 */
function matterReplyStream(
  store: MatterStore,
  userId: string,
  matterId: string,
  userText: string,
  userMessage: Awaited<ReturnType<typeof appendMatterMessage>>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const line = (event: MatterStreamEvent) => encoder.encode(`${JSON.stringify(event)}\n`)
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (userMessage) controller.enqueue(line({ type: 'user', message: userMessage }))
        for await (const event of streamConciergeReply({ store, userId, matterId, userText })) {
          controller.enqueue(line(event))
        }
      } catch (error) {
        console.error('matter reply stream failed', error)
        controller.enqueue(line({ type: 'error', message: CONCIERGE_REPLY_FAILED }))
      } finally {
        controller.close()
      }
    },
  })
}
