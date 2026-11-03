import type { Metadata } from 'next'
import { GET as listLibrary } from '@/app/api/library/route'
import { UserWorkspace } from '@/components/shell/user-workspace'
import { requireConsumerSession } from '@/lib/session-guards'
import { workspaceFilesFromJson } from '@/lib/workspace/types'

export const metadata: Metadata = { title: 'Library' }

/**
 * User workspace. The list comes from GET /api/library, which reads the
 * signed-in user's Mastra LocalFilesystem library. The client keeps that
 * list fresh through the same route.
 */
export default async function LibraryPage() {
  await requireConsumerSession()
  const response = await listLibrary()
  if (!response.ok) {
    let message = 'Library files could not be loaded.'
    try {
      const body = (await response.json()) as { error?: unknown }
      if (typeof body.error === 'string' && body.error.trim()) message = body.error
    } catch {
      // The status is enough when the body is not JSON.
    }
    return <UserWorkspace initialFiles={[]} initialError={message} />
  }
  const files = workspaceFilesFromJson(await response.json())
  if (!files) return <UserWorkspace initialFiles={[]} initialError="Library files could not be loaded." />
  return <UserWorkspace initialFiles={files} />
}
