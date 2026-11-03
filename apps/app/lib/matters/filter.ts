/**
 * Case-insensitive search. Every whitespace-separated term must match.
 * Adapted from filterThreadsByTitle in dcolley/tourbillon@7a8595b
 * apps/web/lib/assistant/sidebar.ts. The detail line is included so a date
 * can be searched as well as the title.
 */

export type MatterHistoryRow = {
  id: string
  title: string
  detail: string
}

export function filterMatterHistory<T extends Pick<MatterHistoryRow, 'title' | 'detail'>>(
  items: readonly T[],
  query: string,
): T[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return [...items]
  return items.filter((item) => {
    const haystack = `${item.title} ${item.detail}`.toLocaleLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}
