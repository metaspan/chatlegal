/**
 * C-15: scrolling rules for the chat transcript (pure; the React binding is
 * components/chat/use-transcript-scroll.ts).
 *
 * The bottom-follow rules are adapted from dcolley/tourbillon@7a8595b
 * apps/web/lib/assistant/transcript-scroll.ts (sticky-bottom transcript):
 * the transcript opens and stays pinned to the bottom while content streams,
 * scrolling up unpins it, and it re-pins when the user scrolls back to the
 * bottom or uses the "scroll to bottom" control.
 *
 * The reading rule is ChatLegal's own (C-15): when the person sends and the
 * assistant answer that follows is taller than the viewport, the person's
 * question is placed at the top of the viewport and the view then holds
 * still — no jump to the bottom mid-stream. Reaching the bottom (scroll or
 * control) resumes normal auto-follow for later turns.
 */

/** Within this many px of the bottom counts as "at the bottom" (sub-pixel rounding, small nudges). */
export const TRANSCRIPT_STICK_THRESHOLD_PX = 48

/** The question counts as "at/near the top" within this many px of the target. */
export const QUESTION_TOP_TOLERANCE_PX = 56

export interface ScrollMetrics {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

export function distanceFromBottom(m: ScrollMetrics): number {
  return Math.max(0, m.scrollHeight - m.clientHeight - m.scrollTop)
}

export function isAtBottom(m: ScrollMetrics, threshold = TRANSCRIPT_STICK_THRESHOLD_PX): boolean {
  return distanceFromBottom(m) <= threshold
}

/** The scrollTop that shows the bottom of the content. */
export function bottomScrollTop(m: Pick<ScrollMetrics, 'scrollHeight' | 'clientHeight'>): number {
  return Math.max(0, m.scrollHeight - m.clientHeight)
}

/** Clamp a desired scrollTop into the scrollable range. */
export function clampScrollTop(target: number, m: ScrollMetrics): number {
  return Math.min(Math.max(0, target), bottomScrollTop(m))
}

/**
 * Transcript scroll modes:
 * - 'auto': pinned to the bottom; new messages and streamed tokens follow to the bottom.
 * - 'reading': a new user turn is being read; the question sits at/near the top and the
 *   view is left alone while the answer streams (set by 'send', cleared at the bottom).
 * - 'manual': the user scrolled up; nothing moves the view until they return to the bottom.
 */
export type TranscriptMode = 'auto' | 'reading' | 'manual'

export interface TranscriptScrollState {
  mode: TranscriptMode
  /** In 'reading': the question has already been placed at the top for this turn. */
  placed: boolean
}

export type TranscriptScrollInput =
  /** The transcript opened for a matter. A fresh matter (no user turn yet) shows the opening notice at the top. */
  | { type: 'open'; metrics: ScrollMetrics; hasUserTurn: boolean }
  /** A new user message arrived (the person sent). */
  | { type: 'send'; metrics: ScrollMetrics }
  /** Content changed: a new assistant message, or streamed tokens into the last one. */
  | { type: 'content'; metrics: ScrollMetrics; questionTop: number | null }
  /** A scroll event from the user, with the scroller's metrics after it. */
  | { type: 'user-scroll'; metrics: ScrollMetrics }
  /** The "scroll to bottom" control was pressed. */
  | { type: 'jump'; metrics: ScrollMetrics }

export interface TranscriptScrollResult {
  state: TranscriptScrollState
  /** The scrollTop to apply, or null to leave the view where it is. */
  scrollTop: number | null
}

/** Whether the thread below the question is taller than the viewport. */
export function answerOutgrowsViewport(questionTop: number, m: ScrollMetrics): boolean {
  return m.scrollHeight - questionTop > m.clientHeight
}

/** Whether the question already sits at/near the top of the viewport. */
export function questionNearTop(questionTop: number, m: ScrollMetrics, tolerance = QUESTION_TOP_TOLERANCE_PX): boolean {
  return Math.abs(clampScrollTop(questionTop, m) - m.scrollTop) <= tolerance
}

/**
 * The next mode and the scrollTop to apply (null = do not move the view).
 *
 * - auto + content: follow the bottom (default C-15 behaviour for messages and tokens).
 * - manual: never moved by content; a user scroll to the bottom returns to auto.
 * - send: the view shows the person's message, and the turn enters 'reading'.
 * - reading + content: until the question is placed, follow the bottom while the answer is
 *   short; once the answer outgrows the viewport, place the question at the top exactly
 *   once, then hold the view still for the rest of the stream.
 * - user-scroll at the bottom (or jump): back to auto, so later turns follow again.
 */
export function nextTranscriptScroll(state: TranscriptScrollState, input: TranscriptScrollInput): TranscriptScrollResult {
  switch (input.type) {
    case 'open':
      if (input.hasUserTurn) {
        return { state: { mode: 'auto', placed: true }, scrollTop: bottomScrollTop(input.metrics) }
      }
      // A new matter opens on its scripted notice, not the foot of a long first turn.
      return { state: { mode: 'auto', placed: true }, scrollTop: 0 }
    case 'send':
      return { state: { mode: 'reading', placed: false }, scrollTop: bottomScrollTop(input.metrics) }
    case 'content': {
      if (state.mode === 'manual') return { state, scrollTop: null }
      if (state.mode === 'auto') return { state, scrollTop: bottomScrollTop(input.metrics) }
      // reading
      const questionTop = input.questionTop
      if (questionTop === null) {
        // No user question to anchor on (e.g. a card-answer continuation): follow the bottom.
        return { state, scrollTop: bottomScrollTop(input.metrics) }
      }
      if (!state.placed) {
        if (!answerOutgrowsViewport(questionTop, input.metrics)) {
          // The whole answer still fits under the question: keep showing all of it.
          return { state, scrollTop: bottomScrollTop(input.metrics) }
        }
        if (questionNearTop(questionTop, input.metrics)) {
          return { state: { ...state, placed: true }, scrollTop: null }
        }
        return { state: { ...state, placed: true }, scrollTop: clampScrollTop(questionTop, input.metrics) }
      }
      // Placed: leave the scroll alone while they read. No jump to the bottom mid-stream.
      return { state, scrollTop: null }
    }
    case 'user-scroll': {
      if (isAtBottom(input.metrics)) {
        // They scrolled (or were dragged) to the bottom: resume normal auto-follow.
        return { state: { mode: 'auto', placed: true }, scrollTop: null }
      }
      if (state.mode === 'manual') return { state, scrollTop: null }
      return { state: { mode: 'manual', placed: state.placed }, scrollTop: null }
    }
    case 'jump':
      return { state: { mode: 'auto', placed: true }, scrollTop: bottomScrollTop(input.metrics) }
  }
}
