import { getMatterStore, userOwnsMatter, type MatterStore } from '../matters/store'
import { isSafeWorkspaceId, workspaceFileName } from '../workspace/paths'
import { listMatterFiles, listUserFiles, readMatterFile, readUserFile } from '../workspace/store'
import type { WorkspaceFile, WorkspaceScope } from '../workspace/types'
import { chunkWorkspaceText, isIndexableFileName, isStoredBinaryName, searchExcerpt } from './chunk'
import { embeddingConfig, type EmbeddingConfig } from './config'
import { embedInBatches, httpEmbedder, type EmbedTexts } from './embed'
import { IndexedFileMissingError } from './errors'
import {
  FILE_SEARCH_BINARY,
  FILE_SEARCH_CAP,
  FILE_SEARCH_EMPTY,
  FILE_SEARCH_EMPTY_FILE,
  FILE_SEARCH_FILE_CAP,
  FILE_SEARCH_LONG,
  FILE_SEARCH_NOT_TEXT,
  FILE_SEARCH_NO_MATCH,
  FILE_SEARCH_OFF,
  FILE_SEARCH_PREPARED,
  FILE_SEARCH_READY,
} from './messages'
import { indexHasRows, queryFileChunks, scopeMetadata, writeFileChunks, type ChunkWrite } from './vector'

/**
 * Prepare and search workspace files for one signed-in user.
 * Library and matter each have their own vector file. Another user's file
 * is never opened. Chat does not call this. TODO(D-04).
 *
 * TODO(D-03 extract): PDF and Word stay as uploaded bytes.
 * TODO(G-00): Concierge and TaskRunner stay off.
 */

export type IndexOptions = {
  env?: NodeJS.ProcessEnv
  embed?: EmbedTexts
  fetch?: typeof fetch
  matters?: MatterStore
}

export type WorkspaceIndexBody = {
  enabled: boolean
  message: string
  indexed: { name: string; chunks: number; truncated: boolean }[]
  skipped: { name: string; reason: string }[]
  hits: { name: string; excerpt: string }[]
}

export function indexOffBody(): WorkspaceIndexBody {
  return {
    enabled: false,
    message: FILE_SEARCH_OFF,
    indexed: [],
    skipped: [],
    hits: [],
  }
}

function emptyEnabled(message: string): WorkspaceIndexBody {
  return { enabled: true, message, indexed: [], skipped: [], hits: [] }
}

function envOf(options?: IndexOptions): NodeJS.ProcessEnv {
  return options?.env ?? process.env
}

export async function matterAccessible(
  userId: string,
  matterId: string,
  options?: IndexOptions,
): Promise<boolean> {
  if (!isSafeWorkspaceId(matterId.trim())) return false
  const matters = options?.matters ?? (await getMatterStore())
  return userOwnsMatter(matters, userId, matterId.trim())
}

async function filesIn(
  userId: string,
  scope: WorkspaceScope,
  options?: IndexOptions,
): Promise<WorkspaceFile[] | null> {
  const storeOptions = { env: envOf(options), matters: options?.matters }
  if (scope.kind === 'user') return listUserFiles(userId, storeOptions)
  return listMatterFiles(userId, scope.matterId, storeOptions)
}

async function textIn(
  userId: string,
  scope: WorkspaceScope,
  name: string,
  options?: IndexOptions,
): Promise<string | null> {
  const storeOptions = { env: envOf(options), matters: options?.matters }
  if (scope.kind === 'user') return readUserFile(userId, name, storeOptions)
  return readMatterFile(userId, scope.matterId, name, storeOptions)
}

function embedderFor(config: EmbeddingConfig, options?: IndexOptions): EmbedTexts {
  if (options?.embed) return options.embed
  return httpEmbedder(config, options?.fetch)
}

/**
 * Status, or a search when `query` is set.
 * Search is empty and does not call the embeddings endpoint when this
 * library or matter has not been prepared.
 */
export async function searchWorkspace(
  userId: string,
  scope: WorkspaceScope,
  query: string | null,
  options?: IndexOptions,
): Promise<WorkspaceIndexBody | null> {
  if (scope.kind === 'matter' && !(await matterAccessible(userId, scope.matterId, options))) return null
  const config = embeddingConfig(envOf(options))
  if (!config) return indexOffBody()
  const prepared = await indexHasRows(userId, scope, envOf(options))
  if (!query || !prepared) return emptyEnabled(prepared ? FILE_SEARCH_READY : FILE_SEARCH_EMPTY)
  const [vector] = await embedInBatches(embedderFor(config, options), [query])
  if (!vector) return emptyEnabled(FILE_SEARCH_EMPTY)
  const hits = await queryFileChunks(userId, scope, vector, searchExcerpt, envOf(options))
  return {
    enabled: true,
    message: hits.length ? 'These files are the closest match.' : FILE_SEARCH_NO_MATCH,
    indexed: [],
    skipped: [],
    hits: hits.map((hit) => ({ name: hit.name, excerpt: hit.excerpt })),
  }
}

/** Read text files in this library or matter and store their vectors. */
export async function prepareWorkspace(
  userId: string,
  scope: WorkspaceScope,
  name: string | undefined,
  options?: IndexOptions,
): Promise<WorkspaceIndexBody | null> {
  if (scope.kind === 'matter' && !(await matterAccessible(userId, scope.matterId, options))) return null
  const config = embeddingConfig(envOf(options))
  if (!config) return indexOffBody()
  const listed = await filesIn(userId, scope, options)
  if (!listed) return null
  let selected = listed
  if (name !== undefined) {
    const safe = workspaceFileName(name)
    selected = listed.filter((file) => file.name === safe)
    if (selected.length === 0) throw new IndexedFileMissingError()
  }
  const capped = selected.slice(0, FILE_SEARCH_FILE_CAP)
  const overflow = selected.slice(FILE_SEARCH_FILE_CAP)
  const skipped: WorkspaceIndexBody['skipped'] = overflow.map((file) => ({ name: file.name, reason: FILE_SEARCH_CAP }))
  const pending: { name: string; chunks: string[]; truncated: boolean }[] = []
  for (const file of capped) {
    if (isStoredBinaryName(file.name)) {
      skipped.push({ name: file.name, reason: FILE_SEARCH_BINARY })
      continue
    }
    if (!isIndexableFileName(file.name)) {
      skipped.push({ name: file.name, reason: FILE_SEARCH_NOT_TEXT })
      continue
    }
    const text = await textIn(userId, scope, file.name, options)
    if (text === null) {
      skipped.push({ name: file.name, reason: 'File not found.' })
      continue
    }
    const chunked = chunkWorkspaceText(text)
    if (chunked.chunks.length === 0) {
      skipped.push({ name: file.name, reason: FILE_SEARCH_EMPTY_FILE })
      continue
    }
    pending.push({ name: file.name, chunks: chunked.chunks, truncated: chunked.truncated })
  }
  if (pending.length === 0) {
    return {
      enabled: true,
      message: skipped[0]?.reason ?? FILE_SEARCH_EMPTY,
      indexed: [],
      skipped,
      hits: [],
    }
  }
  const vectors = await embedInBatches(
    embedderFor(config, options),
    pending.flatMap((item) => item.chunks),
  )
  const meta = scopeMetadata(userId, scope)
  const indexed: WorkspaceIndexBody['indexed'] = []
  let offset = 0
  for (const item of pending) {
    const slice = vectors.slice(offset, offset + item.chunks.length)
    offset += item.chunks.length
    const rows: ChunkWrite[] = item.chunks.map((text, index) => ({
      userId: meta.userId,
      scope: meta.scope,
      matterId: meta.matterId,
      fileName: item.name,
      text,
      vector: slice[index] ?? [],
    }))
    await writeFileChunks(userId, scope, rows, envOf(options))
    indexed.push({ name: item.name, chunks: item.chunks.length, truncated: item.truncated })
    if (item.truncated) skipped.push({ name: item.name, reason: FILE_SEARCH_LONG })
  }
  return {
    enabled: true,
    message: preparedMessage(indexed.length > 0, skipped),
    indexed,
    skipped,
    hits: [],
  }
}

function preparedMessage(indexed: boolean, skipped: WorkspaceIndexBody['skipped']): string {
  if (!indexed) return skipped[0]?.reason ?? FILE_SEARCH_EMPTY
  if (skipped.some((item) => item.reason === FILE_SEARCH_BINARY)) {
    return `${FILE_SEARCH_PREPARED} ${FILE_SEARCH_BINARY}`
  }
  if (skipped.some((item) => item.reason === FILE_SEARCH_LONG)) {
    return `${FILE_SEARCH_PREPARED} ${FILE_SEARCH_LONG}`
  }
  return FILE_SEARCH_PREPARED
}
