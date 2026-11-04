import { NextResponse } from 'next/server'
import { MatterWidgetError, parseJsonObject } from '@/lib/matters/ask-choice'
import { presentStoredMatterMessage } from '@/lib/matters/message'
import { appendFirstTurnContinuation } from '@/lib/matters/seed-first-turn'
import { answerAskChoice, getMatterStore } from '@/lib/matters/store'
import type { MatterMessage } from '@/lib/matters/types'
import { requireConsumerSession } from '@/lib/session-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ matterId: string; toolCallId: string }> }

/**
 * Stores one pick for an askChoice card on the signed-in user's matter.
 * A card that already has an answer is refused and returned unchanged.
 * A first-turn card also stores a short templated note. Other cards do not.
 * TODO(G-01 Concierge): pass `{ widget, version, answer }` back to the run.
 * This route does not call a model.
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
