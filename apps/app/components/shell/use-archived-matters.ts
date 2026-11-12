'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyUnarchiveToArchivedList,
  parseArchivedMattersResponse,
} from '@/lib/matters/archived'
import type { MatterSummary } from '@/lib/matters/types'

/**
 * The archived set behind the C-12 archive flag, for the C-18 modal.
 * Reads GET /api/matters?archived=true on demand (every time the modal
 * opens) and unarchives with PATCH { archived: false } — the same store
 * flag the C-12 archive sets. Opening a chat to read it never comes through
 * here; only Unarchive does, and it hands the restored chat to onRestored
 * so the history list can show it again. Nothing here deletes or purges.
 */
export function useArchivedMatters(options: {
  onRestored: (matter: MatterSummary) => void
}) {
  const [archived, setArchived] = useState<MatterSummary[]>([])
  const [loaded, setLoaded] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null)
  const [requestToken, setRequestToken] = useState(0)
  const onRestoredRef = useRef(options.onRestored)
  onRestoredRef.current = options.onRestored

  /** Called when the modal opens: fetch the archived set fresh. */
  const reload = useCallback(() => {
    setLoaded(false)
    setRequestToken((token) => token + 1)
  }, [])

  useEffect(() => {
    if (requestToken === 0) return
    let cancelled = false
    async function load() {
      try {
        const response = await fetch('/api/matters?archived=true', { cache: 'no-store' })
        if (!response.ok) throw new Error('load')
        const matters = parseArchivedMattersResponse(await response.json())
        if (!matters) throw new Error('load')
        if (cancelled) return
        setArchived(matters)
        setListError(null)
      } catch {
        if (!cancelled) setListError('Archived chats could not be loaded.')
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [requestToken])

  async function unarchiveMatter(matterId: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const failed = { ok: false as const, message: 'This chat could not be restored.' }
    setUnarchivingId(matterId)
    try {
      const response = await fetch(`/api/matters/${encodeURIComponent(matterId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ archived: false }),
        cache: 'no-store',
      })
      const body = (await response.json().catch(() => null)) as { matter?: unknown; error?: unknown } | null
      if (!response.ok || !body?.matter) {
        const message =
          body && typeof body.error === 'string' && body.error.trim() ? body.error : failed.message
        setListError(message)
        return { ok: false, message }
      }
      const restored = parseArchivedMattersResponse({ matters: [body.matter] })?.[0]
      if (!restored) {
        setListError(failed.message)
        return failed
      }
      setArchived((current) => applyUnarchiveToArchivedList(current, matterId))
      setListError(null)
      onRestoredRef.current(restored)
      return { ok: true }
    } catch {
      setListError(failed.message)
      return failed
    } finally {
      setUnarchivingId((current) => (current === matterId ? null : current))
    }
  }

  return { archived, loaded, listError, unarchivingId, reload, unarchiveMatter }
}
