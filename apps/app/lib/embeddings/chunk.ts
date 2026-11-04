/**
 * Plain character windows for workspace text.
 * TODO(D-03 extract): PDF and Word bytes are not chunked. The prepare call skips them.
 */

export const EMBED_CHUNK_CHARS = 1_200
export const EMBED_CHUNK_OVERLAP = 200
export const EMBED_MAX_CHUNKS = 40

const TEXT_NAME = /\.(txt|md|markdown)$/i
const BINARY_NAME = /\.(pdf|docx)$/i

export function isIndexableFileName(name: string): boolean {
  return TEXT_NAME.test(name)
}

export function isStoredBinaryName(name: string): boolean {
  return BINARY_NAME.test(name)
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
