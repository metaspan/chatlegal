import { NextResponse } from 'next/server'
import { isLiteLLMEnabled } from '@/lib/llm/config'
import { CONCIERGE_REPLY_FAILED } from '@/lib/llm/concierge-reply'
import { streamConciergeTurn } from '@/lib/llm/concierge-agent'
import { getSharedTaskRunnerQueue } from '@/lib/llm/task-runner'
import { MatterWidgetError, parseJsonObject } from '@/lib/matters/ask-choice'
import { MATTER_STREAM_CONTENT_TYPE, type MatterStreamEvent } from '@/lib/matters/chat-stream'
import { presentStoredMatterMessage } from '@/lib/matters/message'
import { appendFirstTurnContinuation } from '@/lib/matters/seed-first-turn'
import { answerAskChoice, getMatterStore, type MatterStore } from '@/lib/matters/store'
import type { MatterMessage } from '@/lib/matters/types'
import { requireConsumerSession } from '@/lib/session-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ matterId: string; toolCallId: string }> }

/**
 * Stores one pick for an askChoice card on the signed-in user's matter.
 * A card that already has an answer is refused and returned unchanged.
 *
 * A first-turn card also stores a short templated note (policy-locked copy,
 * no model). A card the Concierge asked for (G-01) resumes the run instead:
 * when LiteLLM is on the answer is stored as the card's tool result
 * `{ widget, version, answer }`, and the Concierge turn continues over the
 * same NDJSON protocol the messages route uses. The first event is the
 * stored, answered card (the same body the JSON reply carries); the rest
 * are the continued reply's delta, assistant, reset, and error events.
 * When LiteLLM is off the JSON reply is unchanged from before G-01: no
 * model is called.
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await requireConsumerSession()
  const { matterId, toolCallId } = await context.params
  try {
    const answer = parseJsonObject(await request.text(), 'That answer is too large.')
    const store = await getMatterStore()
    const result = await answerAskChoice(store, session.userId, matterId, toolCallId, answer)
    if (!result.ok && result.reason === 'missing') {
      return NextResponse.json({ error: 'That question was not found.' }, { status: 404 })
    }
    if (!result.ok && result.reason === 'invalid') {
      return NextResponse.json(
        { error: 'That answer does not fit this question.', issues: result.issues },
        { status: 400 },
      )
    }
    if (!result.ok && result.reason === 'answered') {
      return NextResponse.json(
        {
          error: 'This question has already been answered.',
          message: presentStoredMatterMessage(result.message),
        },
        { status: 409 },
      )
    }
    if (!result.ok) return NextResponse.json({ error: 'That answer could not be saved.' }, { status: 400 })
    let followUp: MatterMessage | null = null
    try {
      followUp = await appendFirstTurnContinuation(store, session.userId, matterId, result.message)
    } catch (error) {
      console.error('first turn note failed', error)
    }
    if (!followUp && isLiteLLMEnabled()) {
      // A card the Concierge asked for: the stored tool result resumes it.
      return new Response(
        conciergeResumeStream(store, session.userId, matterId, result.message),
        {
          status: 200,
          headers: {
            'content-type': `${MATTER_STREAM_CONTENT_TYPE}; charset=utf-8`,
            'cache-control': 'no-store',
            'x-accel-buffering': 'no',
          },
        },
      )
    }
    return NextResponse.json({
      message: presentStoredMatterMessage(result.message),
      ...(followUp ? { followUp: presentStoredMatterMessage(followUp) } : {}),
    })
  } catch (error) {
    if (error instanceof MatterWidgetError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('answer askChoice failed', error)
    return NextResponse.json({ error: 'That answer could not be saved.' }, { status: 500 })
  }
}

/**
 * The events for one resumed Concierge turn: the stored answered card
 * first (so the pane can settle the card even if the model then fails),
 * then the continued reply. The pick is already stored when this starts;
 * a router failure afterwards is one error event, never a lost answer.
 */
function conciergeResumeStream(
  store: MatterStore,
  userId: string,
  matterId: string,
  answered: MatterMessage,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const line = (event: MatterStreamEvent) => encoder.encode(`${JSON.stringify(event)}\n`)
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(line({ type: 'assistant', message: presentStoredMatterMessage(answered) }))
        for await (const event of streamConciergeTurn({
          store,
          userId,
          matterId,
          // G-02: the resumed turn may also hand off, and it is a natural
          // place to narrate a background result that finished meanwhile.
          taskRunner: { queue: getSharedTaskRunnerQueue() },
        })) {
          controller.enqueue(line(event))
        }
      } catch (error) {
        console.error('concierge resume stream failed', error)
        controller.enqueue(line({ type: 'error', message: CONCIERGE_REPLY_FAILED }))
      } finally {
        controller.close()
      }
    },
  })
}
