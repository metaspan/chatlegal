import type { Metadata } from 'next'
import { GET as libraryIndex } from '@/app/api/library/index/route'
import { GET as listLibrary } from '@/app/api/library/route'
import { UserWorkspace } from '@/components/shell/user-workspace'
import { FILE_SEARCH_OFF } from '@/lib/embeddings/messages'
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
  const search = await librarySearchNote()
  const response = await listLibrary()
  if (!response.ok) {
    let message = 'Library files could not be loaded.'
    try {
      const body = (await response.json()) as { error?: unknown }
      if (typeof body.error === 'string' && body.error.trim()) message = body.error
    } catch {
      // The status is enough when the body is not JSON.
    }
    return (
      <UserWorkspace
        initialFiles={[]}
        initialError={message}
        fileSearchEnabled={search.enabled}
        fileSearchNote={search.note}
        fileSearchResolved
      />
    )
  }
  const files = workspaceFilesFromJson(await response.json())
  if (!files) {
    return (
      <UserWorkspace
        initialFiles={[]}
        initialError="Library files could not be loaded."
        fileSearchEnabled={search.enabled}
        fileSearchNote={search.note}
        fileSearchResolved
      />
    )
  }
  return (
    <UserWorkspace
      initialFiles={files}
      fileSearchEnabled={search.enabled}
      fileSearchNote={search.note}
      fileSearchResolved
    />
  )
}

async function librarySearchNote(): Promise<{ enabled: boolean; note: string }> {
  try {
    const response = await libraryIndex(new Request('http://localhost/api/library/index'))
    if (!response.ok) return { enabled: false, note: FILE_SEARCH_OFF }
    const body = (await response.json()) as { enabled?: unknown; message?: unknown }
    return {
      enabled: body.enabled === true,
      note: typeof body.message === 'string' && body.message.trim() ? body.message : FILE_SEARCH_OFF,
    }
  } catch {
    return { enabled: false, note: FILE_SEARCH_OFF }
  }
}
