import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { LibSQLVector } from '@mastra/libsql'
import type { WorkspaceScope } from '../workspace/types'
import { EmbeddingRequestError } from './errors'
import { FILE_SEARCH_DIMENSION } from './messages'
import { embeddingDatabaseFile } from './paths'

/**
 * Per-scope vector file on LibSQLVector from @mastra/libsql, the same package
 * as the matters LibSQLStore. Each library and each matter has its own file
 * under CHATLEGAL_WORKSPACE_ROOT. A query opens only that file.
 *
 * TODO(D-04): chat does not open these files.
 */

const INDEX_NAME = 'chunks'
const QUERY_CANDIDATES = 20
const QUERY_MIN_SCORE = 0.2

export type ChunkWrite = {
  userId: string
  scope: 'user' | 'matter'
  matterId: string
  fileName: string
  text: string
  vector: number[]
}

export type StoredHit = {
  name: string
  excerpt: string
  score: number
}

export function scopeMetadata(userId: string, scope: WorkspaceScope): {
  userId: string
  scope: 'user' | 'matter'
  matterId: string
} {
  return {
    userId,
    scope: scope.kind,
    matterId: scope.kind === 'matter' ? scope.matterId.trim() : '',
  }
}

async function withVector<T>(file: string, run: (vector: LibSQLVector) => Promise<T>): Promise<T> {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const vector = new LibSQLVector({
    id: `chatlegal-embed-${randomUUID()}`,
    url: `file:${file}`,
  })
  try {
    return await run(vector)
  } finally {
    await vector.close()
  }
}

export async function indexHasRows(userId: string, scope: WorkspaceScope, env?: NodeJS.ProcessEnv): Promise<boolean> {
  const file = embeddingDatabaseFile(userId, scope, env)
  if (!file || !fs.existsSync(file)) return false
  return withVector(file, async (vector) => {
    const indexes = await vector.listIndexes()
    if (!indexes.includes(INDEX_NAME)) return false
    const stats = await vector.describeIndex({ indexName: INDEX_NAME })
    return Number(stats.count) > 0
  })
}

export async function writeFileChunks(
  userId: string,
  scope: WorkspaceScope,
  rows: ChunkWrite[],
  env?: NodeJS.ProcessEnv,
): Promise<void> {
  if (rows.length === 0) return
  const file = embeddingDatabaseFile(userId, scope, env)
  if (!file) throw new EmbeddingRequestError('That place is not valid.')
  const dimension = rows[0]?.vector.length ?? 0
  if (!dimension || rows.some((row) => row.vector.length !== dimension)) {
    throw new EmbeddingRequestError(FILE_SEARCH_DIMENSION)
  }
  const meta = scopeMetadata(userId, scope)
  await withVector(file, async (vector) => {
    const indexes = await vector.listIndexes()
    if (!indexes.includes(INDEX_NAME)) {
      await vector.createIndex({ indexName: INDEX_NAME, dimension })
    } else {
      const stats = await vector.describeIndex({ indexName: INDEX_NAME })
      if (Number(stats.dimension) !== dimension) throw new EmbeddingRequestError(FILE_SEARCH_DIMENSION)
    }
    await vector.deleteVectors({
      indexName: INDEX_NAME,
      filter: { ...meta, fileName: rows[0]?.fileName ?? '' },
    })
    await vector.upsert({
      indexName: INDEX_NAME,
      vectors: rows.map((row) => row.vector),
      metadata: rows.map((row) => ({
        userId: meta.userId,
        scope: meta.scope,
        matterId: meta.matterId,
        fileName: row.fileName,
        text: row.text,
      })),
      ids: rows.map((row, index) => `${row.fileName}:${index}`),
    })
  })
}

export async function queryFileChunks(
  userId: string,
  scope: WorkspaceScope,
  queryVector: number[],
  excerpt: (text: string) => string,
  env?: NodeJS.ProcessEnv,
): Promise<StoredHit[]> {
  const file = embeddingDatabaseFile(userId, scope, env)
  if (!file || !fs.existsSync(file)) return []
  const meta = scopeMetadata(userId, scope)
  return withVector(file, async (vector) => {
    const indexes = await vector.listIndexes()
    if (!indexes.includes(INDEX_NAME)) return []
    const rows = await vector.query({
      indexName: INDEX_NAME,
      queryVector,
      topK: QUERY_CANDIDATES,
      filter: meta,
      minScore: QUERY_MIN_SCORE,
    })
    const hits: StoredHit[] = []
    const seen = new Set<string>()
    for (const row of rows) {
      const name = typeof row.metadata?.fileName === 'string' ? row.metadata.fileName : ''
      const text = typeof row.metadata?.text === 'string' ? row.metadata.text : ''
      if (!name || seen.has(name)) continue
      if (row.metadata?.userId !== meta.userId) continue
      if (row.metadata?.scope !== meta.scope) continue
      if (row.metadata?.matterId !== meta.matterId) continue
      seen.add(name)
      hits.push({ name, excerpt: excerpt(text), score: Number(row.score) })
      if (hits.length >= 5) break
    }
    return hits
  })
}

/**
 * Drop prepared rows for one file in the place it left.
 * Does nothing when that place has no index file, so a move with search
 * turned off does not create one. Copy does not call this.
 */
export async function forgetIndexedFile(
  userId: string,
  scope: WorkspaceScope,
  fileName: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const file = embeddingDatabaseFile(userId, scope, env)
  if (!file || !fs.existsSync(file)) return
  const meta = scopeMetadata(userId, scope)
  await withVector(file, async (vector) => {
    const indexes = await vector.listIndexes()
    if (!indexes.includes(INDEX_NAME)) return
    await vector.deleteVectors({
      indexName: INDEX_NAME,
      filter: { ...meta, fileName },
    })
  })
}
