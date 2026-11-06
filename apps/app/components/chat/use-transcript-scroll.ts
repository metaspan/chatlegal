'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  distanceFromBottom,
  isAtBottom,
  nextTranscriptScroll,
  TRANSCRIPT_STICK_THRESHOLD_PX,
  type ScrollMetrics,
  type TranscriptScrollState,
} from '@/lib/chat/transcript-scroll'
import type { MatterMessage } from '@/lib/matters/types'

/**
 * C-15: React binding for the transcript scroll rules in lib/chat/transcript-scroll.ts.
 * The sticky-bottom shape (ref + onScroll + pinned flag + jump control) is adapted from
 * dcolley/tourbillon@7a8595b apps/web/components/assistant/use-sticky-transcript.ts.
 *
 * Attach `ref` and `onScroll` to the scrolling element. Show the jump control while
 * `showJump` is true and call `jumpToBottom` from it.
 */

// useLayoutEffect warns during server rendering; the column is also rendered with react-dom/server in tests.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** Message rows carry data-message-role (message-list.tsx); the newest user row anchors the reading rule. */
const USER_ROW_SELECTOR = '[data-message-role="user"]'

function metricsOf(el: HTMLElement): ScrollMetrics {
  return { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }
}

export interface TranscriptScroll {
  ref: React.RefObject<HTMLDivElement | null>
  onScroll: () => void
  /** True while the view is not at the bottom: show the scroll-to-bottom control. */
  showJump: boolean
  /** The scroll-to-bottom control: go to the bottom and resume auto-follow. */
  jumpToBottom: () => void
}

export function useTranscriptScroll(
  matterId: string | null,
  messages: readonly MatterMessage[],
): TranscriptScroll {
  const ref = useRef<HTMLDivElement | null>(null)
  const state = useRef<TranscriptScrollState>({ mode: 'auto', placed: true })
  const openedFor = useRef<string | null>(null)
  const lastTurn = useRef<{ lastId: string; lastRole: string; lastLength: number } | null>(null)
  // A programmatic scrollTop write fires a scroll event; that event is not the user steering.
  const programmatic = useRef<{ scrollTop: number; at: number } | null>(null)
  const [showJump, setShowJump] = useState(false)

  const applyScrollTop = useCallback((el: HTMLElement, target: number | null) => {
    if (target === null || el.scrollTop === target) return
    programmatic.current = { scrollTop: target, at: Date.now() }
    el.scrollTop = target
    setShowJump(distanceFromBottom(metricsOf(el)) > TRANSCRIPT_STICK_THRESHOLD_PX)
  }, [])

  const dispatch = useCallback(
    (input: Parameters<typeof nextTranscriptScroll>[1]) => {
      const el = ref.current
      if (!el) return
      const result = nextTranscriptScroll(state.current, input)
      state.current = result.state
      applyScrollTop(el, result.scrollTop)
    },
    [applyScrollTop],
  )

  const onScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    const metrics = metricsOf(el)
    const written = programmatic.current
    if (written && Math.abs(metrics.scrollTop - written.scrollTop) <= 1 && Date.now() - written.at < 200) {
      // The echo of our own write: update the control, keep the mode.
      setShowJump(distanceFromBottom(metrics) > TRANSCRIPT_STICK_THRESHOLD_PX)
      return
    }
    dispatch({ type: 'user-scroll', metrics })
    setShowJump(!isAtBottom(metrics))
  }, [dispatch])

  const jumpToBottom = useCallback(() => {
    const el = ref.current
    if (!el) return
    dispatch({ type: 'jump', metrics: metricsOf(el) })
    setShowJump(false)
  }, [dispatch])

  const lastId = messages.at(-1)?.id ?? ''
  const lastRole = messages.at(-1)?.role ?? ''
  const lastLength = messages.at(-1)?.text.length ?? 0

  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (messages.length === 0) {
      // Waiting for the thread to arrive: do not place anything yet.
      openedFor.current = null
      lastTurn.current = null
      return
    }
    const key = matterId ?? ''
    if (openedFor.current !== key) {
      openedFor.current = key
      lastTurn.current = { lastId, lastRole, lastLength }
      dispatch({ type: 'open', metrics: metricsOf(el), hasUserTurn: messages.some((m) => m.role === 'user') })
      return
    }
    const previous = lastTurn.current
    if (!previous) {
      lastTurn.current = { lastId, lastRole, lastLength }
      return
    }
    if (previous.lastId === lastId && previous.lastLength === lastLength) return
    const metrics = metricsOf(el)
    if (previous.lastId !== lastId && lastRole === 'user') {
      // The person sent: show their message and enter the reading rule for the answer.
      lastTurn.current = { lastId, lastRole, lastLength }
      dispatch({ type: 'send', metrics })
      setShowJump(false)
      return
    }
    lastTurn.current = { lastId, lastRole, lastLength }
    // A new assistant row, or streamed tokens into the last one: anchor on the newest question.
    const rows = el.querySelectorAll(USER_ROW_SELECTOR)
    const newestQuestion = rows[rows.length - 1] as HTMLElement | undefined
    const questionTop = newestQuestion
      ? newestQuestion.getBoundingClientRect().top - el.getBoundingClientRect().top + metrics.scrollTop
      : null
    dispatch({ type: 'content', metrics, questionTop })
    setShowJump(distanceFromBottom(metricsOf(el)) > TRANSCRIPT_STICK_THRESHOLD_PX)
  }, [matterId, messages, lastId, lastRole, lastLength, dispatch])

  return { ref, onScroll, showJump, jumpToBottom }
}
