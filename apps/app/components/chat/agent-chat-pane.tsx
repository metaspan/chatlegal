'use client'

import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { ChatSidebarResizeHandle, useChatSidebarWidth } from './chat-sidebar-resize'

/**
 * Right-hand chat slot. Chrome and width only — no AG-UI client, composer send,
 * or model output. Adapted from the sidebar presentation in
 * dcolley/tourbillon@7a8595b apps/web/components/chat/agent-chat-pane.tsx.
 */
export function AgentChatPane() {
  const { width, dragging, onResizePointerDown, onResizeKeyDown } = useChatSidebarWidth()

  return (
    <aside
      aria-label="Chat"
      data-chat-sidebar
      className={cn(
        'relative flex w-full shrink-0 flex-col border-t bg-background max-md:h-72',
        'md:h-full md:w-(--chat-pane-width) md:border-t-0 md:border-l',
        dragging && 'select-none',
      )}
      style={{ '--chat-pane-width': `${width}px` } as CSSProperties}
    >
      <ChatSidebarResizeHandle
        dragging={dragging}
        onPointerDown={onResizePointerDown}
        onKeyDown={onResizeKeyDown}
      />
      <header className="flex h-12 shrink-0 items-center border-b px-4">
        <h2 className="font-serif text-sm font-semibold">Chat</h2>
      </header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4 text-sm text-muted-foreground">
        <p>Messages about the open matter will appear here.</p>
      </div>
      <form className="border-t p-3" onSubmit={(event) => event.preventDefault()}>
        <label className="sr-only" htmlFor="chat-draft">
          Message
        </label>
        <textarea
          id="chat-draft"
          disabled
          rows={3}
          placeholder="Chat is not connected yet."
          className="w-full resize-none rounded-lg border border-input bg-muted/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </form>
    </aside>
  )
}
