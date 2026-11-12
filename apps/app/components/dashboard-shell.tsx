'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ChatColumn } from '@/components/chat/chat-column'
import { ArchivedChatsModal } from '@/components/shell/archived-chats-modal'
import { DisclaimerBar } from '@/components/disclaimer-bar'
import { AppBar } from '@/components/shell/app-bar'
import { DocumentViewer } from '@/components/shell/document-viewer'
import { HistoryPane } from '@/components/shell/history-pane'
import { PaneEdgeToggle } from '@/components/shell/pane-edge-toggle'
import { ActiveMatterProvider } from '@/components/shell/active-matter'
import { RightPaneActionsProvider, type RightPaneOpenRequest } from '@/components/shell/right-pane-actions'
import { useArchivedMatters } from '@/components/shell/use-archived-matters'
import { useMatterSessions } from '@/components/shell/use-matter-sessions'
import { usePaneOpen } from '@/components/shell/use-pane-open'
import { useIsMobile } from '@/hooks/use-mobile'
import { matterHistoryDetail, matterThreadCopy } from '@/lib/matters/present'
import {
  defaultRightPaneView,
  dismissRightPaneDocument,
  openRightPaneDocument,
  openRightPaneMatterView,
  retainOpenedDocument,
  type RestingPaneView,
  type RightPaneView,
} from '@/lib/right-pane'
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
 * New chat stores a scripted first turn. Send stores the user's words on the open
 * matter. When LiteLLM is on, the Concierge agent (G-01) streams its reply and can
 * ask the person structured questions as C-04 cards. The same open path can show a file
 * when Concierge asks; until then Open on a library file does it.
 * The right pane rests on chat state (dcolley/tourbillon@7a8595b
 * apps/web/components/chat/chat-context.tsx docks chat on the right).
 * Open shows a file in that pane. Close, and Summary, return to chat state.
 * People, dates, and status are other views in the same pane.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const [leftOpen, setLeftOpen] = usePaneOpen(SHELL_LEFT_OPEN_KEY)
  const [rightOpen, setRightOpen] = usePaneOpen(SHELL_RIGHT_OPEN_KEY)
  const [mobileLeft, setMobileLeft] = useState(false)
  const [mobileRight, setMobileRight] = useState(false)
  const [mounted, setMounted] = useState(false)
  const focusChatsOnOpen = useRef(false)
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const mattersSession = useMatterSessions()
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [archivedQuery, setArchivedQuery] = useState('')
  const archivedSession = useArchivedMatters({
    onRestored: (matter) => mattersSession.restoreMatter(matter),
  })
  const [rightPane, setRightPane] = useState<RightPaneView>(() => defaultRightPaneView())
  const activeMatterId = mattersSession.activeId
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
    setRightPane((current) => retainOpenedDocument(current, activeMatterId))
  }, [activeMatterId])

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

  function showDocument(file: RightPaneOpenRequest) {
    setRightPane(
      openRightPaneDocument({
        name: file.name,
        scope: file.scope,
        matterId: file.scope === 'matter' ? activeMatterId : null,
      }),
    )
    if (narrow) {
      setMobileLeft(false)
      setMobileRight(true)
      return
    }
    setRightOpen(true)
  }

  function dismissDocument() {
    setRightPane(dismissRightPaneDocument())
  }

  function selectView(mode: RestingPaneView) {
    setRightPane(mode === 'chat-state' ? dismissRightPaneDocument() : openRightPaneMatterView(mode))
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
    <RightPaneActionsProvider value={{ openDocument: showDocument, dismissDocument }}>
    <ActiveMatterProvider matterId={activeMatterId}>
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
              onRename={(id, title) => mattersSession.renameMatter(id, title)}
              onArchive={(id) => {
                void mattersSession.archiveMatter(id)
              }}
              archivingId={mattersSession.archivingId}
              onCollapse={() => (narrow ? setMobileLeft(false) : setLeftOpen(false))}
              onOpenArchived={() => {
                setArchivedQuery('')
                archivedSession.reload()
                setArchivedOpen(true)
              }}
              libraryActive={pathname === '/library'}
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
          sendError={mattersSession.sendError}
          answeringWidgetId={mattersSession.answeringWidgetId}
          widgetError={mattersSession.widgetError}
          onAnswerWidget={(toolCallId, answer) => {
            void mattersSession.answerWidget(toolCallId, answer)
          }}
          onNewChat={() => {
            setQuery('')
            void mattersSession.createMatterSession()
          }}
          creating={mattersSession.creating}
          onSend={(text, matterId) => mattersSession.sendMessage(text, matterId, { optimistic: false })}
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
              matter={mattersSession.active}
              messages={mattersSession.messages}
              threadStatus={mattersSession.threadStatus}
              observations={mattersSession.observations}
              replying={mattersSession.replying}
              viewMode={rightPane.mode}
              document={rightPane.document}
              onSelectView={selectView}
              onDismiss={dismissDocument}
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
      <ArchivedChatsModal
        open={archivedOpen}
        onOpenChange={setArchivedOpen}
        rows={archivedSession.archived.map((matter) => ({
          id: matter.id,
          title: matter.title,
          detail: matterHistoryDetail(matter),
        }))}
        loaded={archivedSession.loaded}
        listError={archivedSession.listError}
        query={archivedQuery}
        onQueryChange={setArchivedQuery}
        onOpen={(id) => {
          // Read the chat. The archive flag stays set; only the modal's
          // restore action returns a chat to the history list.
          mattersSession.choose(id)
          if (narrow) setMobileLeft(false)
          setArchivedOpen(false)
        }}
        onUnarchive={(id) => {
          void archivedSession.unarchiveMatter(id)
        }}
        unarchivingId={archivedSession.unarchivingId}
        onRetry={() => archivedSession.reload()}
      />
      <DisclaimerBar />
    </div>
    </ActiveMatterProvider>
    </RightPaneActionsProvider>
  )
}
