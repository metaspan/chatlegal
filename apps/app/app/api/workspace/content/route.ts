import { NextResponse } from 'next/server'
import { userOwnsMatter, getMatterStore } from '@/lib/matters/store'
import { requireConsumerSession } from '@/lib/session-guards'
import { workspaceContentType } from '@/lib/workspace/content'
import { workspaceErrorResponse } from '@/lib/workspace/http'
import { WorkspaceRequestError } from '@/lib/workspace/request'
import { readMatterFileBytes, readUserFileBytes } from '@/lib/workspace/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ContentQuery =
  | { name: string; scope: 'user' }
  | { name: string; scope: 'matter'; matterId: string }

function readContentQuery(request: Request): ContentQuery {
  const url = new URL(request.url)
  const name = url.searchParams.get('name') ?? ''
  const scope = url.searchParams.get('scope')
  if (scope === 'user') return { name, scope: 'user' }
  if (scope === 'matter') {
    const matterId = url.searchParams.get('matterId')?.trim() ?? ''
    if (!matterId) throw new WorkspaceRequestError('A matter id is required.')
    return { name, scope: 'matter', matterId }
  }
  throw new WorkspaceRequestError('Say whether the file is in the library or a matter.')
}

function fileResponse(name: string, bytes: Buffer): NextResponse {
  const type = workspaceContentType(name)
  const headers = new Headers({
    'content-type': type,
    'x-content-type-options': 'nosniff',
    'content-disposition': `inline; filename="${name}"`,
    'cache-control': 'no-store',
  })
  if (type.startsWith('image/svg')) {
    headers.set('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
  }
  return new NextResponse(new Uint8Array(bytes), { status: 200, headers })
}

/**
 * Bytes for one library or matter file the signed-in user owns.
 * The right pane loads this after Open. The user id comes from the session.
 */
export async function GET(request: Request) {
  const session = await requireConsumerSession()
  try {
    const query = readContentQuery(request)
    if (query.scope === 'user') {
      const bytes = await readUserFileBytes(session.userId, query.name)
      if (!bytes) return NextResponse.json({ error: 'File not found.' }, { status: 404 })
      return fileResponse(query.name, bytes)
    }
    const bytes = await readMatterFileBytes(session.userId, query.matterId, query.name)
    if (!bytes) {
      const owned = await userOwnsMatter(await getMatterStore(), session.userId, query.matterId)
      if (!owned) return NextResponse.json({ error: 'Matter not found.' }, { status: 404 })
      return NextResponse.json({ error: 'File not found.' }, { status: 404 })
    }
    return fileResponse(query.name, bytes)
  } catch (error) {
    return workspaceErrorResponse(error, 'The file could not be opened.')
  }
}
