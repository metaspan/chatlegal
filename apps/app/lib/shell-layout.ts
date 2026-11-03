/**
 * Open or hidden state for the left and right panes.
 * Adapted from the sidebar collapse storage in
 * dcolley/tourbillon@7a8595b apps/web/components/assistant/sidebar.tsx.
 * The right pane width stays in lib/chat-layout-storage.ts.
 * Edge chevrons follow the hideable docs sidebar in BerriAI/litellm-docs
 * (sidebar.hideable and DocSidebar/Desktop/CollapseButton): a visible control
 * stays when the pane is hidden. No LiteLLM colour or brand.
 */

export const SHELL_LEFT_OPEN_KEY = 'chatlegal.shell.leftOpen'
export const SHELL_RIGHT_OPEN_KEY = 'chatlegal.shell.rightOpen'

type EscapeKey = {
  key: string
  defaultPrevented?: boolean
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
}

/**
 * Escape shows the left pane again only when both panes are hidden.
 * One open pane already leaves the top bar and that pane's edge control.
 * Menus that called preventDefault, and modified Escape, are left alone.
 */
export function escapeRestoresLeftPane(
  event: EscapeKey,
  panes: { leftOpen: boolean; rightOpen: boolean },
): boolean {
  if (event.key !== 'Escape') return false
  if (event.defaultPrevented) return false
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false
  return !panes.leftOpen && !panes.rightOpen
}

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
