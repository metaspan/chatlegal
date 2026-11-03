'use client'

import { useState, type FormEvent } from 'react'
import { File, FileCode, FileJson, FileText, Search } from 'lucide-react'
import { useRightPaneActions } from '@/components/shell/right-pane-actions'
import { useLibrary } from '@/components/shell/use-library'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { WorkspaceFile } from '@/lib/workspace/types'
import { cn } from '@/lib/utils'

/**
 * The signed-in user's library.
 * List chrome adapted from dcolley/tourbillon@7a8595b
 * apps/web/components/workspace/workspace-tree.tsx (search field, file icon, row).
 * The detail column adapts the empty state and filename line from
 * apps/web/components/workspace/workspace-file-pane.tsx.
 * Files stay flat: ChatLegal library names are one segment, via /api/library.
 * Moving a file into a matter stays on /api/workspace/move for a later pass.
 * Open sends the selected file to the right pane. This column keeps the name
 * and size only. The file text stays out of both places.
 */

function FileTypeIcon({ name }: { name: string }) {
  const className = 'size-4 shrink-0 text-muted-foreground'
  const lower = name.toLowerCase()
  if (lower.endsWith('.md') || lower.endsWith('.txt')) return <FileText className={className} />
  if (lower.endsWith('.json') || lower.endsWith('.jsonl')) return <FileJson className={className} />
  if (
    lower.endsWith('.js') ||
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.yml') ||
    lower.endsWith('.css') ||
    lower.endsWith('.html')
  ) {
    return <FileCode className={className} />
  }
  return <File className={className} />
}

function updatedLabel(updatedAt: string): string {
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return updatedAt
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

export function UserWorkspace({
  initialFiles,
  initialError = null,
  initialSelectedName = null,
  onOpenFile,
}: {
  initialFiles: readonly WorkspaceFile[]
  initialError?: string | null
  /** Tests select a row without a click. The page leaves this unset. */
  initialSelectedName?: string | null
  onOpenFile?: (file: { name: string; scope: 'user' }) => void
}) {
  const library = useLibrary(null, { files: initialFiles, error: initialError })
  const rightPane = useRightPaneActions()
  const [query, setQuery] = useState('')
  const [selectedName, setSelectedName] = useState<string | null>(initialSelectedName)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const needle = query.trim().toLowerCase()
  const visible = needle ? library.files.filter((file) => file.name.toLowerCase().includes(needle)) : library.files
  const selected = library.files.find((file) => file.name === selectedName) ?? null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const added = await library.addFile({ name, text })
    if (added) {
      setName('')
      setText('')
      setSelectedName(name.trim())
    }
  }

  return (
    <section aria-label="Library" data-user-workspace className="flex flex-col gap-4">
      <div className="flex max-w-prose flex-col gap-1">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Library</h1>
        <p className="text-sm text-muted-foreground">Files stored for your account.</p>
      </div>
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files"
              aria-label="Search files"
              className="h-8 pl-8 text-sm"
            />
          </div>
          {library.error ? (
            <p role="alert" className="text-sm text-muted-foreground">
              {library.error}
            </p>
          ) : null}
          {!library.loaded && !library.error ? (
            <p className="text-sm text-muted-foreground">Loading library…</p>
          ) : null}
          {library.loaded && visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {needle ? 'No files match that search.' : 'No files yet.'}
            </p>
          ) : null}
          {visible.length > 0 ? (
            <ul className="flex flex-col" aria-label="Library files" data-library-scope="user">
              {visible.map((file) => {
                const active = file.name === selected?.name
                return (
                  <li key={file.name}>
                    <button
                      type="button"
                      data-library-file={file.name}
                      aria-current={active ? 'true' : undefined}
                      onClick={() => setSelectedName(file.name)}
                      className={cn(
                        'flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-sm hover:bg-muted',
                        active && 'bg-muted font-medium',
                      )}
                    >
                      <FileTypeIcon name={file.name} />
                      <span className="truncate">{file.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
        <div className="min-w-0 rounded-lg border bg-card p-3">
          {selected ? (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-sm" data-library-open={selected.name}>
                {selected.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {selected.size} bytes · {updatedLabel(selected.updatedAt)}
              </p>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Open ${selected.name}`}
                  onClick={() => {
                    const request = { name: selected.name, scope: 'user' as const }
                    onOpenFile?.(request)
                    rightPane?.openDocument(request)
                  }}
                >
                  Open
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a file from the list to see it.</p>
          )}
        </div>
      </div>
      <form className="flex max-w-prose flex-col gap-1" onSubmit={onSubmit}>
        <h2 className="text-sm font-semibold">Add a file</h2>
        <Label htmlFor="library-file-name" className="text-xs font-medium text-muted-foreground">
          File name
        </Label>
        <Input id="library-file-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="letter.txt" />
        <Label htmlFor="library-file-text" className="text-xs font-medium text-muted-foreground">
          File text
        </Label>
        <Input id="library-file-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="A short note" />
        <div>
          <Button type="submit" variant="secondary" size="sm" className="mt-1" disabled={library.adding || name.trim().length === 0}>
            Add a file
          </Button>
        </div>
      </form>
    </section>
  )
}
