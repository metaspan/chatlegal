import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  answerOutgrowsViewport,
  bottomScrollTop,
  clampScrollTop,
  distanceFromBottom,
  isAtBottom,
  nextTranscriptScroll,
  questionNearTop,
  TRANSCRIPT_STICK_THRESHOLD_PX,
  type ScrollMetrics,
  type TranscriptScrollState,
} from './transcript-scroll.ts'

const AUTO: TranscriptScrollState = { mode: 'auto', placed: true }
const READING: TranscriptScrollState = { mode: 'reading', placed: false }
const READING_PLACED: TranscriptScrollState = { mode: 'reading', placed: true }
const MANUAL: TranscriptScrollState = { mode: 'manual', placed: true }

/** A tall transcript: 3000 px of content in a 600 px viewport. */
const tall = (scrollTop: number): ScrollMetrics => ({ scrollTop, scrollHeight: 3000, clientHeight: 600 })
/** A short transcript that fits the viewport. */
const short = (scrollTop: number): ScrollMetrics => ({ scrollTop, scrollHeight: 400, clientHeight: 600 })

describe('C-15 transcript scroll rules', () => {
  it('opens an existing thread at the bottom and a fresh matter at the top', () => {
    const resumed = nextTranscriptScroll(AUTO, { type: 'open', metrics: tall(0), hasUserTurn: true })
    assert.equal(resumed.scrollTop, 2400)
    assert.equal(resumed.state.mode, 'auto')

    const fresh = nextTranscriptScroll(AUTO, { type: 'open', metrics: tall(0), hasUserTurn: false })
    assert.equal(fresh.scrollTop, 0)
  })

  it('auto mode follows new content to the bottom', () => {
    const followed = nextTranscriptScroll(AUTO, { type: 'content', metrics: tall(2300), questionTop: 1200 })
    assert.equal(followed.scrollTop, 2400)
    assert.equal(followed.state.mode, 'auto')
  })

  it('scrolling up stops auto-follow and manual mode ignores new content', () => {
    const up = nextTranscriptScroll(AUTO, { type: 'user-scroll', metrics: tall(500) })
    assert.equal(up.state.mode, 'manual')
    assert.equal(up.scrollTop, null)

    const still = nextTranscriptScroll(MANUAL, { type: 'content', metrics: tall(500), questionTop: 1200 })
    assert.equal(still.scrollTop, null)
    assert.equal(still.state.mode, 'manual')
  })

  it('reaching the bottom by scroll resumes auto-follow', () => {
    const back = nextTranscriptScroll(MANUAL, { type: 'user-scroll', metrics: tall(2400 - TRANSCRIPT_STICK_THRESHOLD_PX) })
    assert.equal(back.state.mode, 'auto')
    assert.equal(back.scrollTop, null)

    const followAgain = nextTranscriptScroll(back.state, { type: 'content', metrics: tall(2380), questionTop: 1200 })
    assert.equal(followAgain.scrollTop, 2400)
  })

  it('the jump control goes to the bottom and pins', () => {
    const jumped = nextTranscriptScroll(MANUAL, { type: 'jump', metrics: tall(500) })
    assert.equal(jumped.scrollTop, 2400)
    assert.equal(jumped.state.mode, 'auto')
    assert.equal(jumped.state.placed, true)
  })

  it('a new user turn enters reading mode and shows the sent message', () => {
    const sent = nextTranscriptScroll(AUTO, { type: 'send', metrics: tall(1000) })
    assert.equal(sent.state.mode, 'reading')
    assert.equal(sent.state.placed, false)
    assert.equal(sent.scrollTop, 2400)
  })

  it('a long answer puts the question at the top, then the view holds still mid-stream', () => {
    // Question row sits at 1200 px; the streamed answer has outgrown the viewport.
    const placed = nextTranscriptScroll(READING, { type: 'content', metrics: tall(2400), questionTop: 1200 })
    assert.equal(placed.scrollTop, 1200)
    assert.equal(placed.state.placed, true)

    // Later tokens must not pull the view back down.
    const held = nextTranscriptScroll(placed.state, { type: 'content', metrics: tall(1200), questionTop: 1200 })
    assert.equal(held.scrollTop, null)
    assert.equal(held.state.mode, 'reading')
  })

  it('a question already at/near the top is not moved', () => {
    const near = nextTranscriptScroll(READING, { type: 'content', metrics: tall(1210), questionTop: 1200 })
    assert.equal(near.scrollTop, null)
    assert.equal(near.state.placed, true)
  })

  it('a short answer keeps following the bottom so all of it shows', () => {
    // The whole answer fits under the question: follow the bottom instead of anchoring.
    const following = nextTranscriptScroll(READING, { type: 'content', metrics: short(0), questionTop: 100 })
    assert.equal(following.scrollTop, 0)
    const fits = nextTranscriptScroll(READING, {
      type: 'content',
      metrics: { scrollTop: 0, scrollHeight: 700, clientHeight: 600 },
      questionTop: 100,
    })
    assert.equal(fits.scrollTop, 100) // bottom = 700 - 600; 700 - 100 = 600 fits the viewport
    assert.equal(fits.state.placed, false)

    // One px over the viewport and the reading rule takes over: question at the top.
    const overflows = nextTranscriptScroll(READING, {
      type: 'content',
      metrics: { scrollTop: 0, scrollHeight: 701, clientHeight: 600 },
      questionTop: 100,
    })
    assert.equal(overflows.scrollTop, 100)
    assert.equal(overflows.state.placed, true)
  })

  it('reading mode without a user question (card continuation) follows the bottom', () => {
    const followed = nextTranscriptScroll(READING, { type: 'content', metrics: tall(100), questionTop: null })
    assert.equal(followed.scrollTop, 2400)
  })

  it('scrolling to the bottom while reading resumes auto for later turns', () => {
    const back = nextTranscriptScroll(READING_PLACED, { type: 'user-scroll', metrics: tall(2400) })
    assert.equal(back.state.mode, 'auto')
    const later = nextTranscriptScroll(back.state, { type: 'content', metrics: tall(2390), questionTop: 1200 })
    assert.equal(later.scrollTop, 2400)
  })

  it('pure helpers clamp and measure as documented', () => {
    assert.equal(bottomScrollTop(tall(0)), 2400)
    assert.equal(clampScrollTop(-10, tall(0)), 0)
    assert.equal(clampScrollTop(9999, tall(0)), 2400)
    assert.equal(distanceFromBottom(tall(2380)), 20)
    assert.equal(isAtBottom(tall(2400 - TRANSCRIPT_STICK_THRESHOLD_PX)), true)
    assert.equal(isAtBottom(tall(2300)), false)
    assert.equal(answerOutgrowsViewport(1200, tall(0)), true)
    assert.equal(answerOutgrowsViewport(100, short(0)), false)
    assert.equal(questionNearTop(1200, tall(1210)), true)
    assert.equal(questionNearTop(1200, tall(900)), false)
  })
})
