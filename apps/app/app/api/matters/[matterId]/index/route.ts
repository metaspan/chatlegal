import { NextResponse } from 'next/server'
import { requireConsumerSession } from '@/lib/session-guards'
import { indexErrorResponse, prepareIndex, readIndex } from '@/lib/embeddings/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Prepared search for one matter the signed-in user owns.
 * Another person's matter is 404. Off unless the embed settings are set.
 * TODO(D-04): chat does not call this.
 */

type RouteContext = { params: Promise<{ matterId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const session = await requireConsumerSession()
  const { matterId } = await context.params
  try {
    const body = await readIndex(session.userId, { kind: 'matter', matterId }, request)
    if (!body) return NextResponse.json({ error: 'Matter not found.' }, { status: 404 })
    return NextResponse.json(body)
  } catch (error) {
    return indexErrorResponse(error)
  }
}

export async function POST(request: Request, context: RouteContext) {
  const session = await requireConsumerSession()
  const { matterId } = await context.params
  try {
    const body = await prepareIndex(session.userId, { kind: 'matter', matterId }, request)
    if (!body) return NextResponse.json({ error: 'Matter not found.' }, { status: 404 })
    return NextResponse.json(body)
  } catch (error) {
    return indexErrorResponse(error)
  }
}
