'use client'

import { useState, type ChangeEvent } from 'react'
import { useActiveMatterId } from '@/components/shell/active-matter'
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
 */
export function MatterFiles({ files }: { files?: readonly WorkspaceFile[] }) {
  const matterId = useActiveMatterId()
  const library = useLibrary(files ? null : matterId)
  const rightPane = useRightPaneActions()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const listed = files ?? library.matterFiles
  const loading = files === undefined && Boolean(matterId) && !library.matterLoaded

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
    return <p className="text-sm text-muted-foreground">Open a chat to see files stored with it.</p>
  }

  return (
    <div className="flex flex-col gap-2" data-matter-workspace>
      <h2 className="text-sm font-semibold">Files on this matter</h2>
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
      {library.matterError && files === undefined ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {library.matterError}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading files…</p> : null}
      {!loading && listed.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files on this matter yet.</p>
      ) : null}
      {listed.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="Matter files" data-library-scope="matter">
          {listed.map((file) => (
            <li key={file.name} className="flex items-center justify-between gap-2" data-matter-file={file.name}>
              <span className="truncate text-sm">{file.name}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Open ${file.name}`}
                onClick={() => rightPane?.openDocument({ name: file.name, scope: 'matter' })}
              >
                Open
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
