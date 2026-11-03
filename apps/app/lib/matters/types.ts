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

export type MatterMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
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
