'use client'

/**
 * Centre-pane composer.
 * Frame adapted from dcolley/tourbillon@7a8595b
 * apps/web/components/assistant/composer/composer.tsx (bordered field, queue list, send row).
 * The queue there is follow-ups while a run is open. Here it is text that has not
 * been stored yet, with a quiet retry when the connection drops. Attachments, steer,
 * and stop are not copied.
 * The send row names the default class for Basic, in the place a model control would sit.
 * That label is not a menu.
 */

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type MouseEvent } from 'react'
import { Pencil, RotateCw, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { defaultModelClass, modelClassAffordance } from '@/lib/model-class'
import type { MatterThreadStatus } from '@/lib/matters/types'
import {
  createComposerController,
  type ComposerController,
  type ComposerState,
  type SendOutcome,
} from './composer-controller'
import type { QueuedState } from './queue'

type SendResult = Promise<SendOutcome | boolean | void> | SendOutcome | boolean | void

export function Composer({
  matterId,
  threadStatus,
  draft = '',
  onSend,
  sendError = null,
  controller: injected,
}: {
  matterId: string | null
  threadStatus: MatterThreadStatus
  /** Text already kept for this matter. Used on the first paint; a stored draft replaces it after mount. */
  draft?: string
  onSend?: (text: string, matterId: string) => SendResult
  sendError?: string | null
  /** Tests can pass a controller that already has a queue. */
  controller?: ComposerController
}) {
  const onSendRef = useRef(onSend)
  onSendRef.current = onSend
  const [controller] = useState(
    () =>
      injected ??
      createComposerController({
        controls: {
          send: (text, id) => onSendRef.current?.(text, id) ?? { ok: false, reason: 'failed' },
        },
        matterId,
        initialText: draft,
        ready: threadStatus === 'ready' && Boolean(matterId),
      }),
  )

  useEffect(() => {
    controller.setControls({
      send: (text, id) => onSendRef.current?.(text, id) ?? { ok: false, reason: 'failed' },
    })
  }, [controller])

  useEffect(() => {
    controller.syncMatter(matterId)
  }, [controller, matterId])

  useEffect(() => {
    controller.setReady(threadStatus === 'ready' && Boolean(matterId))
  }, [controller, matterId, threadStatus])

  useEffect(() => {
    function online() {
      controller.setConnection('online')
    }
    function offline() {
      controller.setConnection('offline')
    }
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) controller.setConnection('offline')
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [controller])

  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  return (
    <ComposerView
      state={state}
      controller={controller}
      threadStatus={threadStatus}
      sendError={sendError}
    />
  )
}

function queueLabel(state: QueuedState): string {
  if (state === 'sending') return 'Sending'
  if (state === 'failed') return 'Not saved yet'
  return 'Waiting'
}

function hint(state: ComposerState, threadStatus: MatterThreadStatus): string {
  if (!state.matterId) return 'Start a new chat to write here.'
  if (threadStatus === 'loading') return 'Opening this matter.'
  if (state.connection === 'offline') return "You're offline. This stays here and sends when the connection returns."
  if (state.submitting && state.connection === 'online') return 'Saving this message.'
  if (state.submitting) return 'Sending again…'
  if (state.connection === 'reconnecting' || state.queue.some((item) => item.state === 'failed')) {
    return 'Not saved yet. It will send when the connection returns.'
  }
  if (state.queue.length > 0) return 'Waiting to send.'
  return 'Enter sends. Shift and Enter starts a new line. This stays with this matter.'
}

export function ComposerView({
  state,
  controller,
  threadStatus,
  sendError = null,
}: {
  state: ComposerState
  controller: ComposerController | null
  threadStatus: MatterThreadStatus
  sendError?: string | null
}) {
  const off = !controller || !state.matterId || threadStatus === 'loading' || threadStatus === 'error'
  const canSend = !off && state.ready && state.text.trim().length > 0 && !state.submitting
  const needsRetry =
    state.queue.some((item) => item.state === 'failed') ||
    ((state.connection === 'offline' || state.connection === 'reconnecting') && state.queue.length > 0)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSend) return
    void controller?.primary()
  }

  return (
    <form
      className="shrink-0 border-t p-3"
      onSubmit={onSubmit}
      data-slot="composer"
      data-draft-matter-id={state.matterId ?? ''}
      data-connection={state.connection}
      data-queue-count={state.queue.length}
    >
      <div
        className="mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-xl border bg-card p-2"
        onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
          const target = event.target as HTMLElement
          if (target.closest('button, textarea, a, input')) return
          event.preventDefault()
          event.currentTarget.querySelector('textarea')?.focus()
        }}
      >
        {state.queue.length > 0 ? (
          <ol data-slot="composer-queue" aria-label="Waiting to send" className="flex flex-col gap-1">
            {state.queue.map((item, index) => {
              const editing = state.editing?.id === item.id
              return (
                <li
                  key={item.id}
                  data-queue-id={item.id}
                  data-queue-state={item.state}
                  className="flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-chrome bg-accent/60 px-2 py-1.5 text-sm"
                >
                  <span className="mt-0.5 text-xs text-muted-foreground">{index + 1}.</span>
                  {editing ? (
                    <Textarea
                      aria-label="Edit waiting message"
                      value={state.editing?.text ?? ''}
                      onChange={(event) => controller?.setEditText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                          event.preventDefault()
                          controller?.saveEdit()
                        } else if (event.key === 'Escape') controller?.cancelEdit()
                      }}
                      className="min-h-8 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
                    />
                  ) : (
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">{queueLabel(item.state)}</span>
                      <span className="whitespace-pre-wrap break-words">{item.text}</span>
                    </span>
                  )}
                  {editing ? (
                    <>
                      <Button type="button" size="xs" variant="secondary" onClick={() => controller?.saveEdit()}>
                        Save
                      </Button>
                      <Button type="button" size="xs" variant="ghost" onClick={() => controller?.cancelEdit()}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Edit waiting message"
                      disabled={off || item.state === 'sending'}
                      onClick={() => controller?.startEdit(item.id)}
                    >
                      <Pencil />
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Remove waiting message"
                    disabled={off || item.state === 'sending'}
                    onClick={() => controller?.removeQueued(item.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              )
            })}
            {needsRetry ? (
              <li>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={off || state.submitting}
                  onClick={() => void controller?.retry()}
                >
                  <RotateCw />
                  Try again
                </Button>
              </li>
            ) : null}
          </ol>
        ) : null}

        {state.notices.length > 0 ? (
          <ul data-slot="composer-notices" className="flex flex-col gap-1">
            {state.notices.map((notice, index) => (
              <li
                key={`${index}-${notice.message}`}
                role="status"
                className="flex items-start gap-2 rounded-md bg-accent px-2 py-1 text-xs text-foreground"
              >
                <span className="flex-1">{notice.message}</span>
                <Button type="button" size="xs" variant="ghost" aria-label="Dismiss" onClick={() => controller?.dismissNotice(index)}>
                  Dismiss
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <label className="sr-only" htmlFor="chat-draft">
          Message
        </label>
        <Textarea
          id="chat-draft"
          value={state.text}
          rows={3}
          disabled={off}
          onChange={(event) => controller?.setText(event.target.value)}
          onKeyDown={(event) => {
            controller?.handleKeyDown({
              key: event.key,
              shiftKey: event.shiftKey,
              metaKey: event.metaKey,
              ctrlKey: event.ctrlKey,
              altKey: event.altKey,
              isComposing: event.nativeEvent.isComposing,
              preventDefault: () => event.preventDefault(),
            })
          }}
          placeholder={state.matterId ? 'Write what has happened' : 'Start a new chat to write here'}
          className="max-h-40 min-h-16 w-full resize-none border-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex flex-wrap items-center gap-2">
          <p
            data-slot="model-class"
            data-model-class={defaultModelClass.id}
            data-model-id={defaultModelClass.modelId}
            className="shrink-0 rounded-md border border-border bg-background px-1.5 py-0.5 text-xs text-muted-foreground"
          >
            <span className="sr-only">Model class </span>
            {modelClassAffordance()}
          </p>
          <p className="min-w-0 flex-1 text-xs text-muted-foreground" aria-live="polite">
            {hint(state, threadStatus)}
          </p>
          <Button type="submit" size="sm" disabled={!canSend} aria-busy={state.submitting}>
            <Send />
            Send
          </Button>
        </div>
        {sendError ? (
          <p role="status" className="text-xs text-muted-foreground">
            {sendError}
          </p>
        ) : null}
      </div>
    </form>
  )
}
