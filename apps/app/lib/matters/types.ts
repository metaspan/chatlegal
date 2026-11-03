/**
 * One matter is one Mastra memory thread.
 * Dates are ISO strings so the value can cross the API and the client unchanged.
 */

export type MatterSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

/**
 * A tool the assistant used on this message, other than an askChoice card.
 * The name is enough for the centre pane. Arguments and results stay on the server.
 */
export type MatterToolUse = {
  name: string
}

/**
 * One option on an askChoice card.
 * Ids are the values stored with the answer. Labels are what the person sees.
 */
export type AskChoiceOption = {
  id: string
  label: string
  description?: string
}

/** Single-select stores `{ choice }`. Multi-select stores `{ choices }`. */
export type AskChoiceAnswer = { choice: string } | { choices: string[] }

/**
 * An askChoice card on an assistant message.
 * Shape adapted from dcolley/tourbillon@7a8595b
 * apps/web/components/assistant/widgets/chat-card-specs.ts (askChoice v2).
 * `allowCustom` is not part of that card, so there is no free-text option here.
 */
export type MatterAskChoice = {
  toolCallId: string
  name: 'askChoice'
  version: 1 | 2
  question: string
  detail?: string
  options: AskChoiceOption[]
  multiSelect: boolean
  minSelected: number
  maxSelected: number
  recommended?: string[]
  defaultOption?: string
  status: 'pending' | 'answered'
  answer?: AskChoiceAnswer
  answeredAt?: string
}

export type MatterMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
  tools?: MatterToolUse[]
  widget?: MatterAskChoice
  /** Set on a message that is on screen before the server has stored it. */
  pending?: boolean
}

/**
 * Concierge summary for one matter thread.
 * `enabled` is whether the observer model is configured.
 * `summary` is the text already stored for this thread. Empty when there is none.
 */
export type MatterObservations = {
  enabled: boolean
  summary: string
}

export type MatterThread = {
  matter: MatterSummary
  messages: MatterMessage[]
  observations: MatterObservations
}

export type MatterThreadStatus = 'idle' | 'loading' | 'ready' | 'error'
