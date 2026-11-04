'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { LinkedText } from '@/components/chat/linked-text'
import { Button } from '@/components/ui/button'
import {
  checkedChoiceIds,
  choiceBounds,
  choiceDraft,
  choiceLabel,
  choiceLabels,
  draftChoiceIds,
  initialChoiceDraft,
  type ChoiceDraft,
} from '@/lib/matters/ask-choice'
import type { AskChoiceAnswer, MatterAskChoice } from '@/lib/matters/types'
import { cn } from '@/lib/utils'

/**
 * askChoice card in the centre transcript.
 * Layout adapted from dcolley/tourbillon@7a8595b
 * apps/web/components/assistant/widgets/chat-cards.tsx (ChoiceCard):
 * one question, option rows, and a single Choose action.
 * Once answered, the rows lock to the stored pick. A second submit is ignored.
 * The same lock-while-sending pattern is in hitly-net/hitly@94b2e92
 * apps/app/components/answer-form.tsx (decision buttons stay disabled while pending).
 */
export function AskChoiceCard({
  widget,
  busy = false,
  error = null,
  onAnswer,
}: {
  widget: MatterAskChoice
  busy?: boolean
  error?: string | null
  onAnswer?: (answer: AskChoiceAnswer) => void
}) {
  const [selected, setSelected] = useState<ChoiceDraft>(() => initialChoiceDraft(widget))
  const [localError, setLocalError] = useState<string | undefined>()
  const sent = useRef(false)
  const name = useId()
  const multi = widget.multiSelect
  const open = widget.status === 'pending' && !busy && Boolean(onAnswer)
  const bounds = choiceBounds(widget)
  const chosen = draftChoiceIds(selected)
  const checked = checkedChoiceIds(widget.status, widget.answer, selected)
  const inBounds = multi ? chosen.length >= bounds.min && chosen.length <= bounds.max : chosen.length === 1
  const recommended = widget.recommended ?? []

  useEffect(() => {
    if (widget.status === 'pending' && !busy) sent.current = false
  }, [widget.status, busy])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!open || !onAnswer || sent.current) return
    const draft = choiceDraft(widget, selected)
    if (!draft.ok) {
      setLocalError(draft.errors.choices ?? draft.errors.choice)
      return
    }
    sent.current = true
    setLocalError(undefined)
    onAnswer(draft.answer)
  }

  const answeredText = widget.status !== 'answered' || !widget.answer
    ? undefined
    : 'choices' in widget.answer
      ? `Chosen: ${choiceLabels(widget.options, widget.answer.choices)}`
      : `Chosen: ${choiceLabel(widget.options, widget.answer.choice) ?? widget.answer.choice}`

  return (
    <section
      role="group"
      aria-label={widget.question}
      className="w-full space-y-2 rounded-lg border bg-card p-3 text-sm"
      data-widget={widget.name}
      data-widget-version={widget.version}
      data-widget-status={widget.status}
      data-tool-call-id={widget.toolCallId}
      data-card="choice"
      data-multi={multi ? 'true' : 'false'}
      data-busy={busy ? 'true' : 'false'}
    >
      <p className="font-medium whitespace-pre-wrap">{widget.question}</p>
      {widget.detail ? (
        <p className="whitespace-pre-wrap text-muted-foreground">
          <LinkedText text={widget.detail} />
        </p>
      ) : null}
      <form className="space-y-2" onSubmit={submit}>
        <fieldset className="space-y-1" disabled={!open}>
          <legend className="sr-only">Options</legend>
          {widget.options.map((option) => {
            const isChecked = checked.includes(option.id)
            return (
              <label
                key={option.id}
                className={cn(
                  'flex items-start gap-2 rounded-md border px-2 py-1.5',
                  open ? 'cursor-pointer' : 'cursor-default',
                  isChecked && 'border-primary',
                )}
                data-option={option.id}
                data-recommended={recommended.includes(option.id) ? 'true' : undefined}
                data-selected={isChecked ? 'true' : 'false'}
              >
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name={multi ? `${name}-multi` : name}
                  value={option.id}
                  checked={isChecked}
                  onChange={(event) => {
                    if (!open) return
                    if (multi) {
                      setSelected(event.target.checked ? [...chosen, option.id] : chosen.filter((id) => id !== option.id))
                      return
                    }
                    setSelected(option.id)
                  }}
                  className="mt-0.5"
                />
                <span className="flex flex-col">
                  <span>
                    {option.label}
                    {recommended.includes(option.id) ? (
                      <span className="ml-2 rounded bg-muted px-1.5 text-xs text-muted-foreground">Recommended</span>
                    ) : null}
                  </span>
                  {option.description ? (
                    <span className="text-xs text-muted-foreground">
                      <LinkedText text={option.description} />
                    </span>
                  ) : null}
                </span>
              </label>
            )
          })}
        </fieldset>
        {localError ? (
          <p className="text-xs text-destructive" role="alert">
            {localError}
          </p>
        ) : null}
        {widget.status === 'pending' ? (
          <div className="space-y-1">
            {multi ? (
              <p className="text-xs text-muted-foreground" data-choice-counter>
                {`${chosen.length} of ${bounds.max} selected`}
              </p>
            ) : null}
            <Button type="submit" size="sm" disabled={!open || !inBounds}>
              Choose
            </Button>
          </div>
        ) : null}
        {answeredText ? (
          <p className="text-xs text-muted-foreground" data-card-answer>
            {answeredText}
          </p>
        ) : null}
        {busy && widget.status === 'pending' ? <p className="text-xs text-muted-foreground">Saving your answer.</p> : null}
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  )
}
