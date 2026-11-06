import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChatColumn } from '../../components/chat/chat-column.tsx'
import { DisclaimerBar } from '../../components/disclaimer-bar.tsx'
import { APP_DISCLOSURE_LABEL } from '../disclosure.ts'
import { presentAskChoice } from './ask-choice.ts'
import {
  FIRST_TURN_PAPERS_QUESTION,
  FIRST_TURN_URLS,
  FIRST_TURN_WHERE_QUESTION,
  firstTurnOpeningText,
  firstTurnPapersNote,
  firstTurnPapersProps,
  firstTurnPlaceNote,
  firstTurnStaticCopy,
  firstTurnWhereProps,
  matterOpenedFromCreate,
} from './first-turn.ts'
import { httpsLinkParts } from './links.ts'
import type { MatterMessage } from './types.ts'

const BANNED = [
  /I act for you/i,
  /you will win/i,
  /you will lose/i,
  /your case is strong/i,
  /\bwe advise\b/i,
  /AI solicitor/i,
  /Citizens Advice/i,
  /\bas your (solicitor|lawyer|barrister|counsel)\b/i,
  /\byour lawyer\b/i,
  /you should sue/i,
  /chances of success/i,
]

function previewMessages(): MatterMessage[] {
  const where = presentAskChoice({
    toolCallId: 'where-1',
    version: 2,
    props: firstTurnWhereProps(),
    status: 'pending',
  })
  const papers = presentAskChoice({
    toolCallId: 'papers-1',
    version: 2,
    props: firstTurnPapersProps(),
    status: 'pending',
  })
  return [
    { id: 'open', role: 'assistant', text: firstTurnOpeningText(), createdAt: '2026-11-04T00:00:00.000Z' },
    { id: 'where', role: 'assistant', text: '', createdAt: '2026-11-04T00:00:01.000Z', widget: where },
    { id: 'papers', role: 'assistant', text: '', createdAt: '2026-11-04T00:00:02.000Z', widget: papers },
  ]
}

describe('new matter first turn', () => {
  it('locks the opening to the disclosure, the three questions, and the hard-escalate pages', () => {
    const opening = firstTurnOpeningText()
    assert.ok(opening.length < 8000)
    // C-13: no AI-generated lead-in in the message; the sticky app-shell footer owns it.
    assert.doesNotMatch(opening, /AI-generated information/)
    assert.match(opening, /ChatLegal uses generative AI to explain UK law/)
    assert.match(opening, /It is not a solicitor and does not give legal advice\./)
    assert.match(opening, /How ChatLegal works:/)
    assert.match(opening, /what happened/i)
    assert.match(opening, /where it is happening/i)
    assert.match(opening, /what you have/i)
    assert.match(opening, /does not answer the underlying question/)
    assert.match(opening, /call 999 if you are in danger now/)
    for (const url of Object.values(FIRST_TURN_URLS)) {
      assert.ok(opening.includes(url), url)
    }

    const where = firstTurnWhereProps()
    assert.equal(where.question, FIRST_TURN_WHERE_QUESTION)
    assert.equal(where.multiSelect, undefined)
    assert.equal(where.recommended, undefined)
    assert.deepEqual(
      where.options.map((option) => option.id),
      ['england', 'wales', 'scotland', 'northern-ireland', 'not-sure'],
    )
    const papers = firstTurnPapersProps()
    assert.equal(papers.question, FIRST_TURN_PAPERS_QUESTION)
    assert.equal(papers.multiSelect, true)
    assert.equal(papers.minSelected, 1)
    assert.ok(papers.options.some((option) => option.id === 'court-papers'))
    assert.ok(papers.options.some((option) => option.id === 'nothing-yet'))

    assert.match(firstTurnPlaceNote('scotland') ?? '', /https:\/\/www\.mygov\.scot\//)
    assert.match(firstTurnPlaceNote('northern-ireland') ?? '', /https:\/\/www\.nidirect\.gov\.uk\//)
    assert.equal(firstTurnPlaceNote('mars'), null)
    assert.match(firstTurnPapersNote(['court-papers']) ?? '', /https:\/\/www\.gov\.uk\/guidance\/legal-aid-for-possession-proceedings/)
    assert.match(firstTurnPapersNote(['nothing-yet']) ?? '', /Nothing on paper yet is fine/)
    assert.match(firstTurnPapersNote(['letter']) ?? '', /Leave out passwords and card numbers/)

    const copy = firstTurnStaticCopy()
    for (const pattern of BANNED) assert.doesNotMatch(copy, pattern)
    const withoutAllowedAdvice = copy
      .split('does not give legal advice')
      .join('')
      .split('This is not legal advice')
      .join('')
      .split('It is not legal advice')
      .join('')
      .replace(/https:\/\/\S+/g, '')
    assert.doesNotMatch(withoutAllowedAdvice, /\badvice\b/i)
    assert.doesNotMatch(copy.split('not a solicitor').join(''), /solicitor/i)
    assert.equal(copy.includes('Citizens Advice'), false)
  })

  it('keeps https destinations as the link text and leaves other text alone', () => {
    const parts = httpsLinkParts('Police: https://www.gov.uk/contact-police. Not http://example.com or javascript:alert(1).')
    assert.deepEqual(parts, [
      { kind: 'text', text: 'Police: ' },
      { kind: 'link', href: 'https://www.gov.uk/contact-police' },
      { kind: 'text', text: '. Not http://example.com or javascript:alert(1).' },
    ])
    const secret = httpsLinkParts('https://user:pass@example.com/hidden')
    assert.equal(secret.some((part) => part.kind === 'link'), false)
  })

  it('opens the centre on the stored first turn and refuses an empty create body', () => {
    const messages = previewMessages()
    const opened = matterOpenedFromCreate({
      matter: {
        id: 'matter-1',
        title: 'New chat',
        createdAt: '2026-11-04T00:00:00.000Z',
        updatedAt: '2026-11-04T00:00:02.000Z',
      },
      messages,
    })
    assert.equal(opened?.matter.id, 'matter-1')
    assert.equal(opened?.messages[0]?.text, firstTurnOpeningText())
    assert.equal(opened?.messages[1]?.widget?.question, FIRST_TURN_WHERE_QUESTION)
    assert.equal(opened?.messages[2]?.widget?.question, FIRST_TURN_PAPERS_QUESTION)
    assert.equal(matterOpenedFromCreate({ matter: opened?.matter, messages: [] }), null)
    assert.equal(matterOpenedFromCreate({ matter: opened?.matter }), null)

    const html = renderToStaticMarkup(
      createElement(ChatColumn, {
        title: 'New chat',
        detail: '',
        matterId: 'matter-1',
        messages,
        threadStatus: 'ready',
        observations: { enabled: false, summary: '' },
      }),
    )
    assert.match(html, /It is not a solicitor and does not give legal advice\./)
    // C-13: the transcript rows carry no AI-generated label; the sticky footer does.
    assert.doesNotMatch(html, /AI-generated information/)
    const footer = renderToStaticMarkup(createElement(DisclaimerBar))
    assert.match(footer, /data-disclosure-footer/)
    assert.match(footer, new RegExp(APP_DISCLOSURE_LABEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(footer, /Not a solicitor\. Not legal advice\./)
    assert.match(html, /Where is this happening\?/)
    assert.match(html, /What do you have with you\?/)
    assert.match(html, /href="https:\/\/www\.gov\.uk\/find-an-immigration-adviser"/)
    assert.match(html, /href="https:\/\/www\.samaritans\.org\/"/)
    assert.match(html, /href="https:\/\/www\.gov\.uk\/report-child-abuse"/)
    assert.match(html, /rel="noopener noreferrer"/)
    assert.equal(html.match(/data-widget="askChoice"/g)?.length, 2)
    assert.doesNotMatch(html, /data-chat-empty/)
    for (const pattern of BANNED) assert.doesNotMatch(html, pattern)
    assert.match(html, /<h1[^>]*>New chat<\/h1>/)
  })

  it('does not call a model or read a new environment variable', () => {
    const root = new URL('./', import.meta.url)
    const source = ['first-turn.ts', 'seed-first-turn.ts', 'links.ts']
      .map((name) => fs.readFileSync(new URL(name, root), 'utf8'))
      .join('\n')
    assert.doesNotMatch(source, /generateText|streamText|openai|LiteLLM|CHATLEGAL_/)
    assert.match(source, /does not call a model|No model is called/)
  })
})
