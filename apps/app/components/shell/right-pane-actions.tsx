'use client'

import { createContext, useContext, type ReactNode } from 'react'

export type RightPaneOpenRequest = {
  name: string
  scope: 'user' | 'matter'
}

type RightPaneActions = {
  openDocument: (file: RightPaneOpenRequest) => void
  dismissDocument: () => void
}

const RightPaneActionsContext = createContext<RightPaneActions | null>(null)

/** Shell-owned open and dismiss. Library pages call this; the pane state stays in the shell. */
export function RightPaneActionsProvider({ value, children }: { value: RightPaneActions; children: ReactNode }) {
  return <RightPaneActionsContext.Provider value={value}>{children}</RightPaneActionsContext.Provider>
}

export function useRightPaneActions(): RightPaneActions | null {
  return useContext(RightPaneActionsContext)
}
