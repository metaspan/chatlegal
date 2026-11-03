'use client'

import { useState, type CSSProperties } from 'react'
import { Activity, FileText, Image as ImageIcon, PanelRightClose, ScrollText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatSidebarResizeHandle, useChatSidebarWidth } from '@/components/chat/chat-sidebar-resize'
import { VIEWER_KINDS, VIEWER_KIND_LABELS, viewerPanelCopy, type ViewerKind } from '@/lib/viewer-kind'
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
 * Switching kind only changes the placeholder. Nothing is loaded.
 */
export function DocumentViewer({ onCollapse }: { onCollapse: () => void }) {
  const [kind, setKind] = useState<ViewerKind>('markdown')
  const { width, dragging, onResizePointerDown, onResizeKeyDown } = useChatSidebarWidth()
  const copy = viewerPanelCopy(kind)
  const Icon = KIND_ICONS[kind]

  return (
    <aside
      id="document-viewer"
      aria-label="Viewer"
      data-pane="viewer"
      data-viewer-kind={kind}
      className={cn(
        'relative flex h-full shrink-0 flex-col border-l bg-background',
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
        <h2 className="font-serif text-sm font-semibold">Viewer</h2>
        <div className="flex-1" />
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Hide viewer" onClick={onCollapse}>
          <PanelRightClose />
        </Button>
      </header>
      <div role="tablist" aria-label="What to show" className="flex flex-wrap gap-1 border-b px-3 py-2">
        {VIEWER_KINDS.map((item) => {
          const selected = item === kind
          return (
            <button
              key={item}
              type="button"
              role="tab"
              id={`viewer-tab-${item}`}
              aria-selected={selected}
              aria-controls="viewer-panel"
              onClick={() => setKind(item)}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium',
                selected ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {VIEWER_KIND_LABELS[item]}
            </button>
          )
        })}
      </div>
      <div
        id="viewer-panel"
        role="tabpanel"
        aria-labelledby={`viewer-tab-${kind}`}
        className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
      >
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
        <h3 className="font-serif text-lg font-semibold">{copy.heading}</h3>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
      </div>
    </aside>
  )
}
