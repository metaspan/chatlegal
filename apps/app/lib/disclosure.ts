/**
 * C-13: the generative-AI disclosure lives in the sticky app-shell footer,
 * once, on every screen — not led into every Concierge or scripted reply.
 *
 * The wording is locked by docs/policies/05-genai-disclosure.md (app row and
 * the C-13 change note). The footer is outside the transcript scroller, so
 * the label survives scrolling and streaming and cannot be dropped by
 * copying one message.
 */
export const APP_DISCLOSURE_LABEL = 'AI-generated information — check the sources.'
