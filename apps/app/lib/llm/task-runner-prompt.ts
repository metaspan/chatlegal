/**
 * The G-02 TaskRunner: its own voice, and the handoff contract the
 * Concierge follows around it.
 *
 * Two voices live here and they never cross:
 * - TASK_RUNNER_SYSTEM_PROMPT is the background worker. It is never shown
 *   to a person: its output is one plain-language summary the Concierge
 *   narrates. The no-advice, plain-British-English voice is the same
 *   policy-locked ground as the Concierge (lib/llm/concierge-prompt.ts,
 *   docs/policies/01-code-of-ethics.md): not a solicitor, never invents a
 *   case, a statute, a fee, or a deadline.
 * - CONCIERGE_TASKRUNNER_PROMPT is the G-01 agent contract plus the
 *   handoff rules. It is used ONLY when the TaskRunner is on, so an off
 *   gate keeps the exact G-01 prompt byte for byte.
 *
 * The task-result block adapts the reactive-signal form of
 * dcolley/tourbillon@7a8595b packages/mastra/src/concierge-signal.ts:
 * finished background work reaches the parent chat as tagged XML context
 * (`<task-result …>…</task-result>`), never as a fake user message and
 * never as a tool transcript, and routine progress waits for the next turn
 * rather than interrupting the current one (the same product lock: queued
 * for the next turn, not a mid-token interrupt). The attribute and content
 * limits (120 / 500) are that file's CONCIERGE_ATTRIBUTE_VALUE_LIMIT and
 * CONCIERGE_CONTENTS_LIMIT.
 */

import { CONCIERGE_AGENT_PROMPT } from './concierge-prompt'

/** Tag name the Concierge sees on finished background task results. */
export const TASK_RESULT_TAG_NAME = 'task-result'

/** Keep the model-side attribute bag small and printable (concierge-signal.ts limits). */
export const TASK_ATTRIBUTE_VALUE_LIMIT = 120
export const TASK_CONTENTS_LIMIT = 500

/** One finished job as the Concierge sees it: a result, not a transcript. */
export type TaskResultContext = {
  id: string
  title: string
  status: 'done' | 'failed'
  summary: string
}

/**
 * The TaskRunner's own system prompt. It never talks to a person: it works
 * the brief and answers with one plain-language summary the Concierge can
 * read out. Stub tools are named plainly and marked as examples; the full
 * tool bus is G-03.
 */
export const TASK_RUNNER_SYSTEM_PROMPT = [
  'You are the ChatLegal background assistant. The concierge hands you one job at a time: work it, then answer with a plain-language summary.',
  '',
  'You are not a solicitor and you do not give legal advice. Your summary is information the concierge will read out in its own words, not advice.',
  '',
  'Rules:',
  '- Work the brief. Use a tool when it genuinely helps; do not use one just to be seen using one.',
  '- The tools you have are a small starter set: echo (repeat text back), timed_noop (pause briefly), and count_words (count the words in some text). They exist to prove the handoff works; real tools come later. Never claim to have read files, searched the web, contacted anyone, or checked an official source.',
  '- Answer with the summary only: short sentences, plain British English, no jargon, no Latin unless you explain the word in the same sentence.',
  '- Never invent a case, a statute, a fee, or a deadline. Say what you are confident about and what you are not.',
  '- Never mention the tools, JSON, option ids, or how the software works. The summary must read well when the concierge says it out loud.',
  '- Never ask a question. The concierge owns the conversation; you only report back.',
].join('\n')

/**
 * The G-02 handoff contract, appended to the G-01 agent contract only when
 * the TaskRunner is on. Keep it minimal: the G-00 voice and the G-01
 * contract above it are policy-locked.
 */
export const TASK_RUNNER_CONCIERGE_RULES = [
  '',
  'Background work:',
  '- When the answer needs work that takes real effort (going through what the person has told you, laying out the steps, checking dates against each other), call hand_off_to_task_runner with a short, self-contained brief. The person must never see the machinery: the work happens out of sight.',
  '- A finished job comes back to you as a plain-language summary. Say it back in your own words as your next line. Never quote it word for word, never paste structured text, never mention the tool or a task id.',
  '- If the job is not finished yet, the result says accepted: tell the person plainly you are looking into it and will report back, then carry on with the turn.',
  '- A task-result block below the conversation is finished background work nobody has reported yet. Open by speaking to its result in plain words before anything else.',
  '- Never invent a result for a job you did not hand off. If a job failed, say simply that you could not finish that check this time.',
].join('\n')

/** The G-02 Concierge prompt: the G-01 contract plus the handoff rules. */
export const CONCIERGE_TASKRUNNER_PROMPT = `${CONCIERGE_AGENT_PROMPT}${TASK_RUNNER_CONCIERGE_RULES}`

/**
 * One printable attribute value (concierge-signal.ts printableAttribute):
 * strings only, clamped, with the angle brackets and quotes that could
 * close a tag stripped rather than escaped — nothing the model reads back
 * can forge a tag boundary.
 */
export function printableTaskAttribute(value: string): string {
  const flat = value.replace(/[\r\n\t]+/g, ' ').replace(/[<>"&]/g, ' ').trim()
  return flat.length > TASK_ATTRIBUTE_VALUE_LIMIT ? `${flat.slice(0, TASK_ATTRIBUTE_VALUE_LIMIT - 1)}…` : flat
}

function printableTaskContents(value: string): string {
  const flat = value.replace(/[<>"&]/g, ' ').trim()
  return flat.length > TASK_CONTENTS_LIMIT ? `${flat.slice(0, TASK_CONTENTS_LIMIT - 1)}…` : flat
}

/**
 * The finished jobs the Concierge has not reported yet, as one tagged block
 * to append to the system prompt. '' when there is nothing to report, so
 * the off path (and every turn with no results) sends the prompt unchanged.
 */
export function taskResultsContext(results: readonly TaskResultContext[]): string {
  if (results.length === 0) return ''
  const lines = results.map((result) => {
    const attrs = [
      `id="${printableTaskAttribute(result.id)}"`,
      `title="${printableTaskAttribute(result.title)}"`,
      `status="${printableTaskAttribute(result.status)}"`,
    ].join(' ')
    return `  <${TASK_RESULT_TAG_NAME} ${attrs}>${printableTaskContents(result.summary)}</${TASK_RESULT_TAG_NAME}>`
  })
  return `<task-results>\n${lines.join('\n')}\n</task-results>`
}
