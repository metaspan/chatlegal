'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Library, PanelLeftClose, Plus, Search } from 'lucide-react'
import { PlanUsageCard } from '@/components/shell/plan-usage-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { filterMatterHistory, type MatterHistoryRow } from '@/lib/matters/filter'
import { cn } from '@/lib/utils'

/**
 * Left pane: search, a new chat, a link to the user library, and matter history.
 * List chrome adapted from dcolley/tourbillon@7a8595b
 * apps/web/components/assistant/sidebar.tsx (row, muted detail, active inset).
 * That sidebar is an agent rail and does not rename or archive threads, so
 * those actions are added here. Collapse is the existing pane control.
 * The Library control is a nav link only, in the shape of the sidebar item in
 * hitly-net/hitly@94b2e92 apps/app/components/app-sidebar.tsx (icon, label, href).
 * File lists and the add form live on /library, not in this pane.
 * Each row is one matter, which is one chat thread.
 * Archive hides a row. The thread stays stored. Show archived is a later slice.
 * The plan card is pinned under the list so it stays in view while history scrolls.
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
  onRename,
  onArchive,
  archivingId,
  onCollapse,
  libraryActive = false,
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
  onRename: (id: string, title: string) => Promise<{ ok: true } | { ok: false; message: string }>
  onArchive: (id: string) => void
  archivingId: string | null
  onCollapse: () => void
  libraryActive?: boolean
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const visible = filterMatterHistory(matters, query)
  const empty = loaded && !listError && matters.length === 0

  function startRename(item: MatterHistoryRow) {
    setEditingId(item.id)
    setDraftTitle(item.title)
    setRenameError(null)
  }

  function cancelRename() {
    setEditingId(null)
    setDraftTitle('')
    setRenameError(null)
  }

  async function saveRename(id: string) {
    setSavingId(id)
    setRenameError(null)
    const result = await onRename(id, draftTitle)
    setSavingId((current) => (current === id ? null : current))
    if (!result.ok) {
      setRenameError(result.message)
      return
    }
    setEditingId(null)
    setDraftTitle('')
  }

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
        <Label htmlFor="chat-search" className="text-xs font-medium text-muted-foreground">
          Search
        </Label>
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
      <nav aria-label="Library" className="px-3 pb-3">
        <Link
          href="/library"
          data-library-nav=""
          aria-current={libraryActive ? 'page' : undefined}
          className={cn(
            'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-sidebar-accent',
            libraryActive && 'bg-sidebar-accent font-medium shadow-[inset_3px_0_0_var(--chrome)]',
          )}
        >
          <Library className="size-4 shrink-0 text-muted-foreground" />
          Library
        </Link>
      </nav>
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
        ) : empty ? (
          <div data-matters-empty="" className="mt-3 px-1">
            <p className="text-xs text-muted-foreground">No matters yet. New chat opens one.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              data-empty-new-chat=""
              onClick={onNewChat}
              disabled={creating}
              aria-busy={creating}
            >
              <Plus />
              New chat
            </Button>
          </div>
        ) : visible.length === 0 ? (
          listError ? null : (
            <p className="mt-3 px-1 text-xs text-muted-foreground">No matters match that search.</p>
          )
        ) : (
          <ul className="mt-3 flex flex-col gap-1" aria-label="Matters">
            {visible.map((item) => (
              <HistoryRow
                key={item.id}
                item={item}
                active={item.id === activeId}
                editing={editingId === item.id}
                draftTitle={draftTitle}
                renameError={editingId === item.id ? renameError : null}
                saving={savingId === item.id}
                archiving={archivingId === item.id}
                onSelect={onSelect}
                onDraftTitle={setDraftTitle}
                onStartRename={() => startRename(item)}
                onCancelRename={cancelRename}
                onSaveRename={() => void saveRename(item.id)}
                onArchive={() => onArchive(item.id)}
              />
            ))}
          </ul>
        )}
      </div>
      <div data-plan-footer="" className="shrink-0 border-t px-3 py-3">
        <PlanUsageCard />
      </div>
    </aside>
  )
}

function HistoryRow({
  item,
  active,
  editing,
  draftTitle,
  renameError,
  saving,
  archiving,
  onSelect,
  onDraftTitle,
  onStartRename,
  onCancelRename,
  onSaveRename,
  onArchive,
}: {
  item: MatterHistoryRow
  active: boolean
  editing: boolean
  draftTitle: string
  renameError: string | null
  saving: boolean
  archiving: boolean
  onSelect: (id: string) => void
  onDraftTitle: (title: string) => void
  onStartRename: () => void
  onCancelRename: () => void
  onSaveRename: () => void
  onArchive: () => void
}) {
  if (editing) {
    return (
      <li>
        <form
          data-matter-id={item.id}
          aria-label={`Rename ${item.title}`}
          className="rounded-lg px-2 py-2 hover:bg-sidebar-accent"
          onSubmit={(event) => {
            event.preventDefault()
            onSaveRename()
          }}
        >
          <Label htmlFor={`matter-title-${item.id}`} className="text-xs font-medium text-muted-foreground">
            Title
          </Label>
          <Input
            id={`matter-title-${item.id}`}
            value={draftTitle}
            onChange={(event) => onDraftTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              event.preventDefault()
              onCancelRename()
            }}
            autoFocus
            disabled={saving}
            aria-invalid={renameError ? true : undefined}
            className="mt-1"
          />
          {renameError ? (
            <p role="alert" className="pt-1 text-xs text-muted-foreground">
              {renameError}
            </p>
          ) : null}
          <div className="flex gap-1 pt-2">
            <Button type="submit" size="xs" disabled={saving} aria-busy={saving}>
              Save
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={onCancelRename} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className={cn('rounded-lg', active && 'bg-sidebar-accent shadow-[inset_3px_0_0_var(--chrome)]')}>
      <button
        type="button"
        data-matter-id={item.id}
        aria-current={active ? 'true' : undefined}
        onClick={() => onSelect(item.id)}
        className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-sidebar-accent"
      >
        <span className="block truncate font-medium">{item.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
      </button>
      <div className="flex gap-1 px-1 pb-1">
        <Button type="button" variant="ghost" size="xs" aria-label={`Rename ${item.title}`} onClick={onStartRename}>
          Rename
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label={`Archive ${item.title}`}
          title="Hide from this list. The matter stays saved."
          onClick={onArchive}
          disabled={archiving}
          aria-busy={archiving}
        >
          Archive
        </Button>
      </div>
    </li>
  )
}
