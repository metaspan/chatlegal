import { NextResponse } from 'next/server'
import { requireConsumerSession } from '@/lib/session-guards'
import { moveErrorResponse, workspaceErrorResponse } from '@/lib/workspace/http'
import { readJsonObject, readMoveBody } from '@/lib/workspace/request'
import { moveWorkspaceFile } from '@/lib/workspace/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Move one file between the signed-in user's library and a matter they own.
 * A later Concierge calls this. It does not run an agent, and Send does not move a file.
 */
export async function POST(request: Request) {
  const session = await requireConsumerSession()
  try {
    const moved = await moveWorkspaceFile(session.userId, readMoveBody(await readJsonObject(request)))
    if (!moved.ok) return moveErrorResponse(moved)
    return NextResponse.json({ file: moved.file })
  } catch (error) {
    return workspaceErrorResponse(error, 'The file could not be moved.')
  }
}
