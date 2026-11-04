import { NextResponse } from 'next/server'
import { requireConsumerSession } from '@/lib/session-guards'
import { workspaceErrorResponse } from '@/lib/workspace/http'
import { readFileName, readFileText, readJsonObject, readMatterUpload } from '@/lib/workspace/request'
import { listMatterFiles, writeMatterFile, writeMatterFileBytes } from '@/lib/workspace/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ matterId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireConsumerSession()
  const { matterId } = await context.params
  try {
    const files = await listMatterFiles(session.userId, matterId)
    if (!files) return NextResponse.json({ error: 'Matter not found.' }, { status: 404 })
    return NextResponse.json({ files })
  } catch (error) {
    return workspaceErrorResponse(error, 'Files for this matter could not be loaded.')
  }
}

function isMultipart(request: Request): boolean {
  const type = request.headers.get('content-type') ?? ''
  return type.toLowerCase().includes('multipart/form-data')
}

export async function POST(request: Request, context: RouteContext) {
  const session = await requireConsumerSession()
  const { matterId } = await context.params
  try {
    if (isMultipart(request)) {
      const upload = await readMatterUpload(request)
      const file = await writeMatterFileBytes(session.userId, matterId, upload.name, upload.bytes)
      if (!file) return NextResponse.json({ error: 'Matter not found.' }, { status: 404 })
      return NextResponse.json({ file }, { status: 201 })
    }
    const body = await readJsonObject(request)
    const file = await writeMatterFile(session.userId, matterId, readFileName(body), readFileText(body))
    if (!file) return NextResponse.json({ error: 'Matter not found.' }, { status: 404 })
    return NextResponse.json({ file }, { status: 201 })
  } catch (error) {
    return workspaceErrorResponse(error, 'The file could not be added to this matter.')
  }
}
