/**
 * Right-pane viewer kinds. Each one is a stub until a document is opened.
 */

export const VIEWER_KINDS = ['markdown', 'image', 'pdf', 'chat-state'] as const

export type ViewerKind = (typeof VIEWER_KINDS)[number]

export const VIEWER_KIND_LABELS: Record<ViewerKind, string> = {
  markdown: 'Markdown',
  image: 'Image',
  pdf: 'PDF',
  'chat-state': 'Chat state',
}

const VIEWER_COPY: Record<ViewerKind, { heading: string; body: string }> = {
  markdown: {
    heading: 'Markdown',
    body: 'No document is open. A Markdown file will show here.',
  },
  image: {
    heading: 'Image',
    body: 'No image is open. A picture will show here.',
  },
  pdf: {
    heading: 'PDF',
    body: 'No PDF is open. A PDF will show here.',
  },
  'chat-state': {
    heading: 'Summary',
    body: 'No matter is open. Open a chat to see its summary.',
  },
}

export function isViewerKind(value: unknown): value is ViewerKind {
  return typeof value === 'string' && (VIEWER_KINDS as readonly string[]).includes(value)
}

export function viewerPanelCopy(kind: ViewerKind): { heading: string; body: string } {
  return VIEWER_COPY[kind]
}
