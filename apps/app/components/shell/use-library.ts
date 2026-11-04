'use client'

import { useEffect, useState } from 'react'
import { workspaceFilesFromJson, type WorkspaceFile, type WorkspaceScope } from '@/lib/workspace/types'

/**
 * The signed-in user's library, and the open matter's files when a matter is open.
 * The library page and the Work list call this. The left pane does not.
 * The server scopes every request to the Clerk user.
 * Add copies through POST /api/workspace/move with mode copy.
 * Move uses the same route and takes the file off the place it left.
 */

export type LibrarySeed = {
  files?: readonly WorkspaceFile[]
  error?: string | null
}

async function errorText(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === 'string' && body.error.trim()) return body.error
  } catch {
    // The status is enough when the body is not JSON.
  }
  return fallback
}

export function useLibrary(matterId: string | null, seed?: LibrarySeed) {
  const seeded = seed?.files !== undefined || Boolean(seed?.error)
  const [files, setFiles] = useState<WorkspaceFile[]>(() => (seed?.files ? [...seed.files] : []))
  const [loaded, setLoaded] = useState(seeded && !seed?.error)
  const [error, setError] = useState<string | null>(seed?.error ?? null)
  const [matterFiles, setMatterFiles] = useState<WorkspaceFile[]>([])
  const [matterLoaded, setMatterLoaded] = useState(false)
  const [matterError, setMatterError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [movingName, setMovingName] = useState<string | null>(null)
  const [movingMode, setMovingMode] = useState<'move' | 'copy' | null>(null)

  async function reloadLibrary(): Promise<boolean> {
    const response = await fetch('/api/library', { cache: 'no-store' })
    if (!response.ok) {
      setError(await errorText(response, 'Library files could not be loaded.'))
      return false
    }
    const parsed = workspaceFilesFromJson(await response.json())
    if (!parsed) {
      setError('Library files could not be loaded.')
      return false
    }
    setFiles(parsed)
    setError(null)
    return true
  }

  async function reloadMatter(id: string): Promise<boolean> {
    const response = await fetch(`/api/matters/${encodeURIComponent(id)}/files`, { cache: 'no-store' })
    if (response.status === 404) {
      setMatterFiles([])
      setMatterError('This matter could not be opened.')
      return false
    }
    if (!response.ok) {
      setMatterError(await errorText(response, 'Files for this matter could not be loaded.'))
      return false
    }
    const parsed = workspaceFilesFromJson(await response.json())
    if (!parsed) {
      setMatterError('Files for this matter could not be loaded.')
      return false
    }
    setMatterFiles(parsed)
    setMatterError(null)
    return true
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch('/api/library', { cache: 'no-store' })
        if (!response.ok) throw new Error('load')
        const parsed = workspaceFilesFromJson(await response.json())
        if (!parsed) throw new Error('load')
        if (cancelled) return
        setFiles(parsed)
        setError(null)
      } catch {
        if (!cancelled) setError('Library files could not be loaded.')
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!matterId) {
      setMatterFiles([])
      setMatterLoaded(true)
      setMatterError(null)
      return
    }
    const id = matterId
    let cancelled = false
    async function load() {
      try {
        const response = await fetch(`/api/matters/${encodeURIComponent(id)}/files`, { cache: 'no-store' })
        if (response.status === 404) throw new Error('missing')
        if (!response.ok) throw new Error('load')
        const parsed = workspaceFilesFromJson(await response.json())
        if (!parsed) throw new Error('load')
        if (cancelled) return
        setMatterFiles(parsed)
        setMatterError(null)
      } catch {
        if (!cancelled) {
          setMatterFiles([])
          setMatterError('Files for this matter could not be loaded.')
        }
      } finally {
        if (!cancelled) setMatterLoaded(true)
      }
    }
    setMatterLoaded(false)
    void load()
    return () => {
      cancelled = true
    }
  }, [matterId])

  async function uploadMatterFile(file: File, id: string): Promise<boolean> {
    setUploading(true)
    setMatterError(null)
    try {
      const body = new FormData()
      body.append('file', file, file.name)
      const response = await fetch(`/api/matters/${encodeURIComponent(id)}/files`, {
        method: 'POST',
        body,
        cache: 'no-store',
      })
      if (!response.ok) {
        setMatterError(await errorText(response, 'The file could not be added to this matter.'))
        return false
      }
      if (matterId) return await reloadMatter(matterId)
      return true
    } catch {
      setMatterError('The file could not be added to this matter.')
      return false
    } finally {
      setUploading(false)
    }
  }

  async function addFile(input: { name: string; text: string }): Promise<boolean> {
    setAdding(true)
    setError(null)
    try {
      const response = await fetch('/api/library', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        cache: 'no-store',
      })
      if (!response.ok) {
        setError(await errorText(response, 'The file could not be added.'))
        return false
      }
      return await reloadLibrary()
    } catch {
      setError('The file could not be added.')
      return false
    } finally {
      setAdding(false)
    }
  }

  async function transferFile(
    name: string,
    from: WorkspaceScope,
    to: WorkspaceScope,
    mode: 'move' | 'copy',
  ): Promise<boolean> {
    setMovingName(name)
    setMovingMode(mode)
    setError(null)
    setMatterError(null)
    const toMatter = to.kind === 'matter'
    const fallback = mode === 'copy' ? 'The file could not be added to this matter.' : 'The file could not be moved.'
    try {
      const response = await fetch('/api/workspace/move', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, from, to, mode }),
        cache: 'no-store',
      })
      if (!response.ok) {
        const message = await errorText(response, fallback)
        if (toMatter) setMatterError(message)
        else setError(message)
        return false
      }
      const libraryOk = await reloadLibrary()
      const matterOk = matterId ? await reloadMatter(matterId) : true
      return libraryOk && matterOk
    } catch {
      if (toMatter) setMatterError(fallback)
      else setError(fallback)
      return false
    } finally {
      setMovingName(null)
      setMovingMode(null)
    }
  }

  function attachToMatter(name: string): Promise<boolean> {
    if (!matterId) return Promise.resolve(false)
    return transferFile(name, { kind: 'user' }, { kind: 'matter', matterId }, 'copy')
  }

  function moveToMatter(name: string): Promise<boolean> {
    if (!matterId) return Promise.resolve(false)
    return transferFile(name, { kind: 'user' }, { kind: 'matter', matterId }, 'move')
  }

  function moveToLibrary(name: string): Promise<boolean> {
    if (!matterId) return Promise.resolve(false)
    return transferFile(name, { kind: 'matter', matterId }, { kind: 'user' }, 'move')
  }

  return {
    files,
    loaded,
    error,
    adding,
    uploading,
    matterFiles,
    matterLoaded,
    matterError,
    movingName,
    movingMode,
    addFile,
    uploadMatterFile,
    attachToMatter,
    moveToMatter,
    moveToLibrary,
  }
}
