'use client'

import { useEffect, useRef, useState } from 'react'
import {
  isStoredMatterMessage,
  messagesAfterReload,
  messagesWithOptimistic,
  messagesWithSaved,
  presentStoredMatterMessage,
  resolveMatterMessageText,
} from '@/lib/matters/message'
import { isMatterObservations } from '@/lib/matters/present'
import type { MatterMessage, MatterObservations, MatterSummary, MatterThread, MatterThreadStatus } from '@/lib/matters/types'

type OpenMatter = {
  matter: MatterSummary
  messages: MatterMessage[]
  observations: MatterObservations | null
}

type MatterListResponse = { matters?: MatterSummary[] }
type MatterCreateResponse = { matter?: MatterSummary }

/**
 * Left-pane history and the centre thread for the signed-in user.
 * The server scopes every request to the Clerk user id. This hook only
 * keeps the open matter and its draft attachment on the client.
 * Send appends the user's words on that matter. A model reply is not requested.
 * TODO(G-01 Concierge): stream the assistant reply after the message is stored.
 */
export function useMatterSessions() {
  const [matters, setMatters] = useState<MatterSummary[]>([])
  const [loaded, setLoaded] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [thread, setThread] = useState<OpenMatter | null>(null)
  const [threadError, setThreadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const sendSeq = useRef(0)

  function choose(id: string, known?: OpenMatter | null) {
    activeIdRef.current = id
    setActiveId(id)
    setThreadError(null)
    setSendError(null)
    setThread(known && known.matter.id === id ? known : null)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch('/api/matters', { cache: 'no-store' })
        if (!response.ok) throw new Error('load')
        const body = (await response.json()) as MatterListResponse
        if (!Array.isArray(body.matters)) throw new Error('load')
        if (cancelled) return
        setMatters((current) => {
          const ids = new Set(body.matters!.map((matter) => matter.id))
          const extras = current.filter((matter) => !ids.has(matter.id))
          return [...extras, ...body.matters!]
        })
        setListError(null)
        if (!activeIdRef.current && body.matters[0]) choose(body.matters[0].id)
      } catch {
        if (!cancelled) setListError('Matters could not be loaded.')
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
    if (!activeId) return
    const matterId = activeId
    const seqAtStart = sendSeq.current
    let cancelled = false
    async function loadThread() {
      try {
        const response = await fetch(`/api/matters/${encodeURIComponent(matterId)}`, { cache: 'no-store' })
        if (response.status === 404) throw new Error('missing')
        if (!response.ok) throw new Error('load')
        const body = (await response.json()) as MatterThread
        if (cancelled || activeIdRef.current !== matterId) return
        if (!body.matter || body.matter.id !== matterId || !Array.isArray(body.messages)) throw new Error('load')
        if (!body.messages.every((message) => isStoredMatterMessage(message))) throw new Error('load')
        if (!isMatterObservations(body.observations)) throw new Error('load')
        const loaded = body.messages.map(presentStoredMatterMessage)
        setThread((current) => ({
          matter: body.matter,
          messages: messagesAfterReload(
            current?.matter.id === matterId ? current.messages : null,
            loaded,
            sendSeq.current !== seqAtStart,
          ),
          observations: body.observations,
        }))
        setThreadError(null)
      } catch {
        if (!cancelled && activeIdRef.current === matterId) {
          setThread(null)
          setThreadError('This matter could not be opened.')
        }
      }
    }
    void loadThread()
    return () => {
      cancelled = true
    }
  }, [activeId])

  async function sendMessage(text: string): Promise<boolean> {
    const matterId = activeIdRef.current
    if (!matterId) return false
    let parsed: string
    try {
      parsed = resolveMatterMessageText(text)
    } catch {
      setSendError('Write a message before sending.')
      return false
    }
    const optimistic: MatterMessage = {
      id: `local:${crypto.randomUUID()}`,
      role: 'user',
      text: parsed,
      createdAt: new Date().toISOString(),
      pending: true,
    }
    sendSeq.current += 1
    setSendError(null)
    setSendingId(matterId)
    setThread((current) => {
      if (!current || current.matter.id !== matterId) return current
      return { ...current, messages: messagesWithOptimistic(current.messages, optimistic) }
    })
    try {
      const response = await fetch(`/api/matters/${encodeURIComponent(matterId)}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: parsed }),
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('send')
      const body = (await response.json()) as { message?: unknown }
      if (!isStoredMatterMessage(body.message) || body.message.role !== 'user') throw new Error('send')
      const saved = presentStoredMatterMessage(body.message)
      setMatters((current) =>
        current
          .map((matter) => (matter.id === matterId ? { ...matter, updatedAt: saved.createdAt } : matter))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)),
      )
      if (activeIdRef.current === matterId) {
        setThread((current) => {
          if (!current || current.matter.id !== matterId) return current
          return {
            ...current,
            matter: { ...current.matter, updatedAt: saved.createdAt },
            messages: messagesWithSaved(current.messages, optimistic.id, saved),
          }
        })
      }
      return true
    } catch {
      if (activeIdRef.current === matterId) {
        setThread((current) => {
          if (!current || current.matter.id !== matterId) return current
          return { ...current, messages: current.messages.filter((message) => message.id !== optimistic.id) }
        })
        setSendError('That message was not saved. Try again.')
      }
      return false
    } finally {
      setSendingId((current) => (current === matterId ? null : current))
    }
  }

  async function createMatterSession() {
    setCreating(true)
    setListError(null)
    try {
      const response = await fetch('/api/matters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('create')
      const body = (await response.json()) as MatterCreateResponse
      if (!body.matter?.id) throw new Error('create')
      const matter = body.matter
      setMatters((current) => [matter, ...current.filter((item) => item.id !== matter.id)])
      choose(matter.id, { matter, messages: [], observations: null })
    } catch {
      setListError('A new matter could not be opened.')
    } finally {
      setCreating(false)
    }
  }

  const active = matters.find((matter) => matter.id === activeId) ?? (thread?.matter.id === activeId ? thread.matter : null)
  const threadStatus: MatterThreadStatus = !activeId
    ? 'idle'
    : threadError
      ? 'error'
      : thread?.matter.id === activeId
        ? 'ready'
        : 'loading'
  const messages = thread?.matter.id === activeId ? thread.messages : []
  const observations = thread?.matter.id === activeId ? thread.observations : null

  return {
    matters,
    loaded,
    listError,
    activeId,
    active,
    messages,
    observations,
    threadStatus,
    creating,
    sending: sendingId !== null && sendingId === activeId,
    sendError,
    choose,
    createMatterSession,
    sendMessage,
  }
}
