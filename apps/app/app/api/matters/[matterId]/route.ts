import { NextResponse } from 'next/server'
import { MatterTitleError } from '@/lib/matters/title'
import { archiveMatter, getMatterStore, getMatterThread, renameMatter } from '@/lib/matters/store'
import { requireConsumerSession } from '@/lib/session-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ matterId: string }> }

class MatterRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MatterRequestError'
  }
}

type MatterPatch = { title?: string; archived?: true }

async function readMatterPatch(request: Request): Promise<MatterPatch> {
  const text = await request.text()
  if (!text.trim()) throw new MatterRequestError('The request must be JSON.')
  let body: unknown
  try {
    body = JSON.parse(text) as unknown
  } catch {
    throw new MatterRequestError('The request must be JSON.')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new MatterRequestError('The request must be a JSON object.')
  }
  const record = body as { title?: unknown; archived?: unknown }
  const patch: MatterPatch = {}
  if ('title' in record) {
    if (typeof record.title !== 'string') throw new MatterRequestError('Title must be text.')
    patch.title = record.title
  }
  if ('archived' in record) {
    if (record.archived !== true) throw new MatterRequestError('Archive can only hide a chat.')
    patch.archived = true
  }
  if (patch.title === undefined && patch.archived !== true) {
    throw new MatterRequestError('Say what to change.')
  }
  return patch
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireConsumerSession()
  const { matterId } = await context.params
  try {
    const thread = await getMatterThread(await getMatterStore(), session.userId, matterId)
    if (!thread) return NextResponse.json({ error: 'Chat not found.' }, { status: 404 })
    return NextResponse.json(thread)
  } catch (error) {
    console.error('open matter failed', error)
    return NextResponse.json({ error: 'This chat could not be opened.' }, { status: 500 })
  }
}

/**
 * Renames a matter or hides it from the default list.
 * Archive keeps the thread. This route does not delete messages and does not call a model.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireConsumerSession()
  const { matterId } = await context.params
  try {
    const patch = await readMatterPatch(request)
    const store = await getMatterStore()
    let matter = patch.title !== undefined ? await renameMatter(store, session.userId, matterId, patch.title) : null
    if (patch.title !== undefined && !matter) {
      return NextResponse.json({ error: 'Chat not found.' }, { status: 404 })
    }
    if (patch.archived) {
      matter = await archiveMatter(store, session.userId, matterId)
      if (!matter) return NextResponse.json({ error: 'Chat not found.' }, { status: 404 })
    }
    if (!matter) return NextResponse.json({ error: 'Say what to change.' }, { status: 400 })
    return NextResponse.json({ matter })
  } catch (error) {
    if (error instanceof MatterTitleError || error instanceof MatterRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('update matter failed', error)
    return NextResponse.json({ error: 'This chat could not be changed.' }, { status: 500 })
  }
}
