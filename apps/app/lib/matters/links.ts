/**
 * Turns https URLs in transcript text into links.
 * The visible text and the href are the same URL, so a label cannot hide a different destination.
 * Anything that is not https, including a URL with a user name, stays plain text.
 */

export type TextPart = { kind: 'text'; text: string } | { kind: 'link'; href: string }

const HTTPS = /https:\/\/[^\s<>"']+/g

function splitTrailingPunctuation(href: string): { href: string; trailing: string } {
  let trailing = ''
  while (href.length > 'https://'.length && /[),.;:!?]$/.test(href)) {
    trailing = href.slice(-1) + trailing
    href = href.slice(0, -1)
  }
  return { href, trailing }
}

export function httpsLinkParts(value: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const match of value.matchAll(HTTPS)) {
    const start = match.index ?? 0
    const raw = match[0]
    if (start > last) parts.push({ kind: 'text', text: value.slice(last, start) })
    const split = splitTrailingPunctuation(raw)
    if (split.href.includes('@') || split.href === 'https://') {
      parts.push({ kind: 'text', text: raw })
    } else {
      parts.push({ kind: 'link', href: split.href })
      if (split.trailing) parts.push({ kind: 'text', text: split.trailing })
    }
    last = start + raw.length
  }
  if (last < value.length) parts.push({ kind: 'text', text: value.slice(last) })
  if (parts.length === 0) parts.push({ kind: 'text', text: value })
  const merged: TextPart[] = []
  for (const part of parts) {
    const previous = merged.at(-1)
    if (part.kind === 'text' && previous?.kind === 'text') {
      previous.text += part.text
      continue
    }
    merged.push(part)
  }
  return merged
}
