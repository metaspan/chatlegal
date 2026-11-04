'use client'

import { useEffect, useState } from 'react'
import { SafeMarkdown } from '@/components/shell/safe-markdown'
import { isMarkdownFileName, workspaceContentPath, type OpenedDocument } from '@/lib/right-pane'

/**
 * File body after Open.
 * Load-on-open follows dcolley/tourbillon@7a8595b
 * apps/web/components/workspace/workspace-file-pane.tsx: nothing is fetched
 * until a file is selected, and preview is the resting mode. Editing stays out.
 * PDF uses the browser viewer. A picture uses an img. Markdown is text only.
 */

export type OpenedFileBody = {
  status: 'ready' | 'missing' | 'error'
  text: string
}

export function useOpenedFileText(
  document: OpenedDocument | null,
  preset: OpenedFileBody | undefined,
): { loading: boolean; body: OpenedFileBody | null } {
  const presetStatus = preset?.status
  const presetText = preset?.text
  const wantsText = document?.kind === 'markdown'
  const [loading, setLoading] = useState(() => preset === undefined && wantsText)
  const [body, setBody] = useState<OpenedFileBody | null>(() => preset ?? null)

  useEffect(() => {
    if (!document || document.kind !== 'markdown') {
      setLoading(false)
      setBody(null)
      return
    }
    if (presetStatus) {
      setBody({ status: presetStatus, text: presetText ?? '' })
      setLoading(false)
      return
    }
    const target = document
    let cancelled = false
    setLoading(true)
    setBody(null)
    async function load() {
      try {
        const response = await fetch(workspaceContentPath(target), { cache: 'no-store' })
        if (cancelled) return
        if (response.status === 404) {
          setBody({ status: 'missing', text: '' })
          return
        }
        if (!response.ok) {
          setBody({ status: 'error', text: '' })
          return
        }
        setBody({ status: 'ready', text: await response.text() })
      } catch {
        if (!cancelled) setBody({ status: 'error', text: '' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [document, presetStatus, presetText])

  return { loading: wantsText && loading, body: wantsText ? body : null }
}

export function FilePreview({
  document,
  loading,
  body,
}: {
  document: OpenedDocument
  loading: boolean
  body: OpenedFileBody | null
}) {
  if (document.kind === 'image') {
    return (
      <img
        alt={document.name}
        src={workspaceContentPath(document)}
        data-viewer-image={document.name}
        className="max-h-[70vh] w-full rounded-md bg-card object-contain"
      />
    )
  }
  if (document.kind === 'pdf') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <iframe
          title={document.name}
          src={workspaceContentPath(document)}
          data-viewer-pdf={document.name}
          className="min-h-96 w-full flex-1 rounded-md border bg-card"
        />
        <p className="text-xs text-muted-foreground">Shown in the browser. Marks on the page are not available yet.</p>
      </div>
    )
  }
  if (loading || !body) {
    return <p className="text-sm text-muted-foreground">Loading this file…</p>
  }
  if (body.status !== 'ready') {
    return <p className="text-sm text-muted-foreground">This file could not be opened.</p>
  }
  if (body.text.trim().length === 0) {
    return <p className="text-sm text-muted-foreground">This file is empty.</p>
  }
  if (isMarkdownFileName(document.name)) {
    return <SafeMarkdown text={body.text} />
  }
  return (
    <pre data-viewer-text className="overflow-x-auto rounded-md border bg-card p-3 text-sm whitespace-pre-wrap">
      {body.text}
    </pre>
  )
}
