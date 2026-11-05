'use client'

import { useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { useActiveMatterId } from '@/components/shell/active-matter'
import { FileSearch } from '@/components/shell/file-search'
import { useRightPaneActions } from '@/components/shell/right-pane-actions'
import { useLibrary } from '@/components/shell/use-library'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { WorkspaceFile } from '@/lib/workspace/types'
import {
  sanitizeUploadFileName,
  UPLOAD_HINT,
  UPLOAD_NAME_ERROR,
  uploadRejection,
} from '@/lib/workspace/upload-policy'

/**
 * Files stored with the open matter.
 * Open uses the same right-pane request as the library.
 * The list stays names and sizes. The file body opens in the viewer.
 * Upload accepts a PDF, Word document, or Markdown file, up to 10 MB.
 * A library file can be copied onto this matter. The library copy stays.
 * Move to library takes a matter file off this matter.
 */
export function MatterFiles({
  files,
  libraryFiles,
}: {
  files?: readonly WorkspaceFile[]
  /** Tests pass the library list. The page leaves this unset and loads it. */
  libraryFiles?: readonly WorkspaceFile[]
}) {
  const matterId = useActiveMatterId()
  const live = files === undefined
  const library = useLibrary(live ? matterId : null)
  const rightPane = useRightPaneActions()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const listed = files ?? library.matterFiles
  const loading = live && Boolean(matterId) && !library.matterLoaded
  const showLibrary = Boolean(matterId) && (libraryFiles !== undefined || live)
  const libraryList = libraryFiles ?? library.files
  const libraryLoading = showLibrary && libraryFiles === undefined && !library.loaded

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked || !matterId) return
    const name = sanitizeUploadFileName(picked.name)
    if (!name) {
      setUploadError(UPLOAD_NAME_ERROR)
      return
    }
    const rejection = uploadRejection(name, picked.size)
    if (rejection) {
      setUploadError(rejection)
      return
    }
    setUploadError(null)
    void library.uploadMatterFile(picked, matterId)
  }

  if (files === undefined && !matterId) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Open a chat to see files stored with it.</p>
        <FileSearch href={null} resolved />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2" data-matter-workspace>
      <h2 className="text-sm font-semibold">Files on this chat</h2>
      <FileSearch
        href={matterId ? `/api/matters/${encodeURIComponent(matterId)}/index` : null}
        resolved={!matterId}
      />
      {matterId ? (
        <div className="flex flex-col gap-1" data-matter-upload>
          <Label htmlFor="matter-file-upload">Upload a file</Label>
          <input
            id="matter-file-upload"
            name="file"
            type="file"
            accept=".pdf,.docx,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown"
            aria-describedby="matter-file-upload-hint"
            disabled={library.uploading}
            onChange={onPick}
            className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-2.5 file:py-1 file:text-sm file:font-medium file:text-secondary-foreground"
          />
          <p id="matter-file-upload-hint" className="text-xs text-muted-foreground">
            {UPLOAD_HINT}
          </p>
          {library.uploading ? <p className="text-sm text-muted-foreground">Uploading…</p> : null}
        </div>
      ) : null}
      {uploadError ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {uploadError}
        </p>
      ) : null}
      {library.matterError && live ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {library.matterError}
        </p>
      ) : null}
      {library.error && live ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {library.error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading files…</p> : null}
      {!loading && listed.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files on this chat yet.</p>
      ) : null}
      {listed.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="Chat files" data-library-scope="matter">
          {listed.map((file) => (
            <li key={file.name} className="flex items-center justify-between gap-2" data-matter-file={file.name}>
              <span className="truncate text-sm">{file.name}</span>
              <div className="flex shrink-0 items-center gap-1">
                {matterId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Move ${file.name} to library`}
                    disabled={library.movingName === file.name}
                    onClick={() => void library.moveToLibrary(file.name)}
                  >
                    {library.movingName === file.name && library.movingMode === 'move' ? 'Moving…' : 'Move to library'}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Open ${file.name}`}
                  onClick={() => rightPane?.openDocument({ name: file.name, scope: 'matter' })}
                >
                  Open
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {matterId && listed.length > 0 ? (
        <p className="text-xs text-muted-foreground">Move takes the file off this chat and puts it in your library.</p>
      ) : null}
      {showLibrary ? (
        <div className="flex flex-col gap-2 border-t pt-3" data-library-attach>
          <h2 className="text-sm font-semibold">From your library</h2>
          <p className="text-xs text-muted-foreground">Add a file you already keep. The library copy stays.</p>
          {libraryLoading ? <p className="text-sm text-muted-foreground">Loading library…</p> : null}
          {!libraryLoading && libraryList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No files in your library yet.{' '}
              <Link href="/library" className="text-link underline-offset-4 hover:underline">
                Open library
              </Link>
            </p>
          ) : null}
          {libraryList.length > 0 ? (
            <ul className="flex flex-col gap-2" aria-label="Library files to add">
              {libraryList.map((file) => (
                <li key={file.name} className="flex items-center justify-between gap-2" data-attach-file={file.name}>
                  <span className="truncate text-sm">{file.name}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label={`Add ${file.name} to this chat`}
                    disabled={library.movingName === file.name}
                    onClick={() => void library.attachToMatter(file.name)}
                  >
                    {library.movingName === file.name && library.movingMode === 'copy' ? 'Adding…' : 'Add to this chat'}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
