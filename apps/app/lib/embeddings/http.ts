import { NextResponse } from 'next/server'
import { workspaceErrorResponse } from '../workspace/http'
import { WorkspaceRequestError } from '../workspace/request'
import { embeddingConfig } from './config'
import { EmbeddingRequestError, EmbeddingUnavailableError, IndexedFileMissingError } from './errors'
import { prepareWorkspace, searchWorkspace, type WorkspaceIndexBody } from './index'
import { FILE_SEARCH_FAILED, FILE_SEARCH_QUERY_LONG } from './messages'
import type { WorkspaceScope } from '../workspace/types'

const QUERY_MAX = 500

export function readSearchQuery(request: Request): string | null {
  if (!embeddingConfig()) return null
  const raw = new URL(request.url).searchParams.get('q')
  if (raw === null) return null
  const query = raw.trim()
  if (!query) return null
  if (query.length > QUERY_MAX) throw new EmbeddingRequestError(FILE_SEARCH_QUERY_LONG)
  return query
}

export async function readOptionalFileName(request: Request): Promise<string | undefined> {
  const text = await request.text()
  if (!text.trim()) return undefined
  let body: unknown
  try {
    body = JSON.parse(text) as unknown
  } catch {
    throw new WorkspaceRequestError('The request must be JSON.')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new WorkspaceRequestError('The request must be a JSON object.')
  }
  const name = (body as { name?: unknown }).name
  if (name === undefined) return undefined
  if (typeof name !== 'string') throw new WorkspaceRequestError('File name must be text.')
  return name
}

export async function readIndex(
  userId: string,
  scope: WorkspaceScope,
  request: Request,
): Promise<WorkspaceIndexBody | null> {
  return searchWorkspace(userId, scope, readSearchQuery(request))
}

export async function prepareIndex(
  userId: string,
  scope: WorkspaceScope,
  request: Request,
): Promise<WorkspaceIndexBody | null> {
  // When search is off, skip the body and do not read the files.
  // Matter ownership is still checked inside prepareWorkspace.
  if (!embeddingConfig()) return prepareWorkspace(userId, scope, undefined)
  return prepareWorkspace(userId, scope, await readOptionalFileName(request))
}

export function indexErrorResponse(error: unknown): NextResponse {
  if (error instanceof EmbeddingUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 502 })
  }
  if (error instanceof IndexedFileMissingError) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
  return workspaceErrorResponse(error, FILE_SEARCH_FAILED)
}
