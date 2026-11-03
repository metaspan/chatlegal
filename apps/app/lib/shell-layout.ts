/**
 * Open or hidden state for the left and right panes.
 * Adapted from the sidebar collapse storage in
 * dcolley/tourbillon@7a8595b apps/web/components/assistant/sidebar.tsx.
 * The right pane width stays in lib/chat-layout-storage.ts.
 */

export const SHELL_LEFT_OPEN_KEY = 'chatlegal.shell.leftOpen'
export const SHELL_RIGHT_OPEN_KEY = 'chatlegal.shell.rightOpen'

export function readPaneOpen(key: string, fallback = true): boolean {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw === 'true') return true
    if (raw === 'false') return false
    return fallback
  } catch {
    return fallback
  }
}

export function writePaneOpen(key: string, open: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, String(open))
  } catch {
    // ignore quota and privacy-mode failures
  }
}
