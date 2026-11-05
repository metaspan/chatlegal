/**
 * Scripted first turn for a new matter.
 * Information and triage only. No model is called. TODO(G-01 Concierge): a later
 * run may continue after this template. G-00 stays on hold, so this file does not.
 *
 * Copy is locked to docs/policies/05-genai-disclosure.md (session notice and the
 * answer label), docs/policies/01-code-of-ethics.md (not a solicitor; escalate
 * early), and docs/REFERRALS.md (hard-escalate destinations). Third-party names
 * are link-out destinations. Their pages are not quoted.
 */
import { parseAskChoiceProps, type AskChoiceProps } from './ask-choice'
import { isStoredMatterMessage, presentStoredMatterMessage } from './message'
import type { MatterMessage, MatterSummary } from './types'

export const FIRST_TURN_DISCLOSURE_LABEL = 'AI-generated information — check the sources.'

export const FIRST_TURN_WHERE_QUESTION = 'Where is this happening?'

export const FIRST_TURN_PAPERS_QUESTION = 'What do you have with you?'

/** Public pages named in docs/REFERRALS.md, plus the methodology page. */
export const FIRST_TURN_URLS = {
  howItWorks: 'https://chatlegal.uk/docs/how-it-works',
  moneyClaim: 'https://www.gov.uk/respond-to-court-claim-for-money',
  moneyHelper: 'https://www.moneyhelper.org.uk/en',
  stepChange: 'https://www.stepchange.org/',
  nationalDebtline: 'https://nationaldebtline.org/',
  contactPolice: 'https://www.gov.uk/contact-police',
  policeUk: 'https://www.police.uk/',
  victimSupport: 'https://www.victimsupport.org.uk/',
  immigrationAdviser: 'https://www.gov.uk/find-an-immigration-adviser',
  reportChildAbuse: 'https://www.gov.uk/report-child-abuse',
  nspcc: 'https://www.nspcc.org.uk/',
  childline: 'https://www.childline.org.uk/',
  possession: 'https://www.gov.uk/guidance/legal-aid-for-possession-proceedings',
  legalAidFinder: 'https://find-legal-advice.justice.gov.uk/',
  findCourt: 'https://www.gov.uk/find-court-tribunal',
  domesticAbuse: 'https://www.nationaldahelpline.org.uk/',
  samaritans: 'https://www.samaritans.org/',
  homelessness: 'https://www.gov.uk/if-youre-homeless-at-risk-of-homelessness',
  findCouncil: 'https://www.gov.uk/find-local-council',
  shelterHelpline: 'https://england.shelter.org.uk/get_help/helpline',
  shelterCymru: 'https://sheltercymru.org.uk/',
  govWales: 'https://www.gov.wales/',
  mygovScot: 'https://www.mygov.scot/',
  nidirect: 'https://www.nidirect.gov.uk/',
} as const

const PLACE_IDS = ['england', 'wales', 'scotland', 'northern-ireland', 'not-sure'] as const

export type FirstTurnPlaceId = (typeof PLACE_IDS)[number]

function labelled(body: string): string {
  return `${FIRST_TURN_DISCLOSURE_LABEL}\n\n${body}`
}

/** The message a new matter opens on. */
export function firstTurnOpeningText(): string {
  const u = FIRST_TURN_URLS
  return [
    FIRST_TURN_DISCLOSURE_LABEL,
    '',
    `ChatLegal uses generative AI to explain UK law and point you to official sources. It is not a solicitor and does not give legal advice. How ChatLegal works: ${u.howItWorks}`,
    '',
    'Say what happened, where it is happening, and what you have — a letter, a notice, court papers, or nothing yet. Use your own words. The questions under this message record the place and the papers.',
    '',
    'Some problems need a person now. ChatLegal stops on these and does not answer the underlying question. The pages below are official or charity services. ChatLegal is not those services.',
    '',
    `Money at risk, or a court claim for money: ${u.moneyClaim}`,
    `Free, impartial money guidance: ${u.moneyHelper}`,
    `Debt help from a charity: ${u.stepChange} and ${u.nationalDebtline}`,
    `Crime, immediate danger, violence, threats, or an eviction in progress: call 999 if you are in danger now. How to contact the police: ${u.contactPolice} and ${u.policeUk}`,
    `If you have been a victim of crime: ${u.victimSupport}`,
    `Immigration status, a visa, or asylum: ${u.immigrationAdviser}`,
    `A child at risk, care proceedings, or child arrangements: report child abuse to a local council ${u.reportChildAbuse}, NSPCC ${u.nspcc}, Childline (for children) ${u.childline}`,
    `A hearing in the next few days, or a deadline on court papers: ${u.possession} and ${u.legalAidFinder} and ${u.findCourt}`,
    `If someone is hurting you at home, you do not have to describe it here: ${u.domesticAbuse}`,
    `If you are thinking of harming yourself: ${u.samaritans}. Call 999 if you are in danger now.`,
    `Nowhere to sleep tonight, or locked out: ${u.homelessness} and ${u.findCouncil}. England: ${u.shelterHelpline}. Wales: ${u.shelterCymru}`,
    '',
    `Scotland: ${u.mygovScot}. Northern Ireland: ${u.nidirect}. Wales: ${u.govWales}. ChatLegal does not apply England and Wales information to Scotland or Northern Ireland.`,
  ].join('\n')
}

export function firstTurnWhereProps(): AskChoiceProps {
  const u = FIRST_TURN_URLS
  return parseAskChoiceProps({
    question: FIRST_TURN_WHERE_QUESTION,
    detail:
      'This only records the place. England, Wales, Scotland, and Northern Ireland use different official pages. It is not legal advice.',
    options: [
      { id: 'england', label: 'England', description: 'Write what happened in your own words.' },
      { id: 'wales', label: 'Wales', description: `Official pages for Wales include ${u.govWales}` },
      { id: 'scotland', label: 'Scotland', description: `Official pages for Scotland start at ${u.mygovScot}` },
      {
        id: 'northern-ireland',
        label: 'Northern Ireland',
        description: `Official pages start at ${u.nidirect}`,
      },
      { id: 'not-sure', label: 'I am not sure', description: 'You can name the country in your next message.' },
    ],
  })
}

export function firstTurnPapersProps(): AskChoiceProps {
  return parseAskChoiceProps({
    question: FIRST_TURN_PAPERS_QUESTION,
    detail: 'Pick any that apply. You can describe them in your own words next. It is not legal advice.',
    multiSelect: true,
    minSelected: 1,
    maxSelected: 5,
    options: [
      { id: 'letter', label: 'A letter or email' },
      { id: 'notice', label: 'A notice' },
      { id: 'court-papers', label: 'Court papers' },
      { id: 'agreement', label: 'An agreement' },
      { id: 'nothing-yet', label: 'Nothing on paper yet' },
    ],
  })
}

/** Short note after the place card. Null when the pick is not one of the first-turn options. */
export function firstTurnPlaceNote(choiceId: string): string | null {
  const u = FIRST_TURN_URLS
  const notes: Record<FirstTurnPlaceId, string> = {
    england: 'England. Write what happened, in your own words, and say what you have with you. This is not legal advice.',
    wales: `Wales. Official pages include ${u.govWales}. Write what happened in your own words. This is not legal advice.`,
    scotland: `Scotland. Official pages start at ${u.mygovScot}. ChatLegal does not apply England and Wales information to Scotland. This is not legal advice.`,
    'northern-ireland': `Northern Ireland. Official pages start at ${u.nidirect}. ChatLegal does not apply England and Wales information to Northern Ireland. This is not legal advice.`,
    'not-sure':
      'The country is not named yet. Official pages differ, so name the country if you can. Write what happened in your own words. This is not legal advice.',
  }
  if (!Object.hasOwn(notes, choiceId)) return null
  return labelled(notes[choiceId as FirstTurnPlaceId])
}

/** Short note after the papers card. */
export function firstTurnPapersNote(choiceIds: readonly string[]): string | null {
  if (choiceIds.length === 0) return null
  const u = FIRST_TURN_URLS
  if (choiceIds.includes('court-papers')) {
    return labelled(
      `Court papers are noted on this chat. If a date on them is soon, use ${u.possession} or ${u.legalAidFinder} or ${u.moneyClaim} before you write more. Then say what happened, in your own words. This is not legal advice.`,
    )
  }
  if (choiceIds.length === 1 && choiceIds[0] === 'nothing-yet') {
    return labelled('Nothing on paper yet is fine. Write what happened, in your own words. This is not legal advice.')
  }
  return labelled(
    'Those papers are noted on this chat. Write what happened, and what they say, in your own words. Leave out passwords and card numbers. This is not legal advice.',
  )
}

/** The templated note for an answered first-turn card. Other cards return null. */
export function firstTurnContinuationText(message: Pick<MatterMessage, 'widget'>): string | null {
  const widget = message.widget
  if (!widget || widget.status !== 'answered' || !widget.answer) return null
  if (widget.question === FIRST_TURN_WHERE_QUESTION && 'choice' in widget.answer) {
    return firstTurnPlaceNote(widget.answer.choice)
  }
  if (widget.question === FIRST_TURN_PAPERS_QUESTION && 'choices' in widget.answer) {
    return firstTurnPapersNote(widget.answer.choices)
  }
  return null
}

/** Opening text, both cards, and every templated note. Tests scan this for copy locks. */
export function firstTurnStaticCopy(): string {
  const where = firstTurnWhereProps()
  const papers = firstTurnPapersProps()
  const placeNotes = PLACE_IDS.map((id) => firstTurnPlaceNote(id) ?? '')
  const paperNotes = [
    firstTurnPapersNote(['court-papers']),
    firstTurnPapersNote(['nothing-yet']),
    firstTurnPapersNote(['letter']),
    firstTurnPapersNote(['notice', 'agreement']),
  ].map((note) => note ?? '')
  return [
    firstTurnOpeningText(),
    where.question,
    where.detail ?? '',
    ...where.options.flatMap((option) => [option.label, option.description ?? '']),
    papers.question,
    papers.detail ?? '',
    ...papers.options.flatMap((option) => [option.label, option.description ?? '']),
    ...placeNotes,
    ...paperNotes,
  ].join('\n')
}

function isMatterSummary(value: unknown): value is MatterSummary {
  if (!value || typeof value !== 'object') return false
  const record = value as { id?: unknown; title?: unknown; createdAt?: unknown; updatedAt?: unknown }
  return (
    typeof record.id === 'string' &&
    record.id.trim().length > 0 &&
    typeof record.title === 'string' &&
    record.title.trim().length > 0 &&
    typeof record.createdAt === 'string' &&
    record.createdAt.length > 0 &&
    typeof record.updatedAt === 'string' &&
    record.updatedAt.length > 0
  )
}

/**
 * The matter and its first-turn messages from POST /api/matters.
 * Returns null unless both are present, so the centre does not open on an empty thread.
 */
export function matterOpenedFromCreate(body: unknown): { matter: MatterSummary; messages: MatterMessage[] } | null {
  if (!body || typeof body !== 'object') return null
  const record = body as { matter?: unknown; messages?: unknown }
  if (!isMatterSummary(record.matter)) return null
  if (!Array.isArray(record.messages) || record.messages.length === 0) return null
  const messages: MatterMessage[] = []
  for (const item of record.messages) {
    if (!isStoredMatterMessage(item)) return null
    messages.push(presentStoredMatterMessage(item))
  }
  return {
    matter: {
      id: record.matter.id,
      title: record.matter.title,
      createdAt: record.matter.createdAt,
      updatedAt: record.matter.updatedAt,
    },
    messages,
  }
}
