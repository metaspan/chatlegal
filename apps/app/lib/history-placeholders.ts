/**
 * Static left-pane rows. No sessions are loaded. Chat wiring is a later slice.
 */

export const NEW_CHAT_ID = 'new-chat'

export type HistoryGroup = 'Chats' | 'Matters'

export type HistoryPlaceholder = {
  id: string
  group: HistoryGroup
  title: string
  detail: string
}

export const HISTORY_PLACEHOLDERS: readonly HistoryPlaceholder[] = [
  {
    id: 'chat-placeholder',
    group: 'Chats',
    title: 'Chat title',
    detail: 'Placeholder. No conversation is stored yet.',
  },
  {
    id: 'matter-placeholder',
    group: 'Matters',
    title: 'Matter title',
    detail: 'Placeholder. No matter is open yet.',
  },
]

export function filterHistory(items: readonly HistoryPlaceholder[], query: string): HistoryPlaceholder[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...items]
  return items.filter((item) => `${item.group} ${item.title} ${item.detail}`.toLowerCase().includes(needle))
}
