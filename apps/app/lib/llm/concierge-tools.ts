/**
 * The askChoice card as a model-facing function (G-01).
 *
 * The shape follows the WID-1 frontend tools in dcolley/tourbillon@7a8595b
 * packages/mastra/src/tools/widget-tools.ts: the model calls the widget, the
 * host renders it, and the person's answer comes back later as the tool
 * result. There is no AgentController here, so the loop lives in
 * lib/llm/concierge-agent.ts and this module only describes the card and
 * reads the call back.
 *
 * The parameters mirror askChoiceProps in lib/matters/ask-choice.ts (C-04).
 * The model's arguments are NOT trusted: the host re-validates every call
 * with parseAskChoiceProps, which also runs the credential-text refusal.
 * `widgetVersion` is a reserved host key (C-04) and is not offered to the
 * model; cards stored by the Concierge are always the current version.
 */

import {
  ASK_CHOICE_NAME,
  MatterWidgetError,
  parseAskChoiceProps,
  type AskChoiceProps,
} from '../matters/ask-choice'
import type { ChatToolCall, ChatToolDefinition } from './client'

/** The one tool the Concierge may call. Mirrors askChoiceProps (C-04). */
export function askChoiceToolDefinition(): ChatToolDefinition {
  return {
    name: ASK_CHOICE_NAME,
    description: [
      'Ask the person one structured question and stop. Use it when the answer is one of a short, fixed set of choices',
      '(for example: which part of the UK, what papers they have, whether a date has passed). Write for someone who has',
      'never used a court: plain words, no jargon, no Latin. Never ask for a password, card number, or any secret in a',
      'question or an option. Ask one question per call. Your own words before the call should say, in one short line,',
      'what you understood and what you are asking next. Do not mention this tool, the card, or JSON in your words.',
    ].join(' '),
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['question', 'options'],
      properties: {
        question: {
          type: 'string',
          minLength: 1,
          maxLength: 500,
          description: 'The question in plain British English. One question only.',
        },
        detail: {
          type: 'string',
          maxLength: 1000,
          description: 'Optional one or two sentences of context under the question.',
        },
        options: {
          type: 'array',
          minItems: 2,
          maxItems: 10,
          description: 'The choices the person picks from. Short labels. Two to ten options.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'label'],
            properties: {
              id: {
                type: 'string',
                pattern: '^[A-Za-z0-9_-]{1,64}$',
                description: 'Stable id returned as the answer.',
              },
              label: { type: 'string', minLength: 1, maxLength: 200 },
              description: { type: 'string', maxLength: 300 },
            },
          },
        },
        recommended: {
          description: 'One option id, or a short list of them, marked as the likely pick.',
          anyOf: [
            { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' },
            { type: 'array', minItems: 1, maxItems: 10, items: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' } },
          ],
        },
        defaultOption: {
          type: 'string',
          pattern: '^[A-Za-z0-9_-]{1,64}$',
          description: 'The option preselected on the card.',
        },
        multiSelect: {
          type: 'boolean',
          description: 'True when the person may pick more than one option.',
        },
        minSelected: { type: 'integer', minimum: 0, description: 'Only with multiSelect.' },
        maxSelected: { type: 'integer', minimum: 1, maximum: 10, description: 'Only with multiSelect.' },
      },
    },
  }
}

export type AskChoiceCallRead =
  | { ok: true; props: AskChoiceProps }
  | { ok: false; issues: string[] }

/**
 * The model's arguments for one askChoice call, read with the C-04 gate.
 * Unknown keys, malformed props, and credential-looking text fail here.
 * Nothing is stored on a failure.
 */
export function readAskChoiceCallArgs(call: ChatToolCall): AskChoiceCallRead {
  let parsed: unknown
  try {
    parsed = JSON.parse(call.arguments || '{}') as unknown
  } catch {
    return { ok: false, issues: ['(arguments): not_json'] }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, issues: ['(arguments): not_an_object'] }
  }
  // widgetVersion is a reserved host key. A model that sets it is ignored,
  // not punished: the host stores the current version either way.
  const { widgetVersion: _reserved, ...props } = parsed as Record<string, unknown>
  try {
    return { ok: true, props: parseAskChoiceProps(props) }
  } catch (error) {
    if (error instanceof MatterWidgetError) return { ok: false, issues: error.issues }
    return { ok: false, issues: ['(props): invalid'] }
  }
}

/**
 * What the host tells the model about a card it asked for that never got a
 * real answer (still pending when the thread was replayed). It states the
 * state; it never invents the person's pick.
 */
export function awaitingAnswerToolResult(): string {
  return JSON.stringify({ widget: ASK_CHOICE_NAME, status: 'awaiting_answer' })
}
