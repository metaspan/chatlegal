/**
 * Enter sends. Shift+Enter keeps a line break.
 * That is the default send key in dcolley/tourbillon@7a8595b
 * apps/web/components/assistant/composer/composer.tsx (handleKeyDown → primary).
 * Modified Enter and an in-progress composition are left alone.
 */

export function composerSendsOnEnter(event: {
  key: string
  shiftKey?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  isComposing?: boolean
}): boolean {
  if (event.key !== 'Enter') return false
  if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false
  if (event.isComposing) return false
  return true
}
