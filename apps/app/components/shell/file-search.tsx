'use client'

import { useEffect, useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FILE_SEARCH_FAILED, FILE_SEARCH_OFF } from '@/lib/embeddings/messages'

/**
 * Quiet file search for the library or one matter.
 * When search is off, this is one sentence. Preparing and searching call
 * the index route only after the settings are on. Chat does not use this.
 * TODO(D-04): do not send these hits into the transcript.
 */

type Hit = { name: string; excerpt: string }

export function FileSearch({
  href,
  resolved = false,
  initialEnabled = false,
  initialNote = FILE_SEARCH_OFF,
}: {
  /** Null keeps the note and does not call the index. */
  href: string | null
  /** The server already read the index status. */
  resolved?: boolean
  initialEnabled?: boolean
  initialNote?: string
}) {
  const inputId = useId()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [note, setNote] = useState(initialNote)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [busy, setBusy] = useState<'read' | 'search' | null>(null)

  useEffect(() => {
    if (!href || resolved) return
    let cancelled = false
    void fetch(href)
      .then(async (response) => {
        if (!response.ok || cancelled) return
        const body = (await response.json()) as { enabled?: unknown; message?: unknown }
        if (cancelled) return
        setEnabled(body.enabled === true)
        if (typeof body.message === 'string' && body.message.trim()) setNote(body.message)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [href, resolved])

  async function readBody(response: Response): Promise<void> {
    let body: { enabled?: unknown; message?: unknown; error?: unknown; hits?: unknown } | null = null
    try {
      body = (await response.json()) as { enabled?: unknown; message?: unknown; error?: unknown; hits?: unknown }
    } catch {
      body = null
    }
    if (!response.ok) {
      setNote(typeof body?.error === 'string' && body.error.trim() ? body.error : FILE_SEARCH_FAILED)
      return
    }
    setEnabled(body?.enabled === true)
    if (typeof body?.message === 'string' && body.message.trim()) setNote(body.message)
    setHits(readHits(body?.hits))
  }

  async function onPrepare() {
    if (!href || busy) return
    setBusy('read')
    try {
      const response = await fetch(href, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      await readBody(response)
    } catch {
      setNote(FILE_SEARCH_FAILED)
    } finally {
      setBusy(null)
    }
  }

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!href || busy || query.trim().length === 0) return
    setBusy('search')
    try {
      const response = await fetch(`${href}?q=${encodeURIComponent(query.trim())}`)
      await readBody(response)
    } catch {
      setNote(FILE_SEARCH_FAILED)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div data-file-search={enabled ? 'on' : 'off'} className="flex max-w-prose flex-col gap-2">
      <p className="text-sm text-muted-foreground">{note}</p>
      {enabled && href ? (
        <>
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={() => void onPrepare()} disabled={busy !== null}>
              {busy === 'read' ? 'Reading…' : 'Read these files for search'}
            </Button>
          </div>
          <form onSubmit={(event) => void onSearch(event)} className="flex flex-col gap-1">
            <Label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
              Search the words
            </Label>
            <Input
              id={inputId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="A word from your file"
            />
            <div>
              <Button type="submit" variant="outline" size="sm" disabled={busy !== null || query.trim().length === 0}>
                Search
              </Button>
            </div>
          </form>
          {hits.length > 0 ? (
            <ul aria-label="Matching files" data-file-search-results className="flex flex-col gap-2">
              {hits.map((hit) => (
                <li key={hit.name} data-file-search-hit={hit.name}>
                  <p className="text-sm">{hit.name}</p>
                  <p className="text-sm text-muted-foreground">{hit.excerpt}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function readHits(value: unknown): Hit[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((hit) => {
    if (!hit || typeof hit !== 'object') return []
    const name = (hit as { name?: unknown }).name
    const excerpt = (hit as { excerpt?: unknown }).excerpt
    if (typeof name !== 'string' || typeof excerpt !== 'string') return []
    return [{ name, excerpt }]
  })
}
