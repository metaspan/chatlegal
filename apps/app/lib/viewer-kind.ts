/**
 * Right-pane viewer kinds.
 * Chat state is the resting view. Markdown, image, and PDF are shown only
 * after a file is opened (see lib/right-pane.ts). A Word document is stored
 * and offered as a download. It is not rendered. People, dates, and status
 * are other views in the same pane. People stay a labelled stub until a
 * matter stores them. Dates and status read the open matter.
 */

export const VIEWER_KINDS = ['markdown', 'image', 'pdf', 'docx', 'chat-state', 'parties', 'dates', 'status'] as const

export type ViewerKind = (typeof VIEWER_KINDS)[number]

export const VIEWER_KIND_LABELS: Record<ViewerKind, string> = {
  markdown: 'Markdown',
  image: 'Image',
  pdf: 'PDF',
  docx: 'Word document',
  'chat-state': 'Chat state',
  parties: 'People',
  dates: 'Dates',
  status: 'Status',
}

const VIEWER_COPY: Record<ViewerKind, { heading: string; body: string }> = {
  markdown: {
    heading: 'Markdown',
    body: 'A Markdown file shows here when you open one.',
  },
  image: {
    heading: 'Image',
    body: 'A picture shows here when you open one.',
  },
  pdf: {
    heading: 'PDF',
    body: 'A PDF shows here when you open one.',
  },
  docx: {
    heading: 'Word document',
    body: 'A Word document can be downloaded. It is not shown here.',
  },
  'chat-state': {
    heading: 'Summary',
    body: 'No matter is open. Open a chat to see its summary.',
  },
  parties: {
    heading: 'People',
    body: 'People in this matter are not stored yet.',
  },
  dates: {
    heading: 'Dates',
    body: 'Dates on this matter come from the chat.',
  },
  status: {
    heading: 'Status',
    body: 'Where this chat stands.',
  },
}

export function isViewerKind(value: unknown): value is ViewerKind {
  return typeof value === 'string' && (VIEWER_KINDS as readonly string[]).includes(value)
}

export function viewerPanelCopy(kind: ViewerKind): { heading: string; body: string } {
  return VIEWER_COPY[kind]
}
