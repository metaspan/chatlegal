import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import { FileExistsError, FileNotFoundError, LocalFilesystem, Workspace } from '@mastra/core/workspace'
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
import type { MoveWorkspaceFileResult, WorkspaceFile, WorkspaceScope } from './types'

/**
 * User library and per-matter files on Mastra Workspace.
 *
 * The chat workspace in dcolley/tourbillon@7a8595b
 * packages/mastra/src/execution-workspace.ts (buildChatWorkspace) is a
 * Workspace plus LocalFilesystem, with tools left off. This app does the
 * same: no sandbox, no search index, and no agent. Send does not use these files.
 * Containment stays on, so a path cannot leave its base directory.
 *
 * The library and each matter are separate workspaces. A file moves from
 * one to the other by read, write, and delete. That move is what a later
 * Concierge calls. It is not an agent tool yet.
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
  const safe = workspaceFileName(name)
  return withFilesystem(basePath, async (disk) => {
    try {
      const content = await disk.readFile(safe, { encoding: 'utf8' })
      return typeof content === 'string' ? content : Buffer.from(content).toString('utf8')
    } catch (error) {
      if (error instanceof FileNotFoundError) return null
      throw error
    }
  })
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
 * Move one file between the user's library and a matter they own.
 * `reason: 'matter'` means a matter in the request is not theirs.
 * `reason: 'file'` means the source file is not there.
 * The source stays put when the destination already has that name.
 */
export async function moveWorkspaceFile(
  userId: string,
  input: { name: string; from: WorkspaceScope; to: WorkspaceScope },
  options?: WorkspaceStoreOptions,
): Promise<MoveWorkspaceFileResult> {
  const name = workspaceFileName(input.name)
  if (sameScope(input.from, input.to)) {
    throw new WorkspacePathError('Choose a different place for the file.')
  }
  const from = await scopeBase(userId, input.from, options)
  const to = await scopeBase(userId, input.to, options)
  if (!from || !to) return { ok: false, reason: 'matter' }
  const text = await readAt(from, name)
  if (text === null) return { ok: false, reason: 'file' }
  let written: WorkspaceFile
  try {
    written = await writeAt(to, name, text)
  } catch (error) {
    if (error instanceof WorkspaceConflictError) return { ok: false, reason: 'conflict' }
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
