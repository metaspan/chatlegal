'use client'

import type { CSSProperties } from 'react'
import { Activity, FileText, Image as ImageIcon, PanelRightClose, ScrollText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatSidebarResizeHandle, useChatSidebarWidth } from '@/components/chat/chat-sidebar-resize'
import { MatterSummary } from '@/components/shell/matter-summary'
import { openedViewerLabel, type OpenedDocument } from '@/lib/right-pane'
import type { ViewerKind } from '@/lib/viewer-kind'
import type { MatterObservations, MatterThreadStatus } from '@/lib/matters/types'
import { cn } from '@/lib/utils'

const KIND_ICONS: Record<ViewerKind, LucideIcon> = {
  markdown: FileText,
  image: ImageIcon,
  pdf: ScrollText,
  'chat-state': Activity,
}

/**
 * Right pane. Width drag is the docked-sidebar handle from
 * dcolley/tourbillon@7a8595b apps/web/components/chat/chat-sidebar-resize.tsx.
 * Resting content is chat state (the open matter's summary). A Markdown,
 * image, PDF, or other file viewer renders only after one is opened, the
 * same rule as workspace-file-pane.tsx in that pin: no path, no file body.
 * Closing the file returns to chat state. The file text is not shown here.
 */
export function DocumentViewer({
  onCollapse,
  onDismiss,
  matterId = null,
  threadStatus = 'idle',
  observations = null,
  document = null,
}: {
  onCollapse: () => void
  onDismiss: () => void
  matterId?: string | null
  threadStatus?: MatterThreadStatus
  observations?: MatterObservations | null
  /** Set only after an explicit open. Null is chat state. */
  document?: OpenedDocument | null
}) {
  const { width, dragging, onResizePointerDown, onResizeKeyDown } = useChatSidebarWidth()
  const kind: ViewerKind = document ? document.kind : 'chat-state'
  const Icon = KIND_ICONS[kind]
  const heading = document ? document.name : 'Chat state'

  return (
    <aside
      id="document-viewer"
      aria-label="Viewer"
      data-pane="viewer"
      data-viewer-kind={kind}
      data-open-document={document?.name ?? ''}
      className={cn(
        'relative flex h-full shrink-0 flex-col border-l bg-sidebar text-sidebar-foreground',
        'max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-30 max-md:w-full max-md:max-w-sm max-md:shadow-lg',
        'md:w-[min(var(--viewer-pane-width),calc(100vw-38rem))]',
        dragging && 'select-none',
      )}
      style={{ '--viewer-pane-width': `${width}px` } as CSSProperties}
    >
      <ChatSidebarResizeHandle
        ariaLabel="Resize viewer"
        dragging={dragging}
        onPointerDown={onResizePointerDown}
        onKeyDown={onResizeKeyDown}
      />
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <h2 id="viewer-heading" className="min-w-0 flex-1 truncate font-serif text-sm font-semibold">
          {heading}
        </h2>
        {document ? (
          <Button type="button" variant="ghost" size="sm" aria-label="Close document" onClick={onDismiss}>
            Close
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Hide viewer" onClick={onCollapse}>
          <PanelRightClose />
        </Button>
      </header>
      <div id="viewer-panel" aria-labelledby="viewer-heading" className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
        {document ? (
          <>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {openedViewerLabel(document.name, document.kind)}
            </p>
            <h3 className="font-serif text-lg font-semibold break-words">{document.name}</h3>
            <p className="text-sm text-muted-foreground">This file is open in the viewer.</p>
          </>
        ) : (
          <MatterSummary matterId={matterId} status={threadStatus} observations={observations} />
        )}
      </div>
    </aside>
  )
}
