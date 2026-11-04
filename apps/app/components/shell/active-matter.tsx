'use client'

import { createContext, useContext, type ReactNode } from 'react'

const ActiveMatterContext = createContext<string | null>(null)

/** The matter open in the shell, so a page can list that matter's files. */
export function ActiveMatterProvider({ matterId, children }: { matterId: string | null; children: ReactNode }) {
  return <ActiveMatterContext.Provider value={matterId}>{children}</ActiveMatterContext.Provider>
}

export function useActiveMatterId(): string | null {
  return useContext(ActiveMatterContext)
}
