/**
 * Owner key for a matter thread.
 * Adapted from the resource id in dcolley/tourbillon@7a8595b
 * apps/web/lib/assistant/threads.ts (assistantResourceId / chatResourceId).
 * That app scopes a thread to a company. ChatLegal scopes it to the signed-in
 * Clerk user. There is no company and no organisation.
 */

export const MATTER_KIND = 'matter'

export function matterResourceId(userId: string): string {
  const id = userId.trim()
  if (!id || /\s/.test(id)) {
    throw new Error('A Clerk user id is required.')
  }
  return `clerk:${id}`
}
