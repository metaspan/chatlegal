import { toolUseLabel } from '@/lib/matters/present'
import type { MatterMessage } from '@/lib/matters/types'
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
export function MessageList({ messages }: { messages: readonly MatterMessage[] }) {
  return (
    <ol className="flex flex-col gap-4" aria-label="Messages">
      {messages.map((message) => {
        const fromYou = message.role === 'user'
        return (
          <li
            key={message.id}
            data-message-id={message.id}
            data-message-role={message.role}
            data-message-pending={message.pending ? 'true' : 'false'}
            data-item={fromYou ? 'user' : 'assistant'}
            className={cn('flex max-w-[80%] flex-col gap-1', fromYou ? 'self-end items-end' : 'self-start')}
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
