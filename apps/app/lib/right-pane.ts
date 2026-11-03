/**
 * What the right pane is showing.
 * Chat state is the resting view. A document viewer opens only on request
 * and dismisses back to chat state.
 *
 * Adapted from dcolley/tourbillon@7a8595b
 * apps/web/components/chat/chat-context.tsx (the docked right slot is chat;
 * openChat and closeChat) and
 * apps/web/components/workspace/workspace-file-pane.tsx (file contents render
 * only after a path is selected).
 */

import type { ViewerKind } from './viewer-kind'

export const DOCUMENT_VIEWER_KINDS = ['markdown', 'image', 'pdf'] as const

export type DocumentViewerKind = (typeof DOCUMENT_VIEWER_KINDS)[number]

export type OpenedDocument = {
  name: string
  scope: 'user' | 'matter'
  /** Set for a matter file, so leaving that matter returns to chat state. */
  matterId: string | null
  kind: DocumentViewerKind
}

export type RightPaneView =
  | { mode: 'chat-state'; document: null }
  | { mode: 'document'; document: OpenedDocument }

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'])

export function defaultRightPaneView(): RightPaneView {
  return { mode: 'chat-state', document: null }
}

export function viewerKindForFileName(name: string): DocumentViewerKind {
  const ext = extensionOf(name)
  if (ext === 'pdf') return 'pdf'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  return 'markdown'
}

/** Visible kind. Other files reuse the markdown viewer without calling them Markdown. */
export function openedViewerLabel(name: string, kind: DocumentViewerKind): string {
  if (kind === 'pdf') return 'PDF'
  if (kind === 'image') return 'Image'
  const ext = extensionOf(name)
  if (ext === 'md' || ext === 'markdown') return 'Markdown'
  return 'File'
}

export function openRightPaneDocument(input: {
  name: string
  scope: 'user' | 'matter'
  matterId?: string | null
  kind?: DocumentViewerKind
}): RightPaneView {
  const name = input.name.trim()
  if (!name) return defaultRightPaneView()
  const kind = input.kind ?? viewerKindForFileName(name)
  return {
    mode: 'document',
    document: {
      name,
      scope: input.scope,
      matterId: input.scope === 'matter' ? (input.matterId ?? null) : null,
      kind,
    },
  }
}

export function dismissRightPaneDocument(): RightPaneView {
  return defaultRightPaneView()
}

/**
 * A matter file stays up only while that matter is open.
 * A library file is not tied to the matter.
 */
export function retainOpenedDocument(view: RightPaneView, activeMatterId: string | null): RightPaneView {
  if (view.mode !== 'document') return view
  if (view.document.scope !== 'matter') return view
  if (view.document.matterId === activeMatterId) return view
  return defaultRightPaneView()
}

export function rightPaneKind(view: RightPaneView): ViewerKind {
  return view.mode === 'document' ? view.document.kind : 'chat-state'
}

function extensionOf(name: string): string {
  const base = name.trim().split(/[/\\]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return ''
  return base.slice(dot + 1).toLowerCase()
}
