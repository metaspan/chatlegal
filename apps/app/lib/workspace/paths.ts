import path from 'node:path'

/**
 * Mastra Workspace files live in a directory.
 * LocalFilesystem (the local provider in @mastra/core 1.78.0) requires a
 * base path. It is not the matters LibSQL file. AgentFS is named in the
 * filesystem types and is not shipped in that package, so this app does not
 * use it.
 *
 * CHATLEGAL_WORKSPACE_ROOT is that directory. On the host, keep it beside
 * the matters file: /var/lib/chatlegal/workspace. A file: URL is accepted
 * so the value can use the same shape as CHATLEGAL_MATTERS_DB. A libsql
 * or https URL is refused.
 *
 * Layout under the root:
 *   users/<clerk user id>/library
 *   users/<clerk user id>/matters/<matter id>
 *
 * The single-segment file name is the company-workspace path rule from
 * dcolley/tourbillon@7a8595b packages/shared/src/company-workspace.ts,
 * narrowed to one file in the library or the matter (no folders).
 */

/** Same text cap as WORKSPACE_MAX_TEXT_BYTES in that company-workspace pin. */
export const WORKSPACE_MAX_TEXT_BYTES = 1_048_576

const SAFE_ID = /^[A-Za-z0-9_-]{1,200}$/
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

export class WorkspacePathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspacePathError'
  }
}

export class WorkspaceConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceConflictError'
  }
}

export function workspaceRoot(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.CHATLEGAL_WORKSPACE_ROOT?.trim()
  if (!configured) return path.resolve(process.cwd(), 'data', 'workspace')
  if (configured.startsWith('libsql:') || configured.startsWith('https:') || configured.startsWith('http:')) {
    throw new WorkspacePathError(
      'CHATLEGAL_WORKSPACE_ROOT must be a local directory. Mastra local files are not stored in the matters database.',
    )
  }
  const spec = configured.startsWith('file:') ? configured.slice('file:'.length) : configured
  if (!spec || spec === ':memory:' || spec.startsWith(':memory:')) {
    throw new WorkspacePathError('CHATLEGAL_WORKSPACE_ROOT must be a local directory.')
  }
  return path.resolve(spec)
}

export function isSafeWorkspaceId(value: string): boolean {
  return SAFE_ID.test(value.trim())
}

function safeId(value: string, label: string): string {
  const id = value.trim()
  if (!SAFE_ID.test(id)) throw new WorkspacePathError(`${label} is not valid.`)
  return id
}

function insideRoot(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(candidate)
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new WorkspacePathError('Path escapes the workspace root.')
  }
  return resolved
}

export function userLibraryDir(userId: string, env: NodeJS.ProcessEnv = process.env): string {
  const root = workspaceRoot(env)
  return insideRoot(root, path.join(root, 'users', safeId(userId, 'User id'), 'library'))
}

export function matterWorkspaceDir(
  userId: string,
  matterId: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const root = workspaceRoot(env)
  return insideRoot(
    root,
    path.join(root, 'users', safeId(userId, 'User id'), 'matters', safeId(matterId, 'Matter id')),
  )
}

/** One library or matter file. No folders, no dotfiles, no traversal. */
export function workspaceFileName(raw: string): string {
  const name = raw.trim()
  if (!FILE_NAME.test(name) || name.includes('..')) {
    throw new WorkspacePathError('Use a file name like letter.txt.')
  }
  return name
}

export function assertWorkspaceText(text: string): void {
  if (Buffer.byteLength(text, 'utf8') > WORKSPACE_MAX_TEXT_BYTES) {
    throw new WorkspacePathError(`File text is too long (${WORKSPACE_MAX_TEXT_BYTES} bytes max).`)
  }
}
