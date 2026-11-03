'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChatColumn } from '@/components/chat/chat-column'
import { DisclaimerBar } from '@/components/disclaimer-bar'
import { AppBar } from '@/components/shell/app-bar'
import { DocumentViewer } from '@/components/shell/document-viewer'
import { HistoryPane } from '@/components/shell/history-pane'
import { PaneEdgeToggle } from '@/components/shell/pane-edge-toggle'
import { useLibrary } from '@/components/shell/use-library'
import { useMatterSessions } from '@/components/shell/use-matter-sessions'
import { usePaneOpen } from '@/components/shell/use-pane-open'
import { useIsMobile } from '@/hooks/use-mobile'
import { draftText, writeDraft } from '@/lib/matters/draft'
import { matterHistoryDetail, matterThreadCopy } from '@/lib/matters/present'
import { SHELL_LEFT_OPEN_KEY, SHELL_RIGHT_OPEN_KEY, escapeRestoresLeftPane } from '@/lib/shell-layout'
import { cn } from '@/lib/utils'

/** Desktop uses the stored choice. A narrow screen stays hidden until opened over the thread. */
function cnPane(desktopOpen: boolean, mobileOpen: boolean): string {
  return cn(
    'max-md:contents',
    desktopOpen ? 'md:relative md:flex md:h-full md:shrink-0' : 'md:hidden',
    mobileOpen ? null : 'max-md:hidden',
  )
}

/** Slim rail left behind when a pane is hidden, so the centre can use the width and the control stays put. */
function PaneRail({ side, children }: { side: 'left' | 'right'; children: ReactNode }) {
  return (
    <div
      data-pane-rail={side}
      className={cn(
        'hidden w-9 shrink-0 justify-center bg-sidebar pt-3 md:flex',
        side === 'left' ? 'border-r' : 'border-l',
      )}
    >
      {children}
    </div>
  )
}

/**
 * Three panes: history, chat, viewer. Either side pane can be hidden.
 * Frame adapted from dcolley/tourbillon@7a8595b
 * apps/web/components/dashboard-shell.tsx and assistant-shell.tsx
 * (resize root and pane open state). The edge rail is the hideable-sidebar
 * chevron from LiteLLM docs, without that brand. hitly-net/hitly@94b2e92
 * is a fumadocs layout and has no pane pin to adapt.
 * Personal accounts only. Matters are Mastra threads for the signed-in user.
 * Send stores the user's words on the open matter. A reply is not written yet.
 * TODO(G-01 Concierge): stream that reply.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const [leftOpen, setLeftOpen] = usePaneOpen(SHELL_LEFT_OPEN_KEY)
  const [rightOpen, setRightOpen] = usePaneOpen(SHELL_RIGHT_OPEN_KEY)
  const [mobileLeft, setMobileLeft] = useState(false)
  const [mobileRight, setMobileRight] = useState(false)
  const [mounted, setMounted] = useState(false)
  const focusChatsOnOpen = useRef(false)
  const [query, setQuery] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const mattersSession = useMatterSessions()
  const library = useLibrary(mattersSession.activeId)
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

  useEffect(() => {
    if (!focusChatsOnOpen.current || !leftOpen || narrow) return
    focusChatsOnOpen.current = false
    document.getElementById('chat-search')?.focus({ preventScroll: true })
  }, [leftOpen, narrow])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const target = event.target
      if (target instanceof Element && target.closest('[role="menu"], [role="listbox"], [role="dialog"]')) return
      if (narrow) {
        if (!mobileLeft && !mobileRight) return
        event.preventDefault()
        setMobileLeft(false)
        setMobileRight(false)
        return
      }
      if (!escapeRestoresLeftPane(event, { leftOpen, rightOpen })) return
      event.preventDefault()
      focusChatsOnOpen.current = true
      setLeftOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [narrow, mobileLeft, mobileRight, leftOpen, rightOpen, setLeftOpen])

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
      <p className="sr-only">When both side panes are hidden, Escape shows chats.</p>
      <div
        className="relative flex min-h-0 flex-1 overflow-hidden"
        data-chat-resize-root
        data-left-open={leftShown ? 'true' : 'false'}
        data-right-open={rightShown ? 'true' : 'false'}
      >
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
              libraryFiles={library.files}
              libraryLoaded={library.loaded}
              libraryError={library.error}
              addingFile={library.adding}
              onAddFile={library.addFile}
              matterFiles={library.matterFiles}
              matterFilesLoaded={library.matterLoaded}
              matterFilesError={library.matterError}
              movingName={library.movingName}
              onMoveToMatter={library.moveToMatter}
              onMoveToLibrary={library.moveToLibrary}
            />
            {leftOpen ? (
              <div className="absolute top-14 -right-3 z-30 hidden md:block">
                <PaneEdgeToggle side="left" open onToggle={() => setLeftOpen(false)} />
              </div>
            ) : null}
          </div>
        ) : null}
        {!leftOpen ? (
          <PaneRail side="left">
            <PaneEdgeToggle side="left" open={false} onToggle={() => setLeftOpen(true)} />
          </PaneRail>
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
          sending={mattersSession.sending}
          sendError={mattersSession.sendError}
          onNewChat={() => {
            setQuery('')
            void mattersSession.createMatterSession()
          }}
          creating={mattersSession.creating}
          onSend={async (text) => {
            const matterId = mattersSession.activeId
            if (!matterId) return false
            setDrafts((current) => writeDraft(current, matterId, ''))
            const saved = await mattersSession.sendMessage(text)
            if (!saved) {
              setDrafts((current) => {
                if (draftText(current, matterId).trim()) return current
                return writeDraft(current, matterId, text)
              })
            }
            return saved
          }}
        >
          {children}
        </ChatColumn>
        {rightOpen || mobileRight ? (
          <div className={cnPane(rightOpen, mobileRight)}>
            {rightOpen ? (
              <div className="absolute top-14 -left-3 z-30 hidden md:block">
                <PaneEdgeToggle side="right" open onToggle={() => setRightOpen(false)} />
              </div>
            ) : null}
            <DocumentViewer
              matterId={mattersSession.activeId}
              threadStatus={mattersSession.threadStatus}
              observations={mattersSession.observations}
              onCollapse={() => (narrow ? setMobileRight(false) : setRightOpen(false))}
            />
          </div>
        ) : null}
        {!rightOpen ? (
          <PaneRail side="right">
            <PaneEdgeToggle side="right" open={false} onToggle={() => setRightOpen(true)} />
          </PaneRail>
        ) : null}
      </div>
      <DisclaimerBar />
    </div>
  )
}
