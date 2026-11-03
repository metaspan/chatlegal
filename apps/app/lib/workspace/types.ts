/**
 * A file in the signed-in user's library, or in one matter they own.
 * Dates are ISO strings so the value can cross the API unchanged.
 */

export type WorkspaceFile = {
  name: string
  size: number
  updatedAt: string
}

/** `user` is the library. `matter` is that matter's workspace. */
export type WorkspaceScope = { kind: 'user' } | { kind: 'matter'; matterId: string }

export type MoveWorkspaceFileResult =
  | { ok: true; file: WorkspaceFile }
  | { ok: false; reason: 'matter' | 'file' | 'conflict' }

export function isWorkspaceFile(value: unknown): value is WorkspaceFile {
  if (!value || typeof value !== 'object') return false
  const record = value as { name?: unknown; size?: unknown; updatedAt?: unknown }
  return typeof record.name === 'string' && typeof record.size === 'number' && typeof record.updatedAt === 'string'
}

export function workspaceFilesFromJson(value: unknown): WorkspaceFile[] | null {
  if (!value || typeof value !== 'object') return null
  const files = (value as { files?: unknown }).files
  if (!Array.isArray(files) || !files.every(isWorkspaceFile)) return null
  return files
}
