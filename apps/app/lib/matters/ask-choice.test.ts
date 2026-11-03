import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  MatterWidgetError,
  acceptChoiceAnswer,
  askChoiceToolResult,
  checkChoiceAnswer,
  choiceDraft,
  isCredentialLike,
  parseAskChoiceProps,
  readMatterAskChoice,
} from './ask-choice.ts'
import { messagesWithChoiceAnswer } from './message.ts'

const options = [
  { id: 'scheme', label: 'Deposit scheme' },
  { id: 'court', label: 'Court' },
]

describe('askChoice', () => {
  it('accepts one offered option and refuses anything else', () => {
    const props = parseAskChoiceProps({ question: 'Which route fits?', options })
    assert.deepEqual(acceptChoiceAnswer(props, { choice: 'scheme' }), { ok: true, answer: { choice: 'scheme' } })
    const refused = acceptChoiceAnswer(props, { choice: 'nope' })
    assert.equal(refused.ok, false)
    if (!refused.ok) assert.deepEqual(refused.issues, ['choice: not_an_option'])
    const multi = acceptChoiceAnswer(props, { choices: ['scheme'] })
    assert.equal(multi.ok, false)
    if (!multi.ok) assert.ok(multi.issues.includes('choices: multi_only'))
    assert.deepEqual(choiceDraft(props, 'scheme'), { ok: true, answer: { choice: 'scheme' } })
    assert.equal(choiceDraft(props, undefined).ok, false)
  })

  it('checks a multi-select list against the bounds', () => {
    const props = parseAskChoiceProps({
      question: 'Which papers do you have?',
      multiSelect: true,
      maxSelected: 2,
      options: [...options, { id: 'photos', label: 'Photos' }],
    })
    assert.deepEqual(checkChoiceAnswer(props, { choices: ['scheme', 'court'] }), [])
    assert.ok(checkChoiceAnswer(props, { choices: [] }).includes('choices: too_few'))
    assert.ok(checkChoiceAnswer(props, { choices: ['scheme', 'court', 'photos'] }).includes('choices: too_many'))
    assert.equal(choiceDraft(props, ['scheme', 'photos']).ok, true)
  })

  it('refuses a question that asks for a password and a duplicate option id', () => {
    assert.equal(isCredentialLike('What is your password?', true), true)
    assert.equal(isCredentialLike('When is the deadline?', true), false)
    assert.throws(() => parseAskChoiceProps({ question: 'What is your password?', options }), MatterWidgetError)
    assert.throws(
      () => parseAskChoiceProps({ question: 'Which?', options: [options[0], { id: 'scheme', label: 'Again' }] }),
      MatterWidgetError,
    )
  })

  it('reads a stored tool call and hides it once the result is the pick', () => {
    const props = parseAskChoiceProps({ question: 'Which route fits?', detail: 'About the notice.', options, recommended: 'scheme' })
    const pending = readMatterAskChoice({
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId: 'call-1',
            toolName: 'askChoice',
            args: { widgetVersion: 2, ...props },
          },
        },
      ],
    })
    assert.equal(pending?.status, 'pending')
    assert.equal(pending?.version, 2)
    assert.deepEqual(pending?.recommended, ['scheme'])
    assert.equal(pending?.detail, 'About the notice.')
    assert.equal(JSON.stringify(pending).includes('widgetVersion'), false)

    const answer = { choice: 'court' }
    const answered = readMatterAskChoice({
      parts: [
        {
          type: 'tool-invocation',
          updatedAt: Date.parse('2026-11-03T12:00:00.000Z'),
          toolInvocation: {
            state: 'result',
            toolCallId: 'call-1',
            toolName: 'askChoice',
            args: { widgetVersion: 2, ...props },
            result: askChoiceToolResult(2, answer),
          },
        },
      ],
    })
    assert.equal(answered?.status, 'answered')
    assert.deepEqual(answered?.answer, answer)
    assert.equal(answered?.answeredAt, '2026-11-03T12:00:00.000Z')
  })

  it('does not replace a pick that is already on the card', () => {
    const widget = {
      toolCallId: 'call-1',
      name: 'askChoice' as const,
      version: 2 as const,
      question: 'Which route fits?',
      options,
      multiSelect: false,
      minSelected: 1,
      maxSelected: 1,
      status: 'pending' as const,
    }
    const once = messagesWithChoiceAnswer(
      [{ id: 'm', role: 'assistant', text: '', createdAt: '2026-11-03T00:00:00.000Z', widget }],
      'call-1',
      { choice: 'scheme' },
      '2026-11-03T00:01:00.000Z',
    )
    const twice = messagesWithChoiceAnswer(once, 'call-1', { choice: 'court' }, '2026-11-03T00:02:00.000Z')
    assert.deepEqual(twice[0]?.widget?.answer, { choice: 'scheme' })
    assert.equal(twice[0]?.widget?.status, 'answered')
  })
})
