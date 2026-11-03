import { NextResponse } from 'next/server'
import { getMatterStore, getMatterThread } from '@/lib/matters/store'
import { requireConsumerSession } from '@/lib/session-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ matterId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireConsumerSession()
  const { matterId } = await context.params
  try {
    const thread = await getMatterThread(await getMatterStore(), session.userId, matterId)
    if (!thread) return NextResponse.json({ error: 'Matter not found.' }, { status: 404 })
    return NextResponse.json(thread)
  } catch (error) {
    console.error('open matter failed', error)
    return NextResponse.json({ error: 'This matter could not be opened.' }, { status: 500 })
  }
}
