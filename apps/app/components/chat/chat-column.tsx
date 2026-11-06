'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Composer } from '@/components/chat/composer/composer'
import type { SendOutcome } from '@/components/chat/composer/composer-controller'
import { MessageList } from '@/components/chat/message-list'
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
 * Attachments, steer, and stop stay out: there is no agent run yet.
 * TODO(G-01 Concierge): emit askChoice from the model after Send stores the
 * user's words. The streamed plain-text reply landed with G-00.
 * A new matter already has a scripted first turn. The model does not emit askChoice yet.
 * The draft is kept against the open matter id.
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
  const scrollerRef = useRef<HTMLDivElement>(null)
  const place = useRef<{ matterId: string; lastId: string } | null>(null)
  const showSummary = threadStatus === 'ready' && Boolean(observations?.summary.trim())
  const lastId = messages.at(-1)?.id ?? ''

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const key = matterId ?? ''
    // Wait until the thread arrives, then show the opening notice rather than the foot of a long first turn.
    if (messages.length === 0 && matterId) return
    const hasUser = messages.some((message) => message.role === 'user')
    const previous = place.current
    place.current = { matterId: key, lastId }
    if (!previous || previous.matterId !== key) {
      el.scrollTop = hasUser ? el.scrollHeight : 0
      return
    }
    if (previous.lastId === lastId) return
    el.scrollTop = el.scrollHeight
  }, [matterId, messages.length, lastId])

  return (
    <main
      id="chat"
      aria-label="Chat"
      data-pane="chat"
      data-matter-id={matterId ?? ''}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
    >
      <div ref={scrollerRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
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
