import type { MatterSummary } from './types.ts'

/**
 * Pure list moves behind the C-18 "Archived chats" modal, kept free of React
 * so the modal tests can exercise them directly. Nothing here deletes or
 * purges: an unarchived chat goes back to the history list, an opened chat
 * stays archived until it is unarchived.
 */

function isMatterSummary(value: unknown): value is MatterSummary {
  if (!value || typeof value !== 'object') return false
  const record = value as { id?: unknown; title?: unknown; createdAt?: unknown; updatedAt?: unknown }
  return (
    typeof record.id === 'string' &&
    record.id.trim().length > 0 &&
    typeof record.title === 'string' &&
    record.title.trim().length > 0 &&
    typeof record.createdAt === 'string' &&
    record.createdAt.length > 0 &&
    typeof record.updatedAt === 'string' &&
    record.updatedAt.length > 0
  )
}

/** Reads the { matters } body of GET /api/matters?archived=true. null on a bad body. */
export function parseArchivedMattersResponse(body: unknown): MatterSummary[] | null {
  if (!body || typeof body !== 'object') return null
  const matters = (body as { matters?: unknown }).matters
  if (!Array.isArray(matters)) return null
  if (!matters.every(isMatterSummary)) return null
  return sortArchived(matters)
}

/** Drops one chat from the archived list after a successful unarchive. */
export function applyUnarchiveToArchivedList(matters: readonly MatterSummary[], matterId: string): MatterSummary[] {
  return matters.filter((matter) => matter.id !== matterId)
}

/**
 * Puts a restored chat back into the history list, newest first. The sort
 * matches use-matter-sessions: updatedAt DESC, then id ASC.
 */
export function mergeRestoredMatter(matters: readonly MatterSummary[], matter: MatterSummary): MatterSummary[] {
  const without = matters.filter((item) => item.id !== matter.id)
  return sortArchived([matter, ...without])
}

function sortArchived(matters: readonly MatterSummary[]): MatterSummary[] {
  return [...matters].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
}
