'use client'

import type { CSSProperties } from 'react'
import { Activity, Calendar, CircleDot, File, FileText, Image as ImageIcon, PanelRightClose, ScrollText, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatSidebarResizeHandle, useChatSidebarWidth } from '@/components/chat/chat-sidebar-resize'
import { FilePreview, useOpenedFileText, type OpenedFileBody } from '@/components/shell/file-preview'
import { MatterPaneViews } from '@/components/shell/matter-pane-views'
import { MatterSummary } from '@/components/shell/matter-summary'
import type { MatterViewMatter } from '@/lib/matters/matter-views'
import { chatStateNarration } from '@/lib/matters/matter-views'
import type { MatterMessage, MatterObservations, MatterThreadStatus } from '@/lib/matters/types'
import { openedViewerLabel, type MatterPaneView, type OpenedDocument, type RestingPaneView } from '@/lib/right-pane'
import type { ViewerKind } from '@/lib/viewer-kind'
import { cn } from '@/lib/utils'

const KIND_ICONS: Record<ViewerKind, LucideIcon> = {
  markdown: FileText,
  image: ImageIcon,
  pdf: ScrollText,
  docx: File,
  'chat-state': Activity,
  parties: Users,
  dates: Calendar,
  status: CircleDot,
}

const VIEW_SWITCH: { mode: RestingPaneView; label: string }[] = [
  { mode: 'chat-state', label: 'Summary' },
  { mode: 'parties', label: 'People' },
  { mode: 'dates', label: 'Dates' },
  { mode: 'status', label: 'Status' },
]

/**
 * Right pane. Width drag is the docked-sidebar handle from
 * dcolley/tourbillon@7a8595b apps/web/components/chat/chat-sidebar-resize.tsx.
 * Resting content is chat state. A file renders only after Open, the same
 * rule as workspace-file-pane.tsx in that pin. Close returns to chat state.
 * People, dates, and status are further views in this pane.
 */
export function DocumentViewer({
  onCollapse,
  onDismiss,
  onSelectView,
  matterId = null,
  threadStatus = 'idle',
  observations = null,
  matter = null,
  messages = [],
  replying = false,
  document = null,
  viewMode = 'chat-state',
  fileBody,
}: {
  onCollapse: () => void
  onDismiss: () => void
  onSelectView?: (mode: RestingPaneView) => void
  matterId?: string | null
  threadStatus?: MatterThreadStatus
  observations?: MatterObservations | null
  matter?: MatterViewMatter | null
  messages?: readonly MatterMessage[]
  /** The Concierge stream is still filling the chat (G-01 narration). */
  replying?: boolean
  /** Set only after an explicit open. Null is not a file. */
  document?: OpenedDocument | null
  viewMode?: RestingPaneView | 'document'
  /** Tests pass the file text. The pane loads it when this is omitted. */
  fileBody?: OpenedFileBody
}) {
  const { width, dragging, onResizePointerDown, onResizeKeyDown } = useChatSidebarWidth()
  const opened = useOpenedFileText(document, fileBody)
  const resting: RestingPaneView = !document && viewMode !== 'document' ? viewMode : 'chat-state'
  const kind: ViewerKind = document ? document.kind : resting
  const Icon = KIND_ICONS[kind]
  const heading = document
    ? document.name
    : resting === 'parties'
      ? 'People'
      : resting === 'dates'
        ? 'Dates'
        : resting === 'status'
          ? 'Status'
          : 'Chat state'

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
      <div role="group" aria-label="Viewer views" className="flex flex-wrap gap-1 border-b px-3 py-2">
        {VIEW_SWITCH.map((item) => {
          const active = !document && resting === item.mode
          return (
            <Button
              key={item.mode}
              type="button"
              size="xs"
              variant={active ? 'secondary' : 'ghost'}
              data-viewer-switch={item.mode}
              aria-pressed={active}
              onClick={() => onSelectView?.(item.mode)}
            >
              {item.label}
            </Button>
          )
        })}
      </div>
      <div id="viewer-panel" aria-labelledby="viewer-heading" className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {document ? (
          <>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {openedViewerLabel(document.name, document.kind)}
            </p>
            <FilePreview document={document} loading={opened.loading} body={opened.body} />
          </>
        ) : resting === 'chat-state' ? (
          <>
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="size-5" />
            </div>
            <MatterSummary matterId={matterId} status={threadStatus} observations={observations} />
            {matterId && threadStatus === 'ready' ? (
              <>
                <h3 className="font-serif text-sm font-semibold">Where this chat stands</h3>
                <p data-chat-state-narration className="text-sm leading-relaxed text-muted-foreground">
                  {chatStateNarration({
                    status: threadStatus,
                    messageCount: messages.length,
                    messages,
                    replying,
                  }) ?? 'Write what has happened, in your own words. This is not legal advice.'}
                </p>
              </>
            ) : null}
          </>
        ) : (
          <MatterPaneViews
            mode={resting}
            matterId={matterId}
            matter={matter}
            messages={messages}
            threadStatus={threadStatus}
            observations={observations}
            replying={replying}
          />
        )}
      </div>
    </aside>
  )
}
