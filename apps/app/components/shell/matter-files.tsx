'use client'

import { useActiveMatterId } from '@/components/shell/active-matter'
import { useRightPaneActions } from '@/components/shell/right-pane-actions'
import { useLibrary } from '@/components/shell/use-library'
import { Button } from '@/components/ui/button'
import type { WorkspaceFile } from '@/lib/workspace/types'

/**
 * Files stored with the open matter.
 * Open uses the same right-pane request as the library.
 * The list stays names and sizes. The file body opens in the viewer.
 */
export function MatterFiles({ files }: { files?: readonly WorkspaceFile[] }) {
  const matterId = useActiveMatterId()
  const library = useLibrary(files ? null : matterId)
  const rightPane = useRightPaneActions()
  const listed = files ?? library.matterFiles
  const loading = files === undefined && Boolean(matterId) && !library.matterLoaded

  if (files === undefined && !matterId) {
    return <p className="text-sm text-muted-foreground">Open a chat to see files stored with it.</p>
  }

  return (
    <div className="flex flex-col gap-2" data-matter-workspace>
      <h2 className="text-sm font-semibold">Files on this matter</h2>
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
