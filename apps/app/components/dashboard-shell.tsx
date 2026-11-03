'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ChatColumn } from '@/components/chat/chat-column'
import { DisclaimerBar } from '@/components/disclaimer-bar'
import { AppBar } from '@/components/shell/app-bar'
import { DocumentViewer } from '@/components/shell/document-viewer'
import { HistoryPane } from '@/components/shell/history-pane'
import { useMatterSessions } from '@/components/shell/use-matter-sessions'
import { usePaneOpen } from '@/components/shell/use-pane-open'
import { useIsMobile } from '@/hooks/use-mobile'
import { draftText, writeDraft } from '@/lib/matters/draft'
import { matterHistoryDetail, matterThreadCopy } from '@/lib/matters/present'
import { SHELL_LEFT_OPEN_KEY, SHELL_RIGHT_OPEN_KEY } from '@/lib/shell-layout'
import { cn } from '@/lib/utils'

/** Desktop uses the stored choice. A narrow screen stays hidden until opened over the thread. */
function cnPane(desktopOpen: boolean, mobileOpen: boolean): string {
  return cn(desktopOpen ? 'md:contents' : 'md:hidden', mobileOpen ? 'max-md:contents' : 'max-md:hidden')
}

/**
 * Three panes: history, chat, viewer. Either side pane can be hidden.
 * Frame adapted from dcolley/tourbillon@7a8595b
 * apps/web/components/dashboard-shell.tsx and assistant-shell.tsx.
 * Personal accounts only. Matters are Mastra threads for the signed-in user.
 * Sending stays off until a model is connected.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const [leftOpen, setLeftOpen] = usePaneOpen(SHELL_LEFT_OPEN_KEY)
  const [rightOpen, setRightOpen] = usePaneOpen(SHELL_RIGHT_OPEN_KEY)
  const [mobileLeft, setMobileLeft] = useState(false)
  const [mobileRight, setMobileRight] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [libraryNote, setLibraryNote] = useState<string | null>(null)
  const mattersSession = useMatterSessions()
  const isMobile = useIsMobile()
  const copy = matterThreadCopy({
    title: mattersSession.active?.title ?? null,
    status: mattersSession.threadStatus,
    messageCount: mattersSession.messages.length,
  })
  // Wait until after mount so the server HTML matches. A narrow screen then
  // keeps the side panes closed until the app bar opens one over the thread.
  const narrow = mounted && isMobile
  const leftShown = narrow ? mobileLeft : leftOpen
  const rightShown = narrow ? mobileRight : rightOpen

  useEffect(() => {
    setMounted(true)
  }, [])

  function toggleLeft() {
    if (narrow) {
      setMobileLeft((open) => {
        if (!open) setMobileRight(false)
        return !open
      })
      return
    }
    setLeftOpen(!leftOpen)
  }

  function toggleRight() {
    if (narrow) {
      setMobileRight((open) => {
        if (!open) setMobileLeft(false)
        return !open
      })
      return
    }
    setRightOpen(!rightOpen)
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground" data-shell="three-pane">
      <a
        href="#chat-thread"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to chat
      </a>
      <AppBar leftOpen={leftShown} rightOpen={rightShown} onToggleLeft={toggleLeft} onToggleRight={toggleRight} />
      <div className="relative flex min-h-0 flex-1 overflow-hidden" data-chat-resize-root>
        {narrow && (mobileLeft || mobileRight) ? (
          <button
            type="button"
            className="absolute inset-0 z-20 bg-foreground/20 md:hidden"
            aria-label="Close side pane"
            onClick={() => {
              setMobileLeft(false)
              setMobileRight(false)
            }}
          />
        ) : null}
        {leftOpen || mobileLeft ? (
          <div className={cnPane(leftOpen, mobileLeft)}>
            <HistoryPane
              query={query}
              onQueryChange={setQuery}
              matters={mattersSession.matters.map((matter) => ({
                id: matter.id,
                title: matter.title,
                detail: matterHistoryDetail(matter),
              }))}
              loaded={mattersSession.loaded}
              listError={mattersSession.listError}
              activeId={mattersSession.activeId}
              onSelect={(id) => {
                mattersSession.choose(id)
                if (narrow) setMobileLeft(false)
              }}
              onNewChat={() => {
                setQuery('')
                void mattersSession.createMatterSession()
              }}
              creating={mattersSession.creating}
              onCollapse={() => (narrow ? setMobileLeft(false) : setLeftOpen(false))}
              libraryNote={libraryNote}
              onAddFile={() => setLibraryNote('Adding files is not connected yet.')}
            />
          </div>
        ) : null}
        <ChatColumn
          title={copy.title}
          detail={copy.detail}
          matterId={mattersSession.activeId}
          messages={mattersSession.messages}
          threadStatus={mattersSession.threadStatus}
          observations={mattersSession.observations}
          draft={draftText(drafts, mattersSession.activeId)}
          onDraftChange={(text) => {
            const matterId = mattersSession.activeId
            if (!matterId) return
            setDrafts((current) => writeDraft(current, matterId, text))
          }}
        >
          {children}
        </ChatColumn>
        {rightOpen || mobileRight ? (
          <div className={cnPane(rightOpen, mobileRight)}>
            <DocumentViewer
              matterId={mattersSession.activeId}
              threadStatus={mattersSession.threadStatus}
              observations={mattersSession.observations}
              onCollapse={() => (narrow ? setMobileRight(false) : setRightOpen(false))}
            />
          </div>
        ) : null}
      </div>
      <DisclaimerBar />
    </div>
  )
}
