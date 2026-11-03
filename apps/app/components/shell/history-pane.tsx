'use client'

import { Library, PanelLeftClose, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { filterMatterHistory, type MatterHistoryRow } from '@/lib/matters/filter'
import { cn } from '@/lib/utils'

/**
 * Left pane: search, a new chat, library, and matter history.
 * List chrome adapted from dcolley/tourbillon@7a8595b
 * apps/web/components/assistant/sidebar.tsx.
 * Each row is one matter, which is one chat thread.
 */
export function HistoryPane({
  query,
  onQueryChange,
  matters,
  loaded,
  listError,
  activeId,
  onSelect,
  onNewChat,
  creating,
  onCollapse,
  libraryNote,
  onAddFile,
}: {
  query: string
  onQueryChange: (query: string) => void
  matters: readonly MatterHistoryRow[]
  loaded: boolean
  listError: string | null
  activeId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  creating: boolean
  onCollapse: () => void
  libraryNote: string | null
  onAddFile: () => void
}) {
  const visible = filterMatterHistory(matters, query)
  const searching = query.trim().length > 0

  return (
    <aside
      id="history-pane"
      aria-label="Chats"
      data-pane="history"
      className="flex h-full w-72 max-md:w-full max-md:max-w-sm shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:shadow-lg"
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Chats</p>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Hide chats" onClick={onCollapse}>
          <PanelLeftClose />
        </Button>
      </div>
      <form role="search" className="px-3 pt-2" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="chat-search" className="text-xs font-medium text-muted-foreground">
          Search
        </label>
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="chat-search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search matters"
            className="pl-8"
          />
        </div>
      </form>
      <div className="px-3 py-3">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          onClick={onNewChat}
          disabled={creating}
          aria-busy={creating}
        >
          <Plus />
          New chat
        </Button>
      </div>
      <section aria-labelledby="library-heading" className="mx-3 mb-3 rounded-lg border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <Library className="size-4 text-muted-foreground" />
          <h2 id="library-heading" className="text-sm font-semibold">
            Library
          </h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">No files yet.</p>
        <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={onAddFile}>
          Add a file
        </Button>
        {libraryNote ? (
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            {libraryNote}
          </p>
        ) : null}
      </section>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">History</h2>
        <p className="px-1 pt-1 text-xs text-muted-foreground">One matter is one chat.</p>
        {listError ? (
          <p role="alert" className="mt-3 px-1 text-xs text-muted-foreground">
            {listError}
          </p>
        ) : null}
        {!loaded ? (
          <p className="mt-3 px-1 text-xs text-muted-foreground">Loading matters…</p>
        ) : visible.length === 0 && !listError ? (
          <p className="mt-3 px-1 text-xs text-muted-foreground">
            {searching ? 'No matters match that search.' : 'No matters yet. New chat opens one.'}
          </p>
        ) : visible.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1" aria-label="Matters">
            {visible.map((item) => (
              <HistoryRow key={item.id} item={item} active={item.id === activeId} onSelect={onSelect} />
            ))}
          </ul>
        ) : null}
      </div>
    </aside>
  )
}

function HistoryRow({
  item,
  active,
  onSelect,
}: {
  item: MatterHistoryRow
  active: boolean
  onSelect: (id: string) => void
}) {
  return (
    <li>
      <button
        type="button"
        data-matter-id={item.id}
        aria-current={active ? 'true' : undefined}
        onClick={() => onSelect(item.id)}
        className={cn(
          'w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-sidebar-accent',
          active && 'bg-sidebar-accent',
        )}
      >
        <span className="block truncate font-medium">{item.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
      </button>
    </li>
  )
}
