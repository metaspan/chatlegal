/**
 * askChoice cards for the centre transcript.
 * Props, answer, and the check that a pick is one of the offered options are
 * adapted from dcolley/tourbillon@7a8595b
 * apps/web/components/assistant/widgets/chat-card-specs.ts and chat-card-drafts.ts.
 * The browser checks the pick before it leaves the card. The matter route
 * checks it again, and a second pick is refused. That second check follows
 * the submit gate in hitly-net/hitly@94b2e92
 * apps/app/components/answer-form.tsx (controls lock while the answer is in
 * flight; the host validates the submission).
 * TODO(G-01 Concierge): emit this tool from the model and resume the run with
 * the stored result `{ widget, version, answer }`. This module does not call a model.
 */
import { z } from 'zod'
import type { AskChoiceAnswer, AskChoiceOption, MatterAskChoice } from './types'

export const ASK_CHOICE_NAME = 'askChoice'
export const ASK_CHOICE_VERSION = 2 as const

const OPTION_ID = /^[A-Za-z0-9_-]{1,64}$/
const optionId = z.string().regex(OPTION_ID)
const text = (max: number) => z.string().trim().min(1).max(max)
const optionalText = (max: number) => z.string().trim().max(max).optional()

const CONFUSABLE: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x',
  і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ԝ: 'w',
  α: 'a', β: 'b', ε: 'e', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x', ω: 'w',
}

const CREDENTIAL_WORDS = new Set([
  'password', 'passwords', 'passwd', 'pwd', 'pw', 'passphrase', 'passcode', 'passcodes',
  'credential', 'credentials', 'creds', 'otp', 'totp', 'hotp', 'mfa', '2fa', 'pincode',
  'cvv', 'cvv2', 'cvc', 'cvc2', 'apikey', 'accesskey', 'secretkey', 'privatekey', 'accesstoken', 'authtoken',
])
const CREDENTIAL_WORDS_SHORT = new Set([
  'secret', 'secrets', 'token', 'tokens', 'cookie', 'cookies', 'pin', 'pins', 'authorization', 'authorisation',
])
const CREDENTIAL_PAIRS = new Set([
  'api key', 'access key', 'secret key', 'private key', 'access token', 'auth token', 'bearer token',
  'refresh token', 'auth code', 'mfa code', 'security code', 'verification code', 'login code', 'one time',
  'pin code', 'recovery code', 'backup code', 'seed phrase', 'recovery phrase', 'pass phrase', 'pass code',
])
const CREDENTIAL_STEMS = /(password|passwd|passphrase|passcode|apikey|privatekey|accesskey|secretkey|accesstoken|credential|pincode)/
const CREDENTIAL_STEMS_SHORT = /authori[sz]/

export class MatterWidgetError extends Error {
  readonly issues: string[]

  constructor(message: string, issues: string[] = []) {
    super(message)
    this.name = 'MatterWidgetError'
    this.issues = issues
  }
}

function credentialWords(value: string): string[] {
  const spaced = value
    .normalize('NFKC')
    .replace(/[\u00ad\u200b-\u200f\u2060\ufeff]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
  const latin = Array.from(spaced, (char) => CONFUSABLE[char] ?? char).join('')
  return latin.split(/[^a-z0-9]+/).filter(Boolean)
}

/** True when text looks like it is asking for a secret. Prose allows bare words such as "token". */
export function isCredentialLike(value: string | undefined, prose = false): boolean {
  if (!value) return false
  const words = credentialWords(value)
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i] ?? ''
    if (CREDENTIAL_WORDS.has(word) || CREDENTIAL_STEMS.test(word)) return true
    if (!prose && (CREDENTIAL_WORDS_SHORT.has(word) || CREDENTIAL_STEMS_SHORT.test(word))) return true
    if (i + 1 < words.length && CREDENTIAL_PAIRS.has(`${word} ${words[i + 1]}`)) return true
  }
  return false
}

function refuseCredential(
  ctx: z.RefinementCtx,
  texts: Array<[Array<string | number>, string | undefined, boolean]>,
) {
  for (const [path, value, prose] of texts) {
    if (isCredentialLike(value, prose)) ctx.addIssue({ code: 'custom', path, message: 'credential_text' })
  }
}

const optionSchema = z.strictObject({
  id: optionId.describe('Stable id returned as the answer.'),
  label: text(200),
  description: optionalText(300),
})

const recommendedIds = z.union([optionId, z.array(optionId).min(1).max(10)])

export const askChoiceProps = z
  .strictObject({
    question: text(500),
    detail: optionalText(1000),
    options: z.array(optionSchema).min(2).max(10),
    recommended: recommendedIds.optional(),
    defaultOption: optionId.optional(),
    multiSelect: z.boolean().optional(),
    minSelected: z.number().int().min(0).optional(),
    maxSelected: z.number().int().min(1).max(10).optional(),
  })
  .superRefine((props, ctx) => {
    const ids = props.options.map((option) => option.id)
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'duplicate_id' })
    const recommended = props.recommended === undefined ? [] : Array.isArray(props.recommended) ? props.recommended : [props.recommended]
    for (const id of recommended) {
      if (!ids.includes(id)) ctx.addIssue({ code: 'custom', path: ['recommended'], message: 'not_an_option' })
    }
    if (props.defaultOption !== undefined && !ids.includes(props.defaultOption)) {
      ctx.addIssue({ code: 'custom', path: ['defaultOption'], message: 'not_an_option' })
    }
    if (props.multiSelect !== true && (props.minSelected !== undefined || props.maxSelected !== undefined)) {
      ctx.addIssue({ code: 'custom', path: ['multiSelect'], message: 'multi_select_only' })
    }
    if (props.multiSelect === true) {
      const max = props.maxSelected ?? ids.length
      const min = props.minSelected ?? 1
      if (min > max) ctx.addIssue({ code: 'custom', path: ['minSelected'], message: 'min_above_max' })
      if (max > ids.length) ctx.addIssue({ code: 'custom', path: ['maxSelected'], message: 'max_above_options' })
    }
    refuseCredential(ctx, [
      [['question'], props.question, true],
      ...props.options.map((option, index): [Array<string | number>, string, boolean] => [['options', index, 'label'], option.label, false]),
    ])
  })

export type AskChoiceProps = z.infer<typeof askChoiceProps>

export const askChoiceAnswer = z.union([
  z.strictObject({ choice: optionId }),
  z.strictObject({ choices: z.array(optionId).max(10) }),
])

type ChoiceShape = {
  multiSelect?: boolean
  minSelected?: number
  maxSelected?: number
  options: readonly { id: string; label: string }[]
  defaultOption?: string
}

export function choiceBounds(props: ChoiceShape): { min: number; max: number } {
  return { min: props.minSelected ?? 1, max: props.maxSelected ?? props.options.length }
}

/** A choice must be one of the offered options. Multi-select also has to fit the bounds. */
export function checkChoiceAnswer(props: ChoiceShape, answer: AskChoiceAnswer): string[] {
  const ids = props.options.map((option) => option.id)
  if (props.multiSelect === true) {
    if (!('choices' in answer)) return ['choices: invalid_type']
    const chosen = answer.choices
    const issues: string[] = []
    if (new Set(chosen).size !== chosen.length) issues.push('choices: duplicate_id')
    if (chosen.some((id) => !ids.includes(id))) issues.push('choices: not_an_option')
    const { min, max } = choiceBounds(props)
    if (chosen.length < min) issues.push('choices: too_few')
    if (chosen.length > max) issues.push('choices: too_many')
    return issues
  }
  if ('choices' in answer) return ['choices: multi_only']
  return ids.includes(answer.choice) ? [] : ['choice: not_an_option']
}

export type ChoiceDraft = string | string[] | undefined

export type ChoiceDraftResult =
  | { ok: true; answer: AskChoiceAnswer }
  | { ok: false; errors: { choice?: string; choices?: string } }

export function initialChoiceDraft(props: ChoiceShape): ChoiceDraft {
  return props.multiSelect === true ? [] : props.defaultOption
}

export function choiceDraft(props: ChoiceShape, selected: ChoiceDraft): ChoiceDraftResult {
  const ids = props.options.map((option) => option.id)
  if (props.multiSelect === true) {
    const chosen = Array.isArray(selected) ? Array.from(new Set(selected)) : selected === undefined ? [] : [selected]
    const { min, max } = choiceBounds(props)
    if (chosen.length < min) {
      return { ok: false, errors: { choices: `Choose at least ${min} option${min === 1 ? '' : 's'}.` } }
    }
    if (chosen.length > max) return { ok: false, errors: { choices: `Choose at most ${max} options.` } }
    if (chosen.some((id) => !ids.includes(id))) return { ok: false, errors: { choices: 'Pick options from the list.' } }
    return { ok: true, answer: { choices: chosen } }
  }
  const single = Array.isArray(selected) ? selected[0] : selected
  if (single === undefined || !ids.includes(single)) return { ok: false, errors: { choice: 'Pick one option.' } }
  return { ok: true, answer: { choice: single } }
}

export function draftChoiceIds(selected: ChoiceDraft): string[] {
  return Array.isArray(selected) ? selected : selected === undefined ? [] : [selected]
}

export function checkedChoiceIds(status: string, answer: AskChoiceAnswer | undefined, selected: ChoiceDraft): string[] {
  if (status === 'answered') {
    if (!answer) return []
    if ('choices' in answer) return [...answer.choices]
    if ('choice' in answer) return [answer.choice]
    return []
  }
  return draftChoiceIds(selected)
}

export function choiceLabel(options: readonly { id: string; label: string }[], choice: string | undefined): string | undefined {
  return options.find((option) => option.id === choice)?.label
}

export function choiceLabels(options: readonly { id: string; label: string }[], choices: readonly string[] | undefined): string {
  return (choices ?? []).map((id) => options.find((option) => option.id === id)?.label ?? id).join(', ')
}

function issuePaths(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.map(String).join('.') : '(root)'
    const code = issue.code === 'custom' && issue.message ? issue.message : issue.code
    return `${path}: ${code}`
  })
}

export function parseAskChoiceProps(value: unknown): AskChoiceProps {
  const parsed = askChoiceProps.safeParse(value)
  if (!parsed.success) throw new MatterWidgetError('That question is not valid.', issuePaths(parsed.error))
  return parsed.data
}

export function parseJsonObject(raw: string, tooLarge = 'That request is too large.'): unknown {
  if (raw.length > 16_000) throw new MatterWidgetError(tooLarge)
  let body: unknown
  try {
    body = JSON.parse(raw) as unknown
  } catch {
    throw new MatterWidgetError('The request must be JSON.')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new MatterWidgetError('The request must be a JSON object.')
  }
  return body
}

export function acceptChoiceAnswer(
  props: ChoiceShape,
  answer: unknown,
): { ok: true; answer: AskChoiceAnswer } | { ok: false; issues: string[] } {
  const parsed = askChoiceAnswer.safeParse(answer)
  if (!parsed.success) return { ok: false, issues: issuePaths(parsed.error) }
  const issues = checkChoiceAnswer(props, parsed.data)
  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, answer: parsed.data }
}

function cleanOption(option: AskChoiceProps['options'][number]): AskChoiceOption {
  const description = option.description?.trim()
  return {
    id: option.id,
    label: option.label,
    ...(description ? { description } : {}),
  }
}

function recommendedList(value: AskChoiceProps['recommended']): string[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/** The card the centre pane renders. Unknown props are dropped. */
export function presentAskChoice(input: {
  toolCallId: string
  version: number
  props: AskChoiceProps
  status: MatterAskChoice['status']
  answer?: AskChoiceAnswer
  answeredAt?: string
}): MatterAskChoice {
  const version = input.version === 1 ? 1 : ASK_CHOICE_VERSION
  const multiSelect = input.props.multiSelect === true
  const bounds = choiceBounds(input.props)
  const recommended = recommendedList(input.props.recommended)
  const detail = input.props.detail?.trim()
  return {
    toolCallId: input.toolCallId,
    name: ASK_CHOICE_NAME,
    version,
    question: input.props.question,
    ...(detail ? { detail } : {}),
    options: input.props.options.map(cleanOption),
    multiSelect,
    minSelected: multiSelect ? bounds.min : 1,
    maxSelected: multiSelect ? bounds.max : 1,
    ...(recommended.length > 0 ? { recommended } : {}),
    ...(input.props.defaultOption ? { defaultOption: input.props.defaultOption } : {}),
    status: input.status,
    ...(input.answer ? { answer: input.answer } : {}),
    ...(input.answeredAt ? { answeredAt: input.answeredAt } : {}),
  }
}

const matterAskChoiceSchema = z
  .strictObject({
    toolCallId: z.string().min(1).max(200),
    name: z.literal(ASK_CHOICE_NAME),
    version: z.union([z.literal(1), z.literal(2)]),
    question: z.string().min(1).max(500),
    detail: z.string().max(1000).optional(),
    options: z.array(z.strictObject({
      id: optionId,
      label: z.string().min(1).max(200),
      description: z.string().max(300).optional(),
    })).min(2).max(10),
    multiSelect: z.boolean(),
    minSelected: z.number().int().min(0).max(10),
    maxSelected: z.number().int().min(1).max(10),
    recommended: z.array(optionId).max(10).optional(),
    defaultOption: optionId.optional(),
    status: z.enum(['pending', 'answered']),
    answer: askChoiceAnswer.optional(),
    answeredAt: z.string().optional(),
  })
  .superRefine((widget, ctx) => {
    if (widget.status === 'answered' && !widget.answer) {
      ctx.addIssue({ code: 'custom', path: ['answer'], message: 'required' })
    }
    if (widget.status === 'pending' && widget.answer) {
      ctx.addIssue({ code: 'custom', path: ['answer'], message: 'pending' })
    }
    if (widget.answer) {
      for (const issue of checkChoiceAnswer(widget, widget.answer)) {
        ctx.addIssue({ code: 'custom', path: ['answer'], message: issue })
      }
    }
  })

export function isMatterAskChoice(value: unknown): value is MatterAskChoice {
  return matterAskChoiceSchema.safeParse(value).success
}

export function canonicalAskChoice(value: unknown): MatterAskChoice | undefined {
  const parsed = matterAskChoiceSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

type StoredContent = {
  parts?: unknown[]
  toolInvocations?: unknown[]
} | null | undefined

type StoredInvocation = {
  state?: unknown
  toolCallId?: unknown
  toolName?: unknown
  args?: unknown
  result?: unknown
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readArgs(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value) as unknown)
    } catch {
      return null
    }
  }
  return asRecord(value)
}

export type StoredAskChoiceCall = {
  toolCallId: string
  state: string
  version: 1 | 2
  props: AskChoiceProps
  answer?: AskChoiceAnswer
  answeredAt?: string
}

function readCall(invocation: StoredInvocation, updatedAt: unknown): StoredAskChoiceCall | null {
  if (invocation.toolName !== ASK_CHOICE_NAME) return null
  if (typeof invocation.toolCallId !== 'string' || !invocation.toolCallId.trim()) return null
  const args = readArgs(invocation.args)
  if (!args) return null
  const { widgetVersion, ...props } = args
  const version = widgetVersion === undefined ? 1 : widgetVersion
  if (version !== 1 && version !== 2) return null
  const parsedProps = askChoiceProps.safeParse(props)
  if (!parsedProps.success) return null
  const state = typeof invocation.state === 'string' ? invocation.state : 'call'
  let answer: AskChoiceAnswer | undefined
  if (state === 'result') {
    const result = readArgs(invocation.result)
    const parsedAnswer = askChoiceAnswer.safeParse(result?.answer)
    if (!parsedAnswer.success) return null
    if (result?.widget !== undefined && result.widget !== ASK_CHOICE_NAME) return null
    answer = parsedAnswer.data
    if (checkChoiceAnswer(parsedProps.data, answer).length > 0) return null
  }
  const answeredAt = typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? new Date(updatedAt).toISOString() : undefined
  return {
    toolCallId: invocation.toolCallId,
    state,
    version,
    props: parsedProps.data,
    ...(answer ? { answer } : {}),
    ...(answeredAt ? { answeredAt } : {}),
  }
}

/** True when this message carries an askChoice tool call, even if the props are unreadable. */
export function messageHasAskChoice(content: StoredContent, toolCallId?: string): boolean {
  for (const part of content?.parts ?? []) {
    const record = asRecord(part)
    if (!record || record.type !== 'tool-invocation') continue
    const invocation = asRecord(record.toolInvocation)
    if (!invocation || invocation.toolName !== ASK_CHOICE_NAME) continue
    if (toolCallId === undefined) return true
    if (invocation.toolCallId === toolCallId) return true
  }
  return false
}

/** The askChoice tool call on a stored Mastra message, if the props are valid. */
export function readStoredAskChoice(content: StoredContent): StoredAskChoiceCall | null {
  for (const part of content?.parts ?? []) {
    const record = asRecord(part)
    if (!record || record.type !== 'tool-invocation') continue
    const invocation = asRecord(record.toolInvocation)
    if (!invocation) continue
    const call = readCall(invocation, record.updatedAt)
    if (call) return call
  }
  return null
}

export function readMatterAskChoice(content: StoredContent): MatterAskChoice | null {
  const call = readStoredAskChoice(content)
  if (!call) return null
  const status = call.state === 'result' && call.answer ? 'answered' : 'pending'
  return presentAskChoice({
    toolCallId: call.toolCallId,
    version: call.version,
    props: call.props,
    status,
    ...(status === 'answered' && call.answer ? { answer: call.answer, answeredAt: call.answeredAt } : {}),
  })
}

/** Args stored on the tool call. `widgetVersion` is the reserved version key. */
export function askChoiceToolArgs(props: AskChoiceProps, version: 1 | 2 = ASK_CHOICE_VERSION): Record<string, unknown> {
  return {
    widgetVersion: version,
    question: props.question,
    ...(props.detail?.trim() ? { detail: props.detail.trim() } : {}),
    options: props.options.map(cleanOption),
    ...(props.recommended !== undefined ? { recommended: props.recommended } : {}),
    ...(props.defaultOption ? { defaultOption: props.defaultOption } : {}),
    ...(props.multiSelect === true ? { multiSelect: true } : {}),
    ...(props.minSelected !== undefined ? { minSelected: props.minSelected } : {}),
    ...(props.maxSelected !== undefined ? { maxSelected: props.maxSelected } : {}),
  }
}

/** Tool result handed back to a future run. Values stay; the model is not called here. */
export function askChoiceToolResult(version: number, answer: AskChoiceAnswer): { widget: 'askChoice'; version: number; answer: AskChoiceAnswer } {
  return { widget: ASK_CHOICE_NAME, version, answer }
}
