import { AskChoiceCard } from '@/components/chat/ask-choice-card'
import { toolUseLabel } from '@/lib/matters/present'
import type { AskChoiceAnswer, MatterMessage } from '@/lib/matters/types'
import { cn } from '@/lib/utils'

/**
 * Centre transcript.
 * Row shape adapted from dcolley/tourbillon@7a8595b
 * apps/web/components/assistant/agent-chat.tsx (ItemView): the person's words
 * sit at the end, ChatLegal's words sit at the start.
 * User text uses the raised cream card, not burgundy, so the column stays quiet.
 * Tool rows are a single plain line. The tool-state card in that chat
 * pretty-prints JSON; this pane does not.
 */
export function MessageList({
  messages,
  onAnswerWidget,
  answeringWidgetId = null,
  widgetError = null,
}: {
  messages: readonly MatterMessage[]
  onAnswerWidget?: (toolCallId: string, answer: AskChoiceAnswer) => void
  answeringWidgetId?: string | null
  widgetError?: { toolCallId: string; message: string } | null
}) {
  return (
    <ol className="flex flex-col gap-4" aria-label="Messages">
      {messages.map((message) => {
        const fromYou = message.role === 'user'
        const widget = message.widget
        return (
          <li
            key={message.id}
            data-message-id={message.id}
            data-message-role={message.role}
            data-message-pending={message.pending ? 'true' : 'false'}
            data-item={fromYou ? 'user' : 'assistant'}
            className={cn(
              'flex flex-col gap-1',
              widget ? 'w-full max-w-xl' : 'max-w-[80%]',
              fromYou ? 'self-end items-end' : 'self-start',
            )}
          >
            <p className="sr-only">{fromYou ? 'You' : 'ChatLegal'}</p>
            {message.text ? (
              <div
                className={cn(
                  'text-sm leading-relaxed whitespace-pre-wrap break-words',
                  fromYou ? 'rounded-lg border bg-card px-3 py-2' : 'text-foreground',
                  message.pending && 'opacity-70',
                )}
              >
                {message.text}
              </div>
            ) : null}
            {widget ? (
              <AskChoiceCard
                widget={widget}
                busy={answeringWidgetId === widget.toolCallId}
                error={widgetError?.toolCallId === widget.toolCallId ? widgetError.message : null}
                onAnswer={onAnswerWidget ? (answer) => onAnswerWidget(widget.toolCallId, answer) : undefined}
              />
            ) : null}
            {message.tools?.map((tool) => (
              <p key={tool.name} data-tool-use={tool.name} className="text-xs text-muted-foreground">
                {toolUseLabel(tool.name)}
              </p>
            ))}
          </li>
        )
      })}
    </ol>
  )
}
