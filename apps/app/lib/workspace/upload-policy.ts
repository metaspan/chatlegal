/**
 * Matter workspace uploads.
 * PDF, Word (.docx), and Markdown (.md) only. The byte cap matches
 * WORKSPACE_MAX_UPLOAD_BYTES in dcolley/tourbillon@7a8595b
 * packages/shared/src/company-workspace-types.ts. Storage stays on
 * ChatLegal's Mastra LocalFilesystem. That pin's company filesystem is not used.
 * There is no virus scan in this slice.
 */

export const WORKSPACE_MAX_UPLOAD_BYTES = 10_485_760

/** Extra room for the multipart wrapper around a file at the byte cap. */
export const UPLOAD_FORM_OVERHEAD_BYTES = 64 * 1024

export const WORKSPACE_UPLOAD_EXTENSIONS = ['pdf', 'docx', 'md'] as const

export type WorkspaceUploadExtension = (typeof WORKSPACE_UPLOAD_EXTENSIONS)[number]

export const UPLOAD_NAME_ERROR = 'Use a file name like letter.pdf.'
export const UPLOAD_TYPE_ERROR = 'Upload a PDF, Word document, or Markdown file.'
export const UPLOAD_EMPTY_ERROR = 'This file is empty.'
export const UPLOAD_SIZE_ERROR = 'This file is too large. The limit is 10 MB.'
export const UPLOAD_HINT = 'PDF, Word, or Markdown. Up to 10 MB.'

const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

/**
 * One safe file name. Folders are dropped. Other characters become hyphens.
 * Null when nothing usable is left.
 */
export function sanitizeUploadFileName(raw: string): string | null {
  const base = raw.trim().split(/[/\\]/).pop()?.trim() ?? ''
  if (!base || base === '.' || base === '..') return null
  const cleaned = base
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/-+/g, '-')
    .replace(/^[-.]+/, '')
    .replace(/[-.]+$/, '')
  if (!FILE_NAME.test(cleaned) || cleaned.includes('..')) return null
  return cleaned
}

export function uploadExtension(name: string): WorkspaceUploadExtension | null {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return null
  const ext = name.slice(dot + 1).toLowerCase()
  if (ext === 'pdf' || ext === 'docx' || ext === 'md') return ext
  return null
}

/** Null when the file can be stored. Otherwise one plain sentence. */
export function uploadRejection(name: string, size: number): string | null {
  if (!uploadExtension(name)) return UPLOAD_TYPE_ERROR
  if (!Number.isFinite(size) || size <= 0) return UPLOAD_EMPTY_ERROR
  if (size > WORKSPACE_MAX_UPLOAD_BYTES) return UPLOAD_SIZE_ERROR
  return null
}

/** True when the request body is larger than a 10 MB file plus the form wrapper. */
export function uploadBodyTooLarge(contentLength: string | null): boolean {
  if (!contentLength) return false
  const length = Number(contentLength)
  if (!Number.isFinite(length)) return false
  return length > WORKSPACE_MAX_UPLOAD_BYTES + UPLOAD_FORM_OVERHEAD_BYTES
}
