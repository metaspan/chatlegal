/**
 * Thread title rule, narrowed from checkAssistantThreadTitle in
 * dcolley/tourbillon@7a8595b apps/web/lib/assistant/sidebar.ts:
 * trimmed, 1–200 characters, no control characters. An omitted title becomes
 * "New chat". A blank title is refused.
 */

export const MATTER_TITLE_MAX = 200
export const DEFAULT_MATTER_TITLE = 'New chat'

export class MatterTitleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MatterTitleError'
  }
}

export function resolveMatterTitle(raw: string | undefined): string {
  if (raw === undefined) return DEFAULT_MATTER_TITLE
  const title = raw.trim()
  if (!title) throw new MatterTitleError('Title cannot be empty.')
  if (title.length > MATTER_TITLE_MAX) {
    throw new MatterTitleError(`Title is too long (${MATTER_TITLE_MAX} characters max).`)
  }
  if (/[\u0000-\u001F\u007F]/.test(title)) {
    throw new MatterTitleError('Title cannot include control characters.')
  }
  return title
}
