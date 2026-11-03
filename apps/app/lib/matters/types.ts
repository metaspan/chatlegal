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

export type MatterThread = {
  matter: MatterSummary
  messages: MatterMessage[]
}

export type MatterThreadStatus = 'idle' | 'loading' | 'ready' | 'error'
