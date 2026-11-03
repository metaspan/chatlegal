'use client'

import { useEffect, useRef, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { Plus, Send } from 'lucide-react'
import { MessageList } from '@/components/chat/message-list'
import { MatterSummary } from '@/components/shell/matter-summary'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { composerSendsOnEnter } from '@/lib/chat-composer'
import type { AskChoiceAnswer, MatterMessage, MatterObservations, MatterThreadStatus } from '@/lib/matters/types'

/**
 * Centre column: the open matter's messages and a text box.
 * The box matches the composer frame in
 * dcolley/tourbillon@7a8595b apps/web/components/assistant/composer/composer.tsx
 * (bordered field, message label, send row). Attachments, queue, steer, and
 * stop stay out: there is no model run yet.
 * TODO(G-01 Concierge): stream the assistant reply after Send stores the user's words.
 * An askChoice card already stored on the matter renders here. The model does not emit one yet.
 * The draft is kept against the open matter id by the shell.
 */
export function ChatColumn({
  title,
  detail,
  matterId,
  messages,
  draft,
  onDraftChange,
  onSend,
  onAnswerWidget,
  answeringWidgetId = null,
  widgetError = null,
  onNewChat,
  creating = false,
  sending = false,
  sendError = null,
  threadStatus = 'idle',
  observations = null,
  children,
}: {
  title: string
  detail: string
  matterId: string | null
  messages: readonly MatterMessage[]
  draft: string
  onDraftChange: (text: string) => void
  onSend?: (text: string) => Promise<boolean> | boolean
  onAnswerWidget?: (toolCallId: string, answer: AskChoiceAnswer) => void
  answeringWidgetId?: string | null
  widgetError?: { toolCallId: string; message: string } | null
  onNewChat?: () => void
  creating?: boolean
  sending?: boolean
  sendError?: string | null
  threadStatus?: MatterThreadStatus
  observations?: MatterObservations | null
  children?: ReactNode
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const showSummary = threadStatus === 'ready' && Boolean(observations?.summary.trim())
  const lastId = messages.at(-1)?.id ?? ''

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
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
      <ChatComposer
        matterId={matterId}
        draft={draft}
        onDraftChange={onDraftChange}
        onSend={onSend}
        sending={sending}
        sendError={sendError}
        threadStatus={threadStatus}
      />
    </main>
  )
}

function ChatComposer({
  matterId,
  draft,
  onDraftChange,
  onSend,
  sending,
  sendError,
  threadStatus,
}: {
  matterId: string | null
  draft: string
  onDraftChange: (text: string) => void
  onSend?: (text: string) => Promise<boolean> | boolean
  sending: boolean
  sendError: string | null
  threadStatus: MatterThreadStatus
}) {
  const canSend = Boolean(matterId && threadStatus === 'ready' && draft.trim() && !sending && onSend)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSend || !onSend) return
    void onSend(draft)
  }

  const hint = !matterId
    ? 'Start a new chat to write here.'
    : threadStatus === 'loading'
      ? 'Opening this matter.'
      : sending
        ? 'Saving this message.'
        : 'Enter sends. Shift and Enter starts a new line. This stays with this matter.'

  return (
    <form className="shrink-0 border-t p-3" onSubmit={onSubmit} data-slot="composer" data-draft-matter-id={matterId ?? ''}>
      <div
        className="mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-xl border bg-card p-2"
        onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
          const target = event.target as HTMLElement
          if (target.closest('button, textarea, a, input')) return
          event.preventDefault()
          event.currentTarget.querySelector('textarea')?.focus()
        }}
      >
        <label className="sr-only" htmlFor="chat-draft">
          Message
        </label>
        <Textarea
          id="chat-draft"
          key={matterId ?? 'no-matter'}
          value={draft}
          rows={3}
          disabled={!matterId || threadStatus === 'loading' || threadStatus === 'error'}
          onChange={(event) => {
            if (matterId) onDraftChange(event.target.value)
          }}
          onKeyDown={(event) => {
            if (
              !composerSendsOnEnter({
                key: event.key,
                shiftKey: event.shiftKey,
                metaKey: event.metaKey,
                ctrlKey: event.ctrlKey,
                altKey: event.altKey,
                isComposing: event.nativeEvent.isComposing,
              })
            ) {
              return
            }
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }}
          placeholder={matterId ? 'Write what has happened' : 'Start a new chat to write here'}
          className="max-h-40 min-h-16 w-full resize-none border-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center gap-2">
          <p className="flex-1 text-xs text-muted-foreground">{hint}</p>
          <Button type="submit" size="sm" disabled={!canSend} aria-busy={sending}>
            <Send />
            Send
          </Button>
        </div>
        {sendError ? (
          <p role="alert" className="text-xs text-destructive">
            {sendError}
          </p>
        ) : null}
      </div>
    </form>
  )
}
