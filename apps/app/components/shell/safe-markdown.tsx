import type { ReactNode } from 'react'
import { parseMarkdownBlocks, safeMarkdownHref, type MarkdownBlock } from '@/lib/viewer-markdown'

/**
 * Markdown preview. Children are React text, so a tag in the file stays text.
 */

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g

function inlineNodes(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = new RegExp(INLINE.source, 'g')
  let last = 0
  let count = 0
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
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
            className="text-link underline underline-offset-2"
          >
            {label}
          </a>
        ) : (
          <span key={id}>{label}</span>
        ),
      )
    }
    last = match.index + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function renderBlock(block: MarkdownBlock, index: number): ReactNode {
  const key = `block-${index}`
  if (block.type === 'h') {
    const className =
      block.level === 1
        ? 'font-serif text-lg font-semibold'
        : block.level === 2
          ? 'font-serif text-base font-semibold'
          : 'text-sm font-semibold'
    if (block.level === 1) return <h1 key={key} className={className}>{inlineNodes(block.text, key)}</h1>
    if (block.level === 2) return <h2 key={key} className={className}>{inlineNodes(block.text, key)}</h2>
    return <h3 key={key} className={className}>{inlineNodes(block.text, key)}</h3>
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
      <blockquote key={key} className="border-l-2 border-border pl-3 text-muted-foreground">
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
  return <p key={key}>{inlineNodes(block.text, key)}</p>
}

export function SafeMarkdown({ text }: { text: string }) {
  const blocks = parseMarkdownBlocks(text)
  return (
    <div data-markdown-preview className="flex max-w-prose flex-col gap-2 text-sm leading-relaxed break-words">
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  )
}
