import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { FileExistsError, FileNotFoundError, LocalFilesystem, Workspace } from '@mastra/core/workspace'
import { forgetIndexedFile } from '../embeddings/vector'
import { getMatterStore, userOwnsMatter, type MatterStore } from '../matters/store'
import {
  assertWorkspaceText,
  isSafeWorkspaceId,
  matterWorkspaceDir,
  userLibraryDir,
  WorkspaceConflictError,
  WorkspacePathError,
  workspaceFileName,
} from './paths'
import {
  sanitizeUploadFileName,
  UPLOAD_NAME_ERROR,
  UPLOAD_SIZE_ERROR,
  uploadRejection,
  WORKSPACE_MAX_UPLOAD_BYTES,
} from './upload-policy'
import type { MoveWorkspaceFileResult, WorkspaceFile, WorkspaceScope } from './types'

/**
 * User library and per-matter files on Mastra Workspace.
 *
 * The chat workspace in dcolley/tourbillon@7a8595b
 * packages/mastra/src/execution-workspace.ts (buildChatWorkspace) is a
 * Workspace plus LocalFilesystem, with tools left off. This app does the
 * same: no sandbox, tools off, and no agent. Prepared search, when its own
 * settings are on, is a separate libSQL file under the workspace root.
 * Send does not use these files, and it does not search them.
 * Containment stays on, so a path cannot leave its base directory.
 *
 * The library and each matter are separate workspaces. A file moves from
 * one to the other by read, write, and delete. A copy is the same read and
 * write, and the source stays. The signed-in pages call that. It is not an
 * agent tool. dcolley/tourbillon@7a8595b
 * apps/web/components/workspace/workspace-file-pane.tsx renames inside one
 * workspace and does not attach a file to another.
 *
 * A matter upload writes the original bytes through the same LocalFilesystem
 * (contained, tools off). PDF, Word, and Markdown only, up to 10 MB.
 */

export type WorkspaceStoreOptions = {
  env?: NodeJS.ProcessEnv
  matters?: MatterStore
}

function envOf(options?: WorkspaceStoreOptions): NodeJS.ProcessEnv {
  return options?.env ?? process.env
}

async function withFilesystem<T>(basePath: string, run: (disk: LocalFilesystem) => Promise<T>): Promise<T> {
  fs.mkdirSync(basePath, { recursive: true })
  const workspace = new Workspace({
    id: `chatlegal-workspace-${randomUUID()}`,
    name: 'ChatLegal files',
    filesystem: new LocalFilesystem({
      basePath,
      contained: true,
    }),
    tools: { enabled: false },
  })
  await workspace.init()
  try {
    const disk = workspace.filesystem
    if (!disk) throw new Error('Workspace filesystem is missing.')
    return await run(disk)
  } finally {
    await workspace.destroy()
  }
}

function toFile(name: string, info: { size: number; modifiedAt: Date }): WorkspaceFile {
  return {
    name,
    size: info.size,
    updatedAt: info.modifiedAt.toISOString(),
  }
}

async function listAt(basePath: string): Promise<WorkspaceFile[]> {
  return withFilesystem(basePath, async (disk) => {
    const entries = await disk.readdir('.')
    const files: WorkspaceFile[] = []
    for (const entry of entries) {
      if (entry.type !== 'file' || entry.isSymlink) continue
      try {
        workspaceFileName(entry.name)
      } catch {
        continue
      }
      const info = await disk.stat(entry.name)
      if (info.type !== 'file') continue
      files.push(toFile(entry.name, info))
    }
    files.sort((a, b) => a.name.localeCompare(b.name) || a.updatedAt.localeCompare(b.updatedAt))
    return files
  })
}

async function readAt(basePath: string, name: string): Promise<string | null> {
  const bytes = await readBytesAt(basePath, name)
  return bytes ? bytes.toString('utf8') : null
}

/**
 * Original bytes for the viewer. A symlink is refused.
 * The name check is the same single-segment rule as a text read.
 */
async function readBytesAt(basePath: string, name: string): Promise<Buffer | null> {
  const safe = workspaceFileName(name)
  const root = path.resolve(basePath)
  const full = path.resolve(root, safe)
  if (full !== path.join(root, safe)) throw new WorkspacePathError('Path escapes the workspace root.')
  try {
    const stat = await fs.promises.lstat(full)
    if (stat.isSymbolicLink() || !stat.isFile()) return null
    return await fs.promises.readFile(full)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return null
    throw error
  }
}

async function writeAt(basePath: string, name: string, text: string): Promise<WorkspaceFile> {
  const safe = workspaceFileName(name)
  assertWorkspaceText(text)
  return withFilesystem(basePath, async (disk) => {
    if (await disk.exists(safe)) {
      throw new WorkspaceConflictError('A file with that name is already there.')
    }
    try {
      await disk.writeFile(safe, text, { overwrite: false })
    } catch (error) {
      if (error instanceof FileExistsError) {
        throw new WorkspaceConflictError('A file with that name is already there.')
      }
      throw error
    }
    return toFile(safe, await disk.stat(safe))
  })
}

async function writeBytesAt(basePath: string, name: string, bytes: Buffer): Promise<WorkspaceFile> {
  const safeName = sanitizeUploadFileName(name)
  if (!safeName) throw new WorkspacePathError(UPLOAD_NAME_ERROR)
  const safe = workspaceFileName(safeName)
  const rejection = uploadRejection(safe, bytes.length)
  if (rejection) throw new WorkspacePathError(rejection)
  return withFilesystem(basePath, async (disk) => {
    if (await disk.exists(safe)) {
      throw new WorkspaceConflictError('A file with that name is already there.')
    }
    try {
      await disk.writeFile(safe, bytes, { overwrite: false })
    } catch (error) {
      if (error instanceof FileExistsError) {
        throw new WorkspaceConflictError('A file with that name is already there.')
      }
      throw error
    }
    const info = await disk.stat(safe)
    if (info.type !== 'file' || info.size !== bytes.length) {
      await disk.deleteFile(safe).catch(() => undefined)
      throw new WorkspacePathError('The file could not be stored in full.')
    }
    return toFile(safe, info)
  })
}

/**
 * Bytes already stored in a workspace the user owns.
 * The upload type check stays on new uploads. A copy or move keeps the name
 * and the original bytes, including a PDF or Word document.
 */
async function writeOwnedBytes(basePath: string, name: string, bytes: Buffer): Promise<WorkspaceFile> {
  const safe = workspaceFileName(name)
  if (bytes.length > WORKSPACE_MAX_UPLOAD_BYTES) {
    throw new WorkspacePathError(UPLOAD_SIZE_ERROR)
  }
  return withFilesystem(basePath, async (disk) => {
    if (await disk.exists(safe)) {
      throw new WorkspaceConflictError('A file with that name is already there.')
    }
    try {
      await disk.writeFile(safe, bytes, { overwrite: false })
    } catch (error) {
      if (error instanceof FileExistsError) {
        throw new WorkspaceConflictError('A file with that name is already there.')
      }
      throw error
    }
    const info = await disk.stat(safe)
    if (info.type !== 'file' || info.size !== bytes.length) {
      await disk.deleteFile(safe).catch(() => undefined)
      throw new WorkspacePathError('The file could not be stored in full.')
    }
    return toFile(safe, info)
  })
}

async function deleteAt(basePath: string, name: string): Promise<void> {
  const safe = workspaceFileName(name)
  await withFilesystem(basePath, async (disk) => {
    await disk.deleteFile(safe)
  })
}

async function matterBase(
  userId: string,
  matterId: string,
  options?: WorkspaceStoreOptions,
): Promise<string | null> {
  if (!isSafeWorkspaceId(matterId)) return null
  const matters = options?.matters ?? (await getMatterStore())
  const owned = await userOwnsMatter(matters, userId, matterId)
  if (!owned) return null
  return matterWorkspaceDir(userId, matterId, envOf(options))
}

function sameScope(from: WorkspaceScope, to: WorkspaceScope): boolean {
  if (from.kind === 'user' && to.kind === 'user') return true
  return from.kind === 'matter' && to.kind === 'matter' && from.matterId === to.matterId
}

async function scopeBase(
  userId: string,
  scope: WorkspaceScope,
  options?: WorkspaceStoreOptions,
): Promise<string | null> {
  if (scope.kind === 'user') return userLibraryDir(userId, envOf(options))
  return matterBase(userId, scope.matterId, options)
}

export async function listUserFiles(userId: string, options?: WorkspaceStoreOptions): Promise<WorkspaceFile[]> {
  return listAt(userLibraryDir(userId, envOf(options)))
}

export async function readUserFile(
  userId: string,
  name: string,
  options?: WorkspaceStoreOptions,
): Promise<string | null> {
  return readAt(userLibraryDir(userId, envOf(options)), name)
}

export async function readUserFileBytes(
  userId: string,
  name: string,
  options?: WorkspaceStoreOptions,
): Promise<Buffer | null> {
  return readBytesAt(userLibraryDir(userId, envOf(options)), name)
}

export async function writeUserFile(
  userId: string,
  name: string,
  text: string,
  options?: WorkspaceStoreOptions,
): Promise<WorkspaceFile> {
  return writeAt(userLibraryDir(userId, envOf(options)), name, text)
}

/**
 * Files for a matter the user owns.
 * Null when the matter is not theirs, including another person's matter.
 * The caller answers that with 404.
 */
export async function listMatterFiles(
  userId: string,
  matterId: string,
  options?: WorkspaceStoreOptions,
): Promise<WorkspaceFile[] | null> {
  const base = await matterBase(userId, matterId, options)
  if (!base) return null
  return listAt(base)
}

export async function readMatterFile(
  userId: string,
  matterId: string,
  name: string,
  options?: WorkspaceStoreOptions,
): Promise<string | null> {
  const base = await matterBase(userId, matterId, options)
  if (!base) return null
  return readAt(base, name)
}

/** Null when the matter is not theirs or the file is not there. */
export async function readMatterFileBytes(
  userId: string,
  matterId: string,
  name: string,
  options?: WorkspaceStoreOptions,
): Promise<Buffer | null> {
  const base = await matterBase(userId, matterId, options)
  if (!base) return null
  return readBytesAt(base, name)
}

export async function writeMatterFile(
  userId: string,
  matterId: string,
  name: string,
  text: string,
  options?: WorkspaceStoreOptions,
): Promise<WorkspaceFile | null> {
  const base = await matterBase(userId, matterId, options)
  if (!base) return null
  return writeAt(base, name, text)
}

/**
 * Store an uploaded PDF, Word document, or Markdown file as the original bytes.
 * Null when the matter is not theirs. The name is one safe segment.
 */
export async function writeMatterFileBytes(
  userId: string,
  matterId: string,
  name: string,
  bytes: Buffer,
  options?: WorkspaceStoreOptions,
): Promise<WorkspaceFile | null> {
  const base = await matterBase(userId, matterId, options)
  if (!base) return null
  return writeBytesAt(base, name, bytes)
}

type WorkspaceTransfer = { name: string; from: WorkspaceScope; to: WorkspaceScope }

/**
 * Copy or move one file between the user's library and a matter they own.
 * `reason: 'matter'` means a matter in the request is not theirs.
 * `reason: 'file'` means the source file is not there.
 * The source stays put when the destination already has that name.
 * Copy leaves the source in place, including any prepared search rows.
 * Move removes the file after the write, and drops prepared search rows
 * in the place it left. That drop does nothing when search was never prepared.
 */
async function transferWorkspaceFile(
  userId: string,
  input: WorkspaceTransfer,
  mode: 'move' | 'copy',
  options?: WorkspaceStoreOptions,
): Promise<MoveWorkspaceFileResult> {
  const name = workspaceFileName(input.name)
  if (sameScope(input.from, input.to)) {
    throw new WorkspacePathError('Choose a different place for the file.')
  }
  const from = await scopeBase(userId, input.from, options)
  const to = await scopeBase(userId, input.to, options)
  if (!from || !to) return { ok: false, reason: 'matter' }
  const bytes = await readBytesAt(from, name)
  if (!bytes) return { ok: false, reason: 'file' }
  let written: WorkspaceFile
  try {
    written = await writeOwnedBytes(to, name, bytes)
  } catch (error) {
    if (error instanceof WorkspaceConflictError) return { ok: false, reason: 'conflict' }
    throw error
  }
  if (mode === 'copy') return { ok: true, file: written }
  try {
    await forgetIndexedFile(userId, input.from, name, envOf(options))
  } catch (error) {
    await deleteAt(to, name).catch(() => undefined)
    throw error
  }
  try {
    await deleteAt(from, name)
  } catch (error) {
    if (!(error instanceof FileNotFoundError)) {
      await deleteAt(to, name).catch(() => undefined)
      throw error
    }
  }
  return { ok: true, file: written }
}

/** Move one file. The source is removed after the destination has the bytes. */
export async function moveWorkspaceFile(
  userId: string,
  input: WorkspaceTransfer,
  options?: WorkspaceStoreOptions,
): Promise<MoveWorkspaceFileResult> {
  return transferWorkspaceFile(userId, input, 'move', options)
}

/** Copy one file. The library or matter it came from keeps its copy. */
export async function copyWorkspaceFile(
  userId: string,
  input: WorkspaceTransfer,
  options?: WorkspaceStoreOptions,
): Promise<MoveWorkspaceFileResult> {
  return transferWorkspaceFile(userId, input, 'copy', options)
}
