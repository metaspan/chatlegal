/**
 * Right-hand viewer width, persisted in localStorage.
 * Adapted from dcolley/tourbillon@7a8595b apps/web/lib/chat-layout-storage.ts.
 * The storage key is unchanged. Fab / popover layout modes stay deferred.
 */

export const CHAT_SIDEBAR_WIDTH_STORAGE_KEY = 'chatlegal.chat.sidebarWidth'

/** Default / clamp for the docked chat sidebar width (px). */
export const CHAT_SIDEBAR_WIDTH_DEFAULT = 448
export const CHAT_SIDEBAR_WIDTH_MIN = 280
export const CHAT_SIDEBAR_WIDTH_MAX = 900

export function clampChatSidebarWidth(width: number, max = CHAT_SIDEBAR_WIDTH_MAX): number {
  if (!Number.isFinite(width)) return CHAT_SIDEBAR_WIDTH_DEFAULT
  return Math.min(max, Math.max(CHAT_SIDEBAR_WIDTH_MIN, Math.round(width)))
}

export function readChatSidebarWidth(): number {
  if (typeof window === 'undefined') return CHAT_SIDEBAR_WIDTH_DEFAULT
  try {
    const raw = localStorage.getItem(CHAT_SIDEBAR_WIDTH_STORAGE_KEY)
    if (raw == null) return CHAT_SIDEBAR_WIDTH_DEFAULT
    return clampChatSidebarWidth(Number(raw))
  } catch {
    return CHAT_SIDEBAR_WIDTH_DEFAULT
  }
}

export function writeChatSidebarWidth(width: number): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CHAT_SIDEBAR_WIDTH_STORAGE_KEY, String(clampChatSidebarWidth(width)))
  } catch {
    // ignore quota and privacy-mode failures
  }
}
