import { NextResponse } from 'next/server'
import { MatterMessageError, parseMatterMessageBody } from '@/lib/matters/message'
import { appendMatterMessage, getMatterStore } from '@/lib/matters/store'
import { requireConsumerSession } from '@/lib/session-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ matterId: string }> }

/**
 * Stores the signed-in user's message on their matter thread (`clerk:<userId>`).
 * TODO(G-01 Concierge): stream the assistant reply after this append.
 * This route does not call a model.
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await requireConsumerSession()
  const { matterId } = await context.params
  try {
    const text = parseMatterMessageBody(await request.text())
    const message = await appendMatterMessage(await getMatterStore(), session.userId, matterId, {
      role: 'user',
      text,
    })
    if (!message) return NextResponse.json({ error: 'Matter not found.' }, { status: 404 })
    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    if (error instanceof MatterMessageError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('save matter message failed', error)
    return NextResponse.json({ error: 'That message could not be saved.' }, { status: 500 })
  }
}
