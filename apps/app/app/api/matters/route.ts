import { NextResponse } from 'next/server'
import { seedMatterFirstTurn } from '@/lib/matters/seed-first-turn'
import { MatterTitleError } from '@/lib/matters/title'
import { createMatter, getMatterStore, listArchivedMatters, listMatters } from '@/lib/matters/store'
import { requireConsumerSession } from '@/lib/session-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

class MatterRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MatterRequestError'
  }
}

async function readTitle(request: Request): Promise<string | undefined> {
  const text = await request.text()
  if (!text.trim()) return undefined
  let body: unknown
  try {
    body = JSON.parse(text) as unknown
  } catch {
    throw new MatterRequestError('The request must be JSON.')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new MatterRequestError('The request must be a JSON object.')
  }
  const title = (body as { title?: unknown }).title
  if (title === undefined) return undefined
  if (typeof title !== 'string') throw new MatterRequestError('Title must be text.')
  return title
}

export async function GET(request?: Request) {
  const session = await requireConsumerSession()
  // ?archived=true answers the "Archived chats" list (C-18). It is a read
  // over the same archive flag the C-12 archive uses; it never deletes.
  const archivedOnly = request ? readArchivedFlag(request) : false
  try {
    const store = await getMatterStore()
    const matters = archivedOnly
      ? await listArchivedMatters(store, session.userId)
      : await listMatters(store, session.userId)
    return NextResponse.json({ matters })
  } catch (error) {
    console.error('list matters failed', error)
    return NextResponse.json({ error: 'Chats could not be loaded.' }, { status: 500 })
  }
}

function readArchivedFlag(request: Request): boolean {
  try {
    return new URL(request.url).searchParams.get('archived') === 'true'
  } catch {
    return false
  }
}

/**
 * Opens a matter and stores the scripted first turn on it.
 * That turn is a template. This route does not call a model.
 */
export async function POST(request: Request) {
  const session = await requireConsumerSession()
  try {
    const title = await readTitle(request)
    const store = await getMatterStore()
    const matter = await createMatter(store, session.userId, { title })
    const messages = await seedMatterFirstTurn(store, session.userId, matter.id)
    if (!messages) {
      return NextResponse.json({ error: 'A new chat could not be opened.' }, { status: 500 })
    }
    return NextResponse.json({ matter, messages }, { status: 201 })
  } catch (error) {
    if (error instanceof MatterTitleError || error instanceof MatterRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('create matter failed', error)
    return NextResponse.json({ error: 'A new chat could not be opened.' }, { status: 500 })
  }
}
