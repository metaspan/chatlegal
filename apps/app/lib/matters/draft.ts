/**
 * Composer text keyed by the open matter. Switching matters keeps each draft.
 * Sending stays off until a model is connected, so this never becomes a message.
 */

export function draftText(drafts: Readonly<Record<string, string>>, matterId: string | null): string {
  if (!matterId) return ''
  return drafts[matterId] ?? ''
}

export function writeDraft(
  drafts: Readonly<Record<string, string>>,
  matterId: string,
  text: string,
): Record<string, string> {
  return { ...drafts, [matterId]: text }
}
