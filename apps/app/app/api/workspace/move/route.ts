import { NextResponse } from 'next/server'
import { requireConsumerSession } from '@/lib/session-guards'
import { moveErrorResponse, workspaceErrorResponse } from '@/lib/workspace/http'
import { readJsonObject, readMoveBody } from '@/lib/workspace/request'
import { copyWorkspaceFile, moveWorkspaceFile } from '@/lib/workspace/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Move or copy one file between the signed-in user's library and a matter they own.
 * Copy keeps the source. A missing mode still moves.
 * Send does not call this, and it does not run an agent.
 */
export async function POST(request: Request) {
  const session = await requireConsumerSession()
  try {
    const body = readMoveBody(await readJsonObject(request))
    const transferred =
      body.mode === 'copy'
        ? await copyWorkspaceFile(session.userId, body)
        : await moveWorkspaceFile(session.userId, body)
    if (!transferred.ok) return moveErrorResponse(transferred)
    return NextResponse.json({ file: transferred.file })
  } catch (error) {
    return workspaceErrorResponse(error, 'The file could not be moved.')
  }
}
