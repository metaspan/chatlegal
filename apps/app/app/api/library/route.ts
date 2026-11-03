import { NextResponse } from 'next/server'
import { requireConsumerSession } from '@/lib/session-guards'
import { workspaceErrorResponse } from '@/lib/workspace/http'
import { readFileName, readFileText, readJsonObject } from '@/lib/workspace/request'
import { listUserFiles, writeUserFile } from '@/lib/workspace/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireConsumerSession()
  try {
    const files = await listUserFiles(session.userId)
    return NextResponse.json({ files })
  } catch (error) {
    return workspaceErrorResponse(error, 'Library files could not be loaded.')
  }
}

export async function POST(request: Request) {
  const session = await requireConsumerSession()
  try {
    const body = await readJsonObject(request)
    const file = await writeUserFile(session.userId, readFileName(body), readFileText(body))
    return NextResponse.json({ file }, { status: 201 })
  } catch (error) {
    return workspaceErrorResponse(error, 'The file could not be added.')
  }
}
