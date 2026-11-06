'use client'

import { type ReactNode } from 'react'
import { ArrowDown, Plus } from 'lucide-react'
import { Composer } from '@/components/chat/composer/composer'
import type { SendOutcome } from '@/components/chat/composer/composer-controller'
import { MessageList } from '@/components/chat/message-list'
import { useTranscriptScroll } from '@/components/chat/use-transcript-scroll'
import { MatterSummary } from '@/components/shell/matter-summary'
import { Button } from '@/components/ui/button'
import type { AskChoiceAnswer, MatterMessage, MatterObservations, MatterThreadStatus } from '@/lib/matters/types'

/**
 * Centre column: the open matter's messages and a text box.
 * The box matches the composer frame in
 * dcolley/tourbillon@7a8595b apps/web/components/assistant/composer/composer.tsx
 * (bordered field, message label, send row). A send that fails or times out
 * stays in the queue and is tried again when the connection returns.
 * The send row names the default class (Small, chatlegal-1). It is not a picker.
 * Attachments, steer, and stop stay out: there is no TaskRunner run yet (G-02).
 * The Concierge (G-01) streams its reply after Send stores the person's
 * words and can ask structured questions as C-04 cards on the thread.
 * A new matter still opens on its scripted first turn.
 * The draft is kept against the open matter id.
 * C-15: the transcript auto-follows the bottom for new messages and streamed
 * tokens, stops when the person scrolls up (a scroll-to-bottom control then
 * resumes it), and on a new user turn puts the question at/near the top of
 * the viewport and holds still while a long answer streams. Rules:
 * lib/chat/transcript-scroll.ts (adapted from dcolley/tourbillon@7a8595b
 * apps/web/lib/assistant/transcript-scroll.ts + use-sticky-transcript.ts).
 */
export function ChatColumn({
  title,
  detail,
  matterId,
  messages,
  draft = '',
  onSend,
  onAnswerWidget,
  answeringWidgetId = null,
  widgetError = null,
  onNewChat,
  creating = false,
  sendError = null,
  threadStatus = 'idle',
  observations = null,
  children,
}: {
  title: string
  detail: string
  matterId: string | null
  messages: readonly MatterMessage[]
  /** First-paint text for this matter. The composer keeps later drafts itself. */
  draft?: string
  onSend?: (text: string, matterId: string) => Promise<SendOutcome | boolean | void> | SendOutcome | boolean | void
  onAnswerWidget?: (toolCallId: string, answer: AskChoiceAnswer) => void
  answeringWidgetId?: string | null
  widgetError?: { toolCallId: string; message: string } | null
  onNewChat?: () => void
  creating?: boolean
  sendError?: string | null
  threadStatus?: MatterThreadStatus
  observations?: MatterObservations | null
  children?: ReactNode
}) {
  const scroller = useTranscriptScroll(matterId, messages)
  const showSummary = threadStatus === 'ready' && Boolean(observations?.summary.trim())

  return (
    <main
      id="chat"
      aria-label="Chat"
      data-pane="chat"
      data-matter-id={matterId ?? ''}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scroller.ref}
          onScroll={scroller.onScroll}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          {children ? <div className="px-4 pt-4 md:px-6">{children}</div> : null}
          <div id="chat-thread" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 md:px-6">
            {messages.length === 0 ? (
              <div data-chat-empty className="my-auto flex max-w-prose flex-col gap-3">
                <h1 className="font-serif text-2xl font-semibold tracking-tight">{title}</h1>
                {detail ? <p className="text-sm leading-relaxed text-muted-foreground">{detail}</p> : null}
                {!matterId && onNewChat ? (
                  <div>
                    <Button type="button" variant="outline" onClick={onNewChat} disabled={creating} aria-busy={creating}>
                      <Plus />
                      New chat
                    </Button>
                  </div>
                ) : null}
                {showSummary ? (
                  <MatterSummary matterId={matterId} status={threadStatus} observations={observations} />
                ) : null}
              </div>
            ) : (
              <>
                <h1 className="font-serif text-lg font-semibold tracking-tight">{title}</h1>
                {showSummary ? (
                  <MatterSummary matterId={matterId} status={threadStatus} observations={observations} />
                ) : null}
                <MessageList
                  messages={messages}
                  onAnswerWidget={onAnswerWidget}
                  answeringWidgetId={answeringWidgetId}
                  widgetError={widgetError}
                />
              </>
            )}
          </div>
        </div>
        {/* C-15: shown when the view is away from the bottom (scrolled up, or reading a
            long answer from its question). Resumes auto-follow when pressed. */}
        {scroller.showJump ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <button
              type="button"
              data-scroll-to-bottom
              aria-label="Scroll to bottom"
              onClick={scroller.jumpToBottom}
              className="pointer-events-auto flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md hover:text-foreground"
            >
              <ArrowDown size={16} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
      <Composer
        matterId={matterId}
        threadStatus={threadStatus}
        draft={draft}
        onSend={onSend}
        sendError={sendError}
      />
    </main>
  )
}
