'use client'

import type { ReactNode } from 'react'
import { AgentChatPane } from '@/components/chat/agent-chat-pane'
import { DashboardSidebar } from '@/components/dashboard-sidebar'
import { DisclaimerBar } from '@/components/disclaimer-bar'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

/**
 * Three panes: matters/work nav, case work, docked chat.
 * Adapted from dcolley/tourbillon@7a8595b apps/web/components/dashboard-shell.tsx.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <a
        href="#case-work"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to case work
      </a>
      <TooltipProvider>
        <SidebarProvider className="h-auto min-h-0 w-full flex-1 overflow-hidden">
          <DashboardSidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row" data-chat-resize-root>
            <SidebarInset className="min-h-0 min-w-0 flex-1">
              <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
                <div className="flex items-center gap-2 md:hidden">
                  <SidebarTrigger />
                  <Separator orientation="vertical" className="h-4" />
                </div>
                <span className="truncate font-serif text-sm font-semibold md:hidden">ChatLegal</span>
              </header>
              <div id="case-work" className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-4 md:px-6">
                {children}
              </div>
            </SidebarInset>
            <AgentChatPane />
          </div>
        </SidebarProvider>
      </TooltipProvider>
      <DisclaimerBar />
    </div>
  )
}
