'use client'

import { useEffect, useRef, useState } from 'react'
import { isSendTimeout, sendAbortSignal } from '@/lib/chat/send-timeout'
import {
  isMatterStreamResponse,
  iterateMatterStreamEvents,
  messagesWithStreamingAssistant,
  messagesWithoutMessage,
} from '@/lib/matters/chat-stream'
import {
  isStoredMatterMessage,
  messagesAfterReload,
  messagesReplacing,
  messagesWithChoiceAnswer,
  messagesWithOptimistic,
  messagesWithSaved,
  presentStoredMatterMessage,
  resolveMatterMessageText,
} from '@/lib/matters/message'
import { matterOpenedFromCreate } from '@/lib/matters/first-turn'
import { isMatterObservations } from '@/lib/matters/present'
import type { AskChoiceAnswer, MatterMessage, MatterObservations, MatterSummary, MatterThread, MatterThreadStatus } from '@/lib/matters/types'

type OpenMatter = {
  matter: MatterSummary
  messages: MatterMessage[]
  observations: MatterObservations | null
}

type MatterListResponse = { matters?: MatterSummary[] }

/**
 * Left-pane history and the centre thread for the signed-in user.
 * The server scopes every request to the Clerk user id. This hook only
 * keeps the open matter and its draft attachment on the client.
 * Send appends the user's words on that matter. A failed or timed-out send
 * returns without dropping the caller's copy; the composer queue keeps it.
 * When LiteLLM is configured the Concierge reply streams back after the
 * append (G-00, lib/matters/chat-stream.ts). When it is off no model is
 * called and the send is only the append.
 * New chat opens the matter on its scripted first turn.
 * Rename stores the title on that thread. Archive hides it from this list
 * and leaves the thread stored. Show archived is a later slice.
 * An askChoice card already on the matter can be answered here. The pick is
 * stored on that same thread. A first-turn card may add a templated note.
 * TODO(G-01 Concierge): emit askChoice from the model, and add its tools and
 * protocol packs. The streamed text reply landed with G-00.
 */
export function useMatterSessions() {
  const [matters, setMatters] = useState<MatterSummary[]>([])
  const [loaded, setLoaded] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [thread, setThread] = useState<OpenMatter | null>(null)
  const [threadError, setThreadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [answeringWidgetId, setAnsweringWidgetId] = useState<string | null>(null)
  const [widgetError, setWidgetError] = useState<{ toolCallId: string; message: string } | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const threadRef = useRef<OpenMatter | null>(null)
  const mattersRef = useRef<MatterSummary[]>([])
  const hiddenIds = useRef(new Set<string>())
  const sendSeq = useRef(0)
  mattersRef.current = matters

  function choose(id: string, known?: OpenMatter | null) {
    activeIdRef.current = id
    setActiveId(id)
    setThreadError(null)
    setSendError(null)
    setWidgetError(null)
    setThread(known && known.matter.id === id ? known : null)
  }

  threadRef.current = thread

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
          const incoming = body.matters!.filter((matter) => !hiddenIds.current.has(matter.id))
          const ids = new Set(incoming.map((matter) => matter.id))
          const extras = current.filter((matter) => !ids.has(matter.id) && !hiddenIds.current.has(matter.id))
          return [...extras, ...incoming]
        })
        setListError(null)
        if (!activeIdRef.current && body.matters[0]) choose(body.matters[0].id)
      } catch {
        if (!cancelled) setListError('Chats could not be loaded.')
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
          setThreadError('This chat could not be opened.')
        }
      }
    }
    void loadThread()
    return () => {
      cancelled = true
    }
  }, [activeId])

  async function sendMessage(
    text: string,
    forMatterId?: string | null,
    options?: { optimistic?: boolean },
  ): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'timeout' | 'failed' }> {
    const matterId = forMatterId || activeIdRef.current
    if (!matterId) return { ok: false, reason: 'failed' }
    const optimisticOn = options?.optimistic !== false
    let parsed: string
    try {
      parsed = resolveMatterMessageText(text)
    } catch {
      if (activeIdRef.current === matterId) setSendError('Write a message before sending.')
      return { ok: false, reason: 'invalid' }
    }
    const optimistic: MatterMessage = {
      id: `local:${crypto.randomUUID()}`,
      role: 'user',
      text: parsed,
      createdAt: new Date().toISOString(),
      pending: true,
    }
    const viewing = () => activeIdRef.current === matterId
    sendSeq.current += 1
    setSendError(null)
    setSendingId(matterId)
    if (optimisticOn) {
      setThread((current) => {
        if (!current || current.matter.id !== matterId) return current
        return { ...current, messages: messagesWithOptimistic(current.messages, optimistic) }
      })
    }
    const applySavedUser = (saved: MatterMessage) => {
      setMatters((current) =>
        current
          .map((matter) => (matter.id === matterId ? { ...matter, updatedAt: saved.createdAt } : matter))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)),
      )
      if (viewing()) {
        setThread((current) => {
          if (!current || current.matter.id !== matterId) return current
          return {
            ...current,
            matter: { ...current.matter, updatedAt: saved.createdAt },
            messages: messagesWithSaved(current.messages, optimisticOn ? optimistic.id : saved.id, saved),
          }
        })
      }
    }
    try {
      const response = await fetch(`/api/matters/${encodeURIComponent(matterId)}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: parsed }),
        cache: 'no-store',
        signal: sendAbortSignal(),
      })
      if (response.status === 408 || response.status === 504) {
        throw Object.assign(new Error('timed out'), { name: 'TimeoutError' })
      }
      if (!response.ok) throw new Error('send')
      if (isMatterStreamResponse(response)) {
        // LiteLLM is on: the reply for this send streams as one JSON event
        // per line. The send counts once the stored user message event
        // arrives; the assistant reply then fills the pane in the background.
        const replyId = `local:assistant:${matterId}:${sendSeq.current}`
        let streamedText = ''
        let resolveSaved: (saved: boolean) => void = () => {}
        const savedArrived = new Promise<boolean>((resolve) => {
          resolveSaved = resolve
        })
        const consumeStream = async () => {
          try {
            for await (const event of iterateMatterStreamEvents(response)) {
              if (event.type === 'user') {
                applySavedUser(presentStoredMatterMessage(event.message))
                resolveSaved(true)
                continue
              }
              if (activeIdRef.current !== matterId) continue
              if (event.type === 'delta') {
                streamedText += event.text
                const shown = streamedText
                setThread((current) =>
                  current && current.matter.id === matterId
                    ? { ...current, messages: messagesWithStreamingAssistant(current.messages, replyId, shown) }
                    : current,
                )
                continue
              }
              if (event.type === 'assistant') {
                const saved = presentStoredMatterMessage(event.message)
                setThread((current) =>
                  current && current.matter.id === matterId
                    ? {
                        ...current,
                        matter: { ...current.matter, updatedAt: saved.createdAt },
                        messages: messagesWithSaved(current.messages, replyId, saved),
                      }
                    : current,
                )
                setMatters((current) =>
                  current
                    .map((matter) => (matter.id === matterId ? { ...matter, updatedAt: saved.createdAt } : matter))
                    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)),
                )
                continue
              }
              if (event.type === 'error') {
                setThread((current) =>
                  current && current.matter.id === matterId
                    ? { ...current, messages: messagesWithoutMessage(current.messages, replyId) }
                    : current,
                )
                setSendError(event.message)
              }
            }
          } catch {
            // The stream dropped. The person's own message is already stored
            // when the user event arrived, so this only clears the partial.
          }
          if (activeIdRef.current === matterId) {
            setThread((current) =>
              current && current.matter.id === matterId
                ? { ...current, messages: messagesWithoutMessage(current.messages, replyId) }
                : current,
            )
          }
          resolveSaved(false)
        }
        void consumeStream()
        const saved = await savedArrived
        if (!saved) {
          void response.body?.cancel().catch(() => {})
          throw new Error('send')
        }
        return { ok: true }
      }
      const body = (await response.json()) as { message?: unknown }
      if (!isStoredMatterMessage(body.message) || body.message.role !== 'user') throw new Error('send')
      applySavedUser(presentStoredMatterMessage(body.message))
      return { ok: true }
    } catch (error) {
      if (optimisticOn && viewing()) {
        setThread((current) => {
          if (!current || current.matter.id !== matterId) return current
          return { ...current, messages: current.messages.filter((message) => message.id !== optimistic.id) }
        })
      }
      return { ok: false, reason: isSendTimeout(error) ? 'timeout' : 'failed' }
    } finally {
      setSendingId((current) => (current === matterId ? null : current))
    }
  }

  async function answerWidget(toolCallId: string, answer: AskChoiceAnswer): Promise<boolean> {
    const matterId = activeIdRef.current
    if (!matterId) return false
    const current = threadRef.current
    const widget = current?.matter.id === matterId
      ? current.messages.find((message) => message.widget?.toolCallId === toolCallId)?.widget
      : undefined
    if (!widget || widget.status === 'answered') return false
    const snapshot = current?.messages ?? []
    const answeredAt = new Date().toISOString()
    sendSeq.current += 1
    setWidgetError(null)
    setAnsweringWidgetId(toolCallId)
    setThread((open) => {
      if (!open || open.matter.id !== matterId) return open
      return { ...open, messages: messagesWithChoiceAnswer(open.messages, toolCallId, answer, answeredAt) }
    })
    try {
      const response = await fetch(
        `/api/matters/${encodeURIComponent(matterId)}/widgets/${encodeURIComponent(toolCallId)}/answer`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(answer),
          cache: 'no-store',
        },
      )
      const body = (await response.json().catch(() => null)) as { message?: unknown; followUp?: unknown } | null
      const saved = body && isStoredMatterMessage(body.message) ? presentStoredMatterMessage(body.message) : null
      const followUp = body && isStoredMatterMessage(body.followUp) ? presentStoredMatterMessage(body.followUp) : null
      if (response.status === 409 && saved && activeIdRef.current === matterId) {
        setThread((open) => {
          if (!open || open.matter.id !== matterId) return open
          return { ...open, messages: messagesReplacing(open.messages, saved) }
        })
        return false
      }
      if (!response.ok || !saved) throw new Error('answer')
      if (activeIdRef.current === matterId) {
        setThread((open) => {
          if (!open || open.matter.id !== matterId) return open
          const withAnswer = messagesReplacing(open.messages, saved)
          return {
            ...open,
            matter: { ...open.matter, updatedAt: saved.widget?.answeredAt ?? saved.createdAt },
            messages: followUp ? messagesReplacing(withAnswer, followUp) : withAnswer,
          }
        })
      }
      return true
    } catch {
      if (activeIdRef.current === matterId) {
        setThread((open) => {
          if (!open || open.matter.id !== matterId) return open
          return { ...open, messages: snapshot }
        })
        setWidgetError({ toolCallId, message: 'That answer was not saved. Try again.' })
      }
      return false
    } finally {
      setAnsweringWidgetId((currentId) => (currentId === toolCallId ? null : currentId))
    }
  }

  async function renameMatter(
    id: string,
    title: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      const response = await fetch(`/api/matters/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
        cache: 'no-store',
      })
      const body = (await response.json().catch(() => null)) as { matter?: unknown; error?: unknown } | null
      if (!response.ok || !isMatterSummary(body?.matter) || body.matter.id !== id) {
        const message = body && typeof body.error === 'string' && body.error.trim() ? body.error : 'That title could not be saved.'
        return { ok: false, message }
      }
      const matter = body.matter
      setMatters((current) =>
        current
          .map((item) => (item.id === id ? { ...item, title: matter.title, updatedAt: matter.updatedAt } : item))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)),
      )
      setThread((current) => {
        if (!current || current.matter.id !== id) return current
        return { ...current, matter: { ...current.matter, title: matter.title, updatedAt: matter.updatedAt } }
      })
      return { ok: true }
    } catch {
      return { ok: false, message: 'That title could not be saved.' }
    }
  }

  async function archiveMatter(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
    setArchivingId(id)
    try {
      const response = await fetch(`/api/matters/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ archived: true }),
        cache: 'no-store',
      })
      const body = (await response.json().catch(() => null)) as { matter?: unknown; error?: unknown } | null
      if (!response.ok || !isMatterSummary(body?.matter) || body.matter.id !== id) {
        const message = body && typeof body.error === 'string' && body.error.trim() ? body.error : 'This chat could not be archived.'
        setListError(message)
        return { ok: false, message }
      }
      hiddenIds.current.add(id)
      const remaining = mattersRef.current.filter((matter) => matter.id !== id)
      mattersRef.current = remaining
      setMatters(remaining)
      setListError(null)
      if (activeIdRef.current === id) {
        const next = remaining[0]
        if (next) {
          choose(next.id)
        } else {
          activeIdRef.current = null
          setActiveId(null)
          setThread(null)
          setThreadError(null)
          setSendError(null)
          setWidgetError(null)
        }
      }
      return { ok: true }
    } catch {
      setListError('This chat could not be archived.')
      return { ok: false, message: 'This chat could not be archived.' }
    } finally {
      setArchivingId((current) => (current === id ? null : current))
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
      const opened = matterOpenedFromCreate(await response.json())
      if (!opened) throw new Error('create')
      const matter = opened.matter
      setMatters((current) => [matter, ...current.filter((item) => item.id !== matter.id)])
      choose(matter.id, { matter, messages: opened.messages, observations: null })
    } catch {
      setListError('A new chat could not be opened.')
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
    archivingId,
    sending: sendingId !== null && sendingId === activeId,
    sendError,
    answeringWidgetId,
    widgetError,
    choose,
    createMatterSession,
    renameMatter,
    archiveMatter,
    sendMessage,
    answerWidget,
  }
}

function isMatterSummary(value: unknown): value is MatterSummary {
  if (!value || typeof value !== 'object') return false
  const record = value as { id?: unknown; title?: unknown; createdAt?: unknown; updatedAt?: unknown }
  return (
    typeof record.id === 'string' &&
    record.id.trim().length > 0 &&
    typeof record.title === 'string' &&
    record.title.trim().length > 0 &&
    typeof record.createdAt === 'string' &&
    record.createdAt.length > 0 &&
    typeof record.updatedAt === 'string' &&
    record.updatedAt.length > 0
  )
}
