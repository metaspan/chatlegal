import { NextResponse } from 'next/server'
import { MatterWidgetError, parseJsonObject } from '@/lib/matters/ask-choice'
import { presentStoredMatterMessage } from '@/lib/matters/message'
import { answerAskChoice, getMatterStore } from '@/lib/matters/store'
import { requireConsumerSession } from '@/lib/session-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ matterId: string; toolCallId: string }> }

/**
 * Stores one pick for an askChoice card on the signed-in user's matter.
 * A card that already has an answer is refused and returned unchanged.
 * TODO(G-01 Concierge): pass `{ widget, version, answer }` back to the run.
 * This route does not call a model.
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await requireConsumerSession()
  const { matterId, toolCallId } = await context.params
  try {
    const answer = parseJsonObject(await request.text(), 'That answer is too large.')
    const result = await answerAskChoice(await getMatterStore(), session.userId, matterId, toolCallId, answer)
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
    return NextResponse.json({ message: presentStoredMatterMessage(result.message) })
  } catch (error) {
    if (error instanceof MatterWidgetError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('answer askChoice failed', error)
    return NextResponse.json({ error: 'That answer could not be saved.' }, { status: 500 })
  }
}
