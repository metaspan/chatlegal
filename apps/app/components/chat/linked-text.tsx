import { httpsLinkParts } from '@/lib/matters/links'

/**
 * Transcript text with https URLs as links.
 * The link text is the URL itself.
 */
export function LinkedText({ text }: { text: string }) {
  const parts = httpsLinkParts(text)
  return parts.map((part, index) =>
    part.kind === 'link' ? (
      <a key={`${part.href}-${index}`} href={part.href} target="_blank" rel="noopener noreferrer" className="underline break-all">
        {part.href}
      </a>
    ) : (
      <span key={`text-${index}`}>{part.text}</span>
    ),
  )
}
