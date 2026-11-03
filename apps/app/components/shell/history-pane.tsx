'use client'

import { useState, type FormEvent } from 'react'
import { Library, PanelLeftClose, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { filterMatterHistory, type MatterHistoryRow } from '@/lib/matters/filter'
import type { WorkspaceFile } from '@/lib/workspace/types'
import { cn } from '@/lib/utils'

/**
 * Left pane: search, a new chat, library, and matter history.
 * List chrome adapted from dcolley/tourbillon@7a8595b
 * apps/web/components/assistant/sidebar.tsx.
 * Each row is one matter, which is one chat thread.
 * Library stays in this pane: the user's files, then the open matter's files.
 * File rows use that same list chrome: a name and an action.
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
  libraryFiles,
  libraryLoaded,
  libraryError,
  addingFile,
  onAddFile,
  matterFiles,
  matterFilesLoaded,
  matterFilesError,
  movingName,
  onMoveToMatter,
  onMoveToLibrary,
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
  libraryFiles: readonly WorkspaceFile[]
  libraryLoaded: boolean
  libraryError: string | null
  addingFile: boolean
  onAddFile: (input: { name: string; text: string }) => Promise<boolean> | boolean
  matterFiles: readonly WorkspaceFile[]
  matterFilesLoaded: boolean
  matterFilesError: string | null
  movingName: string | null
  onMoveToMatter: (name: string) => void
  onMoveToLibrary: (name: string) => void
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
      <LibrarySection
        files={libraryFiles}
        loaded={libraryLoaded}
        error={libraryError}
        adding={addingFile}
        onAddFile={onAddFile}
        matterId={activeId}
        matterFiles={matterFiles}
        matterFilesLoaded={matterFilesLoaded}
        matterFilesError={matterFilesError}
        movingName={movingName}
        onMoveToMatter={onMoveToMatter}
        onMoveToLibrary={onMoveToLibrary}
      />
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

function LibrarySection({
  files,
  loaded,
  error,
  adding,
  onAddFile,
  matterId,
  matterFiles,
  matterFilesLoaded,
  matterFilesError,
  movingName,
  onMoveToMatter,
  onMoveToLibrary,
}: {
  files: readonly WorkspaceFile[]
  loaded: boolean
  error: string | null
  adding: boolean
  onAddFile: (input: { name: string; text: string }) => Promise<boolean> | boolean
  matterId: string | null
  matterFiles: readonly WorkspaceFile[]
  matterFilesLoaded: boolean
  matterFilesError: string | null
  movingName: string | null
  onMoveToMatter: (name: string) => void
  onMoveToLibrary: (name: string) => void
}) {
  const [name, setName] = useState('')
  const [text, setText] = useState('')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const added = await onAddFile({ name, text })
    if (added) {
      setName('')
      setText('')
    }
  }

  return (
    <section aria-labelledby="library-heading" className="mx-3 mb-3 max-h-80 overflow-y-auto rounded-lg border bg-card px-3 py-2">
      <div className="flex items-center gap-2">
        <Library className="size-4 text-muted-foreground" />
        <h2 id="library-heading" className="text-sm font-semibold">
          Library
        </h2>
      </div>
      <form className="mt-2 flex flex-col gap-1" onSubmit={onSubmit}>
        <Label htmlFor="library-file-name" className="text-xs font-medium text-muted-foreground">
          File name
        </Label>
        <Input id="library-file-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="letter.txt" />
        <Label htmlFor="library-file-text" className="text-xs font-medium text-muted-foreground">
          File text
        </Label>
        <Input id="library-file-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="A short note" />
        <Button type="submit" variant="secondary" size="sm" className="mt-1" disabled={adding || name.trim().length === 0}>
          Add a file
        </Button>
      </form>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-muted-foreground">
          {error}
        </p>
      ) : null}
      {!loaded ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading library…</p>
      ) : files.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No files yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1" aria-label="Library files" data-library-scope="user">
          {files.map((file) => (
            <FileRow
              key={file.name}
              file={file}
              scope="user"
              actionLabel={`Move ${file.name} to this matter`}
              actionText="Move to this matter"
              disabled={!matterId || movingName === file.name}
              onAction={() => onMoveToMatter(file.name)}
            />
          ))}
        </ul>
      )}
      <div className="mt-3" data-matter-files={matterId ?? ''}>
        <Separator className="mb-2" />
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">This matter</h3>
        {!matterId ? (
          <p className="mt-1 text-xs text-muted-foreground">Open a matter to see its files.</p>
        ) : matterFilesError ? (
          <p role="alert" className="mt-1 text-xs text-muted-foreground">
            {matterFilesError}
          </p>
        ) : !matterFilesLoaded ? (
          <p className="mt-1 text-xs text-muted-foreground">Loading files…</p>
        ) : matterFiles.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No files in this matter yet.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1" aria-label="Matter files" data-library-scope="matter">
            {matterFiles.map((file) => (
              <FileRow
                key={file.name}
                file={file}
                scope="matter"
                actionLabel={`Move ${file.name} to your library`}
                actionText="Move to library"
                disabled={movingName === file.name}
                onAction={() => onMoveToLibrary(file.name)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function FileRow({
  file,
  scope,
  actionLabel,
  actionText,
  disabled,
  onAction,
}: {
  file: WorkspaceFile
  scope: 'user' | 'matter'
  actionLabel: string
  actionText: string
  disabled: boolean
  onAction: () => void
}) {
  return (
    <li
      data-library-file={scope === 'user' ? file.name : undefined}
      data-matter-file={scope === 'matter' ? file.name : undefined}
      className="flex items-center gap-1 rounded-lg px-1 py-1 hover:bg-sidebar-accent"
    >
      <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
      <Button type="button" variant="ghost" size="xs" aria-label={actionLabel} disabled={disabled} onClick={onAction}>
        {actionText}
      </Button>
    </li>
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
          active && 'bg-sidebar-accent shadow-[inset_3px_0_0_var(--chrome)]',
        )}
      >
        <span className="block truncate font-medium">{item.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
      </button>
    </li>
  )
}
