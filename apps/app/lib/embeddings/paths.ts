import path from 'node:path'
import { isSafeWorkspaceId, workspaceRoot } from '../workspace/paths'
import type { WorkspaceScope } from '../workspace/types'

/**
 * One libSQL vector file per library and per matter, under the workspace root.
 * CHATLEGAL_WORKSPACE_ROOT is unchanged. This is not CHATLEGAL_MATTERS_DB.
 *
 *   users/<user id>/library                         files (F-05)
 *   users/<user id>/matters/<matter id>             files (F-05)
 *   users/<user id>/index/library.db                this user's library search
 *   users/<user id>/index/matters/<matter id>.db    that matter's search
 *
 * The index sits beside the files, not inside the directory the library lists.
 */

export function embeddingDatabaseFile(
  userId: string,
  scope: WorkspaceScope,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const user = userId.trim()
  if (!isSafeWorkspaceId(user)) return null
  const matterId = scope.kind === 'matter' ? scope.matterId.trim() : ''
  if (scope.kind === 'matter' && !isSafeWorkspaceId(matterId)) return null
  const root = path.resolve(workspaceRoot(env))
  const relative =
    scope.kind === 'user'
      ? path.join('users', user, 'index', 'library.db')
      : path.join('users', user, 'index', 'matters', `${matterId}.db`)
  const resolved = path.resolve(root, relative)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null
  const libraryDir = path.resolve(root, 'users', user, 'library')
  const matterDir = matterId ? path.resolve(root, 'users', user, 'matters', matterId) : ''
  if (resolved === libraryDir || resolved.startsWith(libraryDir + path.sep)) return null
  if (matterDir && (resolved === matterDir || resolved.startsWith(matterDir + path.sep))) return null
  return resolved
}
