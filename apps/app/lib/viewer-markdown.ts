/**
 * A small Markdown preview for an opened file.
 * Safety follows dcolley/tourbillon@7a8595b
 * apps/web/components/assistant/message-markdown.tsx: text is never parsed as
 * HTML, and a link is kept only for http(s), mailto, or a relative path.
 * hitly-net/hitly@94b2e92 apps/app/components/context-markdown.tsx is the
 * read-only block this replaces. Its remark pipeline and zinc colours are not used.
 */

export type MarkdownBlock =
  | { type: 'h'; level: 1 | 2 | 3; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; text: string }

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/** A link target the preview may use. Anything else is dropped. */
export function safeMarkdownHref(raw: string): string | null {
  const href = raw.trim()
  if (!href || href.length > 2000) return null
  if (href.startsWith('/') && !href.startsWith('//')) return href
  if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) return null
  try {
    const url = new URL(href)
    return SAFE_PROTOCOLS.has(url.protocol) ? href : null
  } catch {
    return null
  }
}

function isBlockStart(line: string): boolean {
  return (
    line.startsWith('```') ||
    /^#{1,3}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line)
  )
}

export interface MarkdownParseOptions {
  /**
   * Join the lines of a paragraph (or quote) with a space, as Markdown does
   * (default, used by the file preview). Pass false in the chat transcript,
   * where one source line per row is part of the answer's shape (C-14).
   */
  joinParagraphs?: boolean
}

export function parseMarkdownBlocks(source: string, options: MarkdownParseOptions = {}): MarkdownBlock[] {
  const joiner = options.joinParagraphs === false ? '\n' : ' '
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (line.trim() === '') {
      index += 1
      continue
    }
    if (line.startsWith('```')) {
      const code: string[] = []
      index += 1
      while (index < lines.length && !(lines[index] ?? '').startsWith('```')) {
        code.push(lines[index] ?? '')
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push({ type: 'code', text: code.join('\n') })
      continue
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1]?.length
      if (level === 1 || level === 2 || level === 3) {
        blocks.push({ type: 'h', level, text: heading[2] ?? '' })
      }
      index += 1
      continue
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
        quote.push((lines[index] ?? '').replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push({ type: 'quote', text: quote.join('\n') })
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^[-*]\s+/.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^[-*]\s+/, ''))
        index += 1
      }
      blocks.push({ type: 'ul', items })
      continue
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^\d+\.\s+/, ''))
        index += 1
      }
      blocks.push({ type: 'ol', items })
      continue
    }
    const paragraph = [line]
    index += 1
    while (index < lines.length && (lines[index] ?? '').trim() !== '' && !isBlockStart(lines[index] ?? '')) {
      paragraph.push(lines[index] ?? '')
      index += 1
    }
    blocks.push({ type: 'p', text: paragraph.join(joiner) })
  }
  return blocks
}
