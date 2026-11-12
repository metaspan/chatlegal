'use client'

import { type KeyboardEvent } from 'react'
import { Archive, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { filterMatterHistory, type MatterHistoryRow } from '@/lib/matters/filter'
import { cn } from '@/lib/utils'

/**
 * The C-18 "Archived chats" modal, opened from the left pane near the chat
 * history. It lists the archived chats behind the C-12 archive flag
 * (GET /api/matters?archived=true), searches them by title, and offers two
 * actions per chat: Open and Unarchive.
 * Open reads the chat and leaves it archived — only Unarchive restores it
 * to the history list. There is no delete and no purge anywhere here.
 * The modal shell is the dialog primitive adapted from
 * dcolley/tourbillon@7a8595b apps/web/components/ui/dialog.tsx (Base UI
 * Dialog: focus trap in, Escape closes, Tab cycles inside, focus returns to
 * the trigger). The row chrome and the title search follow the same
 * dcolley/tourbillon@7a8595b list patterns as the history pane
 * (apps/web/components/assistant/sidebar.tsx and its filterThreadsByTitle,
 * reused here as filterMatterHistory). The list-with-filter-and-actions
 * shape follows hitly-net/hitly@94b2e92 apps/app/components/project-list.tsx
 * (search box above a filtered <ul> with a muted empty/no-match line).
 * Arrow keys move between the row actions; Tab walks them as usual.
 * Citizen copy says "chat", never the internal storage word.
 * The body is exported beside the modal so the list states render under
 * renderToStaticMarkup the way the history pane does; the dialog primitive
 * portals and renders nothing on the server.
 */
export type ArchivedChatsBodyProps = {
  rows: readonly MatterHistoryRow[]
  loaded: boolean
  listError: string | null
  query: string
  onQueryChange: (query: string) => void
  onOpen: (id: string) => void
  onUnarchive: (id: string) => void
  unarchivingId: string | null
  onRetry: () => void
}

export function ArchivedChatsBody({
  rows,
  loaded,
  listError,
  query,
  onQueryChange,
  onOpen,
  onUnarchive,
  unarchivingId,
  onRetry,
}: ArchivedChatsBodyProps) {
  const visible = filterMatterHistory(rows, query)
  const empty = loaded && !listError && rows.length === 0

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const actions = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-archived-row-action]'),
    )
    if (actions.length === 0) return
    const current = actions.indexOf(document.activeElement as HTMLButtonElement)
    const step = event.key === 'ArrowDown' ? 1 : -1
    const next = actions[(current + step + actions.length) % actions.length]
    next?.focus()
  }

  return (
    <>
      <form role="search" onSubmit={(event) => event.preventDefault()}>
        <Label htmlFor="archived-chat-search" className="text-xs font-medium text-muted-foreground">
          Search
        </Label>
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="archived-chat-search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search archived chats"
            className="pl-8"
          />
        </div>
      </form>
      {listError ? (
        <div data-archived-error="" className="flex flex-col gap-2">
          <p role="alert" className="text-xs text-muted-foreground">
            {listError}
          </p>
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : !loaded ? (
        <p data-archived-loading="" className="text-xs text-muted-foreground">
          Loading archived chats…
        </p>
      ) : empty ? (
        <p data-archived-empty="" className="text-xs text-muted-foreground">
          No archived chats yet.
        </p>
      ) : visible.length === 0 ? (
        <p data-archived-no-results="" className="text-xs text-muted-foreground">
          No archived chats match that search.
        </p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto" aria-label="Archived chats" onKeyDown={onListKeyDown}>
          {visible.map((item) => {
            const unarchiving = unarchivingId === item.id
            return (
              <li
                key={item.id}
                data-archived-chat-id={item.id}
                className={cn('flex items-start gap-1 rounded-lg', unarchiving && 'opacity-70')}
              >
                <button
                  type="button"
                  data-archived-row-action=""
                  aria-label={`Open ${item.title}`}
                  onClick={() => onOpen(item.id)}
                  className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left text-sm hover:bg-sidebar-accent"
                >
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  data-archived-row-action=""
                  aria-label={`Unarchive ${item.title}`}
                  className="mt-1 shrink-0"
                  disabled={unarchiving}
                  aria-busy={unarchiving || undefined}
                  onClick={() => onUnarchive(item.id)}
                >
                  {unarchiving ? 'Unarchiving…' : 'Unarchive'}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

export function ArchivedChatsModal({
  open,
  onOpenChange,
  ...body
}: ArchivedChatsBodyProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent aria-label="Archived chats" className="sm:max-w-md" data-archived-chats="">
        <DialogHeader>
          <DialogTitle>Archived chats</DialogTitle>
          <DialogDescription>
            Archived chats stay saved. Opening a chat only reads it — it stays archived. Only
            Unarchive puts it back in your list.
          </DialogDescription>
        </DialogHeader>
        <ArchivedChatsBody {...body} />
      </DialogContent>
    </Dialog>
  )
}

/** The left-pane trigger, next to the chat history controls. */
export function ArchivedChatsTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      data-archived-chats-nav=""
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-sidebar-accent"
    >
      <Archive className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      Archived chats
    </button>
  )
}
