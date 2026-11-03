import { NextResponse } from 'next/server'
import { MatterTitleError } from '@/lib/matters/title'
import { createMatter, getMatterStore, listMatters } from '@/lib/matters/store'
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

export async function GET() {
  const session = await requireConsumerSession()
  try {
    const matters = await listMatters(await getMatterStore(), session.userId)
    return NextResponse.json({ matters })
  } catch (error) {
    console.error('list matters failed', error)
    return NextResponse.json({ error: 'Matters could not be loaded.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await requireConsumerSession()
  try {
    const title = await readTitle(request)
    const matter = await createMatter(await getMatterStore(), session.userId, { title })
    return NextResponse.json({ matter }, { status: 201 })
  } catch (error) {
    if (error instanceof MatterTitleError || error instanceof MatterRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('create matter failed', error)
    return NextResponse.json({ error: 'A new matter could not be opened.' }, { status: 500 })
  }
}
