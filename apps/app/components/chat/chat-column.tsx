'use client'

import { useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/**
 * Centre column: thread plus a text box.
 * The box matches the composer frame in
 * dcolley/tourbillon@7a8595b apps/web/components/assistant/composer/composer.tsx
 * (bordered field, message label, send row). Send does nothing. There is no
 * chat client, queue, or model call.
 */
export function ChatColumn({
  title,
  detail,
  children,
}: {
  title: string
  detail: string
  children?: ReactNode
}) {
  return (
    <main id="chat" aria-label="Chat" data-pane="chat" className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {children ? <div className="px-4 pt-4 md:px-6">{children}</div> : null}
        <div id="chat-thread" className="flex flex-col gap-2 px-4 py-6 md:px-6">
          <h1 className="font-serif text-xl font-semibold tracking-tight">{title}</h1>
          <p className="max-w-prose text-sm text-muted-foreground">{detail}</p>
        </div>
      </div>
      <ChatComposer />
    </main>
  )
}

function ChatComposer() {
  const [text, setText] = useState('')

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
  }

  return (
    <form className="shrink-0 border-t p-3" onSubmit={onSubmit} data-slot="composer">
      <div
        className="mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-xl border bg-background p-2"
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
          value={text}
          rows={3}
          onChange={(event) => setText(event.target.value)}
          placeholder="Write a message"
          className="max-h-40 min-h-24 w-full resize-none border-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center gap-2">
          <p className="flex-1 text-xs text-muted-foreground">Chat is not connected yet.</p>
          <Button type="submit" size="sm" disabled>
            <Send />
            Send
          </Button>
        </div>
      </div>
    </form>
  )
}
