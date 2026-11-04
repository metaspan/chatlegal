import { NextResponse } from 'next/server'
import { requireConsumerSession } from '@/lib/session-guards'
import { indexErrorResponse, prepareIndex, readIndex } from '@/lib/embeddings/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Prepared search for the signed-in user's library.
 * Off unless the embed settings are set. Chat does not call this.
 * TODO(D-04): do not wire this into the matter transcript.
 */

export async function GET(request: Request) {
  const session = await requireConsumerSession()
  try {
    const body = await readIndex(session.userId, { kind: 'user' }, request)
    if (!body) return NextResponse.json({ error: 'Library not found.' }, { status: 404 })
    return NextResponse.json(body)
  } catch (error) {
    return indexErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const session = await requireConsumerSession()
  try {
    const body = await prepareIndex(session.userId, { kind: 'user' }, request)
    if (!body) return NextResponse.json({ error: 'Library not found.' }, { status: 404 })
    return NextResponse.json(body)
  } catch (error) {
    return indexErrorResponse(error)
  }
}
