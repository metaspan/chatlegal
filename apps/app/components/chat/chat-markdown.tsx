import type { ReactNode } from 'react'
import { httpsLinkParts } from '@/lib/matters/links'
import { parseMarkdownBlocks, safeMarkdownHref, type MarkdownBlock } from '@/lib/viewer-markdown'

/**
 * C-14: the centre transcript renders ChatLegal's words as Markdown — bold,
 * italic, inline code, ordered and unordered lists, links, headings, quotes,
 * fenced code, and paragraphs.
 *
 * Reuse: the block parser and link safety come from the file-preview Markdown
 * (lib/viewer-markdown.ts + components/shell/safe-markdown.tsx), which follows
 * dcolley/tourbillon@7a8595b apps/web/components/assistant/message-markdown.tsx
 * — text is never parsed as HTML (a tag in a message stays text) and a link
 * keeps only http(s), mailto, or a relative target. Bare https URLs are
 * linkified through lib/matters/links.ts, where the visible text equals the
 * destination. hitly-net/hitly@94b2e92 apps/app/components/context-markdown.tsx
 * is the read-only block this pattern replaced there.
 *
 * Paragraphs keep their source line breaks (parseMarkdownBlocks option), so a
 * list of official pages still reads one page per row.
 *
 * The person's own words are NOT rendered here: user rows stay verbatim
 * (LinkedText) so what they typed shows exactly as typed.
 */

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g

function plainNodes(text: string, key: string): ReactNode[] {
  const parts = httpsLinkParts(text)
  if (parts.every((part) => part.kind === 'text')) {
    // No link in this run: keep it as a plain string, no wrapper element.
    return [text]
  }
  return parts.map((part, index) =>
    part.kind === 'link' ? (
      <a
        key={`${key}-link-${index}`}
        href={part.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-link underline break-all"
      >
        {part.href}
      </a>
    ) : (
      <span key={`${key}-text-${index}`}>{part.text}</span>
    ),
  )
}

function inlineNodes(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = new RegExp(INLINE.source, 'g')
  let last = 0
  let count = 0
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) nodes.push(...plainNodes(text.slice(last, match.index), `${key}-p${count}`))
    const token = match[0]
    const id = `${key}-${count}`
    count += 1
    if (token.startsWith('`')) {
      nodes.push(
        <code key={id} className="rounded bg-muted px-1 font-mono text-xs">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={id}>{inlineNodes(token.slice(2, -2), id)}</strong>)
    } else if (token.startsWith('*')) {
      nodes.push(<em key={id}>{token.slice(1, -1)}</em>)
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      const label = link?.[1] ?? token
      const href = link ? safeMarkdownHref(link[2] ?? '') : null
      nodes.push(
        href ? (
          <a
            key={id}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-link underline underline-offset-2 break-all"
          >
            {label}
          </a>
        ) : (
          // An unsafe target keeps its text and gains no link (same rule as the preview).
          <span key={id}>{label}</span>
        ),
      )
    }
    last = match.index + token.length
  }
  if (last < text.length) nodes.push(...plainNodes(text.slice(last), `${key}-tail`))
  return nodes
}

function renderBlock(block: MarkdownBlock, index: number): ReactNode {
  const key = `block-${index}`
  if (block.type === 'h') {
    const className =
      block.level === 1
        ? 'font-serif text-base font-semibold'
        : block.level === 2
          ? 'font-serif text-sm font-semibold'
          : 'text-sm font-semibold'
    if (block.level === 1) return <h2 key={key} className={className}>{inlineNodes(block.text, key)}</h2>
    if (block.level === 2) return <h3 key={key} className={className}>{inlineNodes(block.text, key)}</h3>
    return <h4 key={key} className={className}>{inlineNodes(block.text, key)}</h4>
  }
  if (block.type === 'ul') {
    return (
      <ul key={key} className="list-disc space-y-1 pl-5">
        {block.items.map((item, itemIndex) => (
          <li key={`${key}-${itemIndex}`}>{inlineNodes(item, `${key}-${itemIndex}`)}</li>
        ))}
      </ul>
    )
  }
  if (block.type === 'ol') {
    return (
      <ol key={key} className="list-decimal space-y-1 pl-5">
        {block.items.map((item, itemIndex) => (
          <li key={`${key}-${itemIndex}`}>{inlineNodes(item, `${key}-${itemIndex}`)}</li>
        ))}
      </ol>
    )
  }
  if (block.type === 'quote') {
    return (
      <blockquote key={key} className="border-l-2 border-border pl-3 whitespace-pre-line text-muted-foreground">
        {inlineNodes(block.text, key)}
      </blockquote>
    )
  }
  if (block.type === 'code') {
    return (
      <pre key={key} className="overflow-x-auto rounded-md border bg-card p-3 text-xs whitespace-pre-wrap">
        <code>{block.text}</code>
      </pre>
    )
  }
  return <p key={key} className="whitespace-pre-line">{inlineNodes(block.text, key)}</p>
}

export function ChatMarkdown({ text }: { text: string }) {
  const blocks = parseMarkdownBlocks(text, { joinParagraphs: false })
  return (
    <div data-chat-markdown className="flex flex-col gap-2 break-words">
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  )
}
