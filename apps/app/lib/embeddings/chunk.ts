/**
 * Plain character windows for workspace text.
 * PDF and Word text is extracted before it reaches this function.
 * A scanned PDF has no text layer, so it has nothing to chunk.
 */

export const EMBED_CHUNK_CHARS = 1_200
export const EMBED_CHUNK_OVERLAP = 200
export const EMBED_MAX_CHUNKS = 40

const PLAIN_TEXT_NAME = /\.(txt|md|markdown)$/i
const PDF_NAME = /\.pdf$/i
const DOCX_NAME = /\.docx$/i

export function isPlainTextFileName(name: string): boolean {
  return PLAIN_TEXT_NAME.test(name)
}

export function isPdfFileName(name: string): boolean {
  return PDF_NAME.test(name)
}

export function isDocxFileName(name: string): boolean {
  return DOCX_NAME.test(name)
}

/** PDF and Word are read as plain text. The original bytes stay stored. */
export function isExtractableFileName(name: string): boolean {
  return isPdfFileName(name) || isDocxFileName(name)
}

export function isIndexableFileName(name: string): boolean {
  return isPlainTextFileName(name) || isExtractableFileName(name)
}

export function chunkWorkspaceText(text: string): { chunks: string[]; truncated: boolean } {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return { chunks: [], truncated: false }
  const chunks: string[] = []
  let start = 0
  while (start < normalized.length) {
    if (chunks.length >= EMBED_MAX_CHUNKS) return { chunks, truncated: true }
    const end = Math.min(normalized.length, start + EMBED_CHUNK_CHARS)
    chunks.push(normalized.slice(start, end))
    if (end >= normalized.length) break
    const next = end - EMBED_CHUNK_OVERLAP
    if (next <= start) break
    start = next
  }
  return { chunks, truncated: false }
}

export function searchExcerpt(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= 240) return flat
  return `${flat.slice(0, 239)}…`
}
