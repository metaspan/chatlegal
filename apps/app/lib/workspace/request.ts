import type { WorkspaceScope } from './types'
import {
  sanitizeUploadFileName,
  UPLOAD_NAME_ERROR,
  UPLOAD_SIZE_ERROR,
  UPLOAD_TYPE_ERROR,
  uploadBodyTooLarge,
  uploadRejection,
} from './upload-policy'

export class WorkspaceRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceRequestError'
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text()
  if (!text.trim()) throw new WorkspaceRequestError('The request must be JSON.')
  let body: unknown
  try {
    body = JSON.parse(text) as unknown
  } catch {
    throw new WorkspaceRequestError('The request must be JSON.')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new WorkspaceRequestError('The request must be a JSON object.')
  }
  return body as Record<string, unknown>
}

export function readFileName(body: Record<string, unknown>): string {
  const name = body.name
  if (typeof name !== 'string') throw new WorkspaceRequestError('File name must be text.')
  return name
}

function isUploadedFile(value: unknown): value is File {
  if (typeof File !== 'undefined' && value instanceof File) return true
  if (!value || typeof value !== 'object') return false
  const file = value as { name?: unknown; size?: unknown; arrayBuffer?: unknown }
  return typeof file.name === 'string' && typeof file.size === 'number' && typeof file.arrayBuffer === 'function'
}

/**
 * Multipart upload for one matter file.
 * The field name is `file`. The stored name is a single safe segment.
 */
export async function readMatterUpload(request: Request): Promise<{ name: string; bytes: Buffer }> {
  if (uploadBodyTooLarge(request.headers.get('content-length'))) {
    throw new WorkspaceRequestError(UPLOAD_SIZE_ERROR)
  }
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    throw new WorkspaceRequestError(UPLOAD_TYPE_ERROR)
  }
  const picked = form.get('file')
  if (!isUploadedFile(picked)) throw new WorkspaceRequestError(UPLOAD_TYPE_ERROR)
  const name = sanitizeUploadFileName(picked.name)
  if (!name) throw new WorkspaceRequestError(UPLOAD_NAME_ERROR)
  const bytes = Buffer.from(await picked.arrayBuffer())
  if (bytes.length !== picked.size) {
    throw new WorkspaceRequestError('This file could not be read in full. Try again.')
  }
  const rejection = uploadRejection(name, bytes.length)
  if (rejection) throw new WorkspaceRequestError(rejection)
  return { name, bytes }
}

export function readFileText(body: Record<string, unknown>): string {
  const text = body.text
  if (typeof text !== 'string') throw new WorkspaceRequestError('File text must be text.')
  return text
}

export type WorkspaceTransferMode = 'move' | 'copy'

/**
 * Move body: `{ name, from, to, mode? }`.
 * Each place is the library or a matter. A missing mode moves.
 * `mode: 'copy'` keeps the file where it was.
 */
export function readMoveBody(body: Record<string, unknown>): {
  name: string
  from: WorkspaceScope
  to: WorkspaceScope
  mode: WorkspaceTransferMode
} {
  return {
    name: readFileName(body),
    from: readScope(body.from, 'From'),
    to: readScope(body.to, 'To'),
    mode: readTransferMode(body.mode),
  }
}

function readTransferMode(value: unknown): WorkspaceTransferMode {
  if (value === undefined) return 'move'
  if (value === 'move' || value === 'copy') return value
  throw new WorkspaceRequestError('Say whether to move or copy the file.')
}

function readScope(value: unknown, label: string): WorkspaceScope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WorkspaceRequestError(`${label} must say library or matter.`)
  }
  const kind = (value as { kind?: unknown }).kind
  if (kind === 'user') return { kind: 'user' }
  if (kind === 'matter') {
    const matterId = (value as { matterId?: unknown }).matterId
    if (typeof matterId !== 'string' || !matterId.trim()) {
      throw new WorkspaceRequestError('A matter id is required.')
    }
    return { kind: 'matter', matterId: matterId.trim() }
  }
  throw new WorkspaceRequestError(`${label} must be the library or a matter.`)
}
