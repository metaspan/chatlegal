'use client'

import type { FormEvent, MouseEvent, ReactNode } from 'react'
import { Send } from 'lucide-react'
import { MatterSummary } from '@/components/shell/matter-summary'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { MatterMessage, MatterObservations, MatterThreadStatus } from '@/lib/matters/types'

/**
 * Centre column: the open matter's thread plus a text box.
 * The box matches the composer frame in
 * dcolley/tourbillon@7a8595b apps/web/components/assistant/composer/composer.tsx
 * (bordered field, message label, send row). Send stays off until a model is
 * connected. The draft is kept against the open matter id by the shell.
 */
export function ChatColumn({
  title,
  detail,
  matterId,
  messages,
  draft,
  onDraftChange,
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
  threadStatus?: MatterThreadStatus
  observations?: MatterObservations | null
  children?: ReactNode
}) {
  return (
    <main
      id="chat"
      aria-label="Chat"
      data-pane="chat"
      data-matter-id={matterId ?? ''}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        {children ? <div className="px-4 pt-4 md:px-6">{children}</div> : null}
        <div id="chat-thread" className="flex flex-col gap-3 px-4 py-6 md:px-6">
          <h1 className="font-serif text-xl font-semibold tracking-tight">{title}</h1>
          <p className="max-w-prose text-sm text-muted-foreground">{detail}</p>
          <MatterSummary matterId={matterId} status={matterId ? threadStatus : 'idle'} observations={observations} />
          {messages.length > 0 ? (
            <ol className="flex max-w-prose flex-col gap-3" aria-label="Messages">
              {messages.map((message) => (
                <li key={message.id} data-message-id={message.id} data-message-role={message.role}>
                  <p className="text-xs font-medium text-muted-foreground">{message.role === 'user' ? 'You' : 'ChatLegal'}</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{message.text}</p>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>
      <ChatComposer matterId={matterId} draft={draft} onDraftChange={onDraftChange} />
    </main>
  )
}

function ChatComposer({
  matterId,
  draft,
  onDraftChange,
}: {
  matterId: string | null
  draft: string
  onDraftChange: (text: string) => void
}) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
  }

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
          disabled={!matterId}
          onChange={(event) => {
            if (matterId) onDraftChange(event.target.value)
          }}
          placeholder={matterId ? 'Write a message' : 'Start a new chat to write here'}
          className="max-h-40 min-h-24 w-full resize-none border-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center gap-2">
          <p className="flex-1 text-xs text-muted-foreground">
            {matterId
              ? 'Sending is off until a model is connected. This draft stays with this matter.'
              : 'Sending is off until a model is connected.'}
          </p>
          <Button type="submit" size="sm" disabled>
            <Send />
            Send
          </Button>
        </div>
      </div>
    </form>
  )
}
