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
 * A tool the assistant used on this message.
 * The name is enough for the centre pane. Arguments and results stay on the server.
 */
export type MatterToolUse = {
  name: string
}

export type MatterMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
  tools?: MatterToolUse[]
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
