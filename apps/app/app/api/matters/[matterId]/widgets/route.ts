import { NextResponse } from 'next/server'
import { MatterWidgetError, parseAskChoiceProps, parseJsonObject } from '@/lib/matters/ask-choice'
import { presentStoredMatterMessage } from '@/lib/matters/message'
import { appendAskChoice, getMatterStore } from '@/lib/matters/store'
import { requireConsumerSession } from '@/lib/session-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ matterId: string }> }

/**
 * Stores an askChoice card on the signed-in user's matter (`clerk:<userId>`).
 * This is the stub until a model can ask. TODO(G-01 Concierge): call
 * appendAskChoice from the model tool instead of this route.
 * This route does not call a model.
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await requireConsumerSession()
  const { matterId } = await context.params
  try {
    const props = parseAskChoiceProps(parseJsonObject(await request.text(), 'That question is too large.'))
    const message = await appendAskChoice(await getMatterStore(), session.userId, matterId, props)
    if (!message) return NextResponse.json({ error: 'Chat not found.' }, { status: 404 })
    return NextResponse.json({ message: presentStoredMatterMessage(message) }, { status: 201 })
  } catch (error) {
    if (error instanceof MatterWidgetError) {
      return NextResponse.json(
        { error: error.message, ...(error.issues.length > 0 ? { issues: error.issues } : {}) },
        { status: 400 },
      )
    }
    console.error('save askChoice failed', error)
    return NextResponse.json({ error: 'That question could not be saved.' }, { status: 500 })
  }
}
