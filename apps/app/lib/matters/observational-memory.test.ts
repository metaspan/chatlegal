import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matterObservationSummary, matterObservationalMemoryConfig } from './observational-memory.ts'

describe('observational memory config', () => {
  it('stays off by default and refuses a flag without a model', () => {
    assert.equal(matterObservationalMemoryConfig({}), false)
    assert.equal(matterObservationalMemoryConfig({ CHATLEGAL_OM_ENABLED: 'false' }), false)
    assert.equal(matterObservationalMemoryConfig({ CHATLEGAL_OM_ENABLED: '1', CHATLEGAL_OM_MODEL: 'openai/gpt-4.1-mini' }), false)
    assert.equal(matterObservationalMemoryConfig({ CHATLEGAL_OM_ENABLED: 'true' }), false)
    assert.equal(matterObservationalMemoryConfig({ CHATLEGAL_OM_ENABLED: 'true', CHATLEGAL_OM_MODEL: '  ' }), false)
    assert.equal(
      matterObservationalMemoryConfig({ CHATLEGAL_OM_ENABLED: 'false', CHATLEGAL_OM_MODEL: 'openai/gpt-4.1-mini' }),
      false,
    )
  })

  it('uses an explicit model and thread scope when both env values are set', () => {
    const config = matterObservationalMemoryConfig({
      CHATLEGAL_OM_ENABLED: ' true ',
      CHATLEGAL_OM_MODEL: ' openai/gpt-4.1-mini ',
    })
    assert.notEqual(config, true)
    assert.deepEqual(config, {
      model: 'openai/gpt-4.1-mini',
      scope: 'thread',
      retrieval: false,
      observation: { messageTokens: 30_000 },
      reflection: { observationTokens: 40_000 },
    })
  })
})

describe('matter observation summary', () => {
  const expected = { matterId: 'matter-a', resourceId: 'clerk:user_a' }

  it('keeps the active text for this thread only', () => {
    assert.equal(
      matterObservationSummary(
        {
          scope: 'thread',
          threadId: 'matter-a',
          resourceId: 'clerk:user_a',
          activeObservations: '  Deposit is due Friday.  ',
        },
        expected,
      ),
      'Deposit is due Friday.',
    )
  })

  it('drops another matter, another owner, and a resource-scoped row', () => {
    assert.equal(
      matterObservationSummary(
        { scope: 'thread', threadId: 'matter-b', resourceId: 'clerk:user_a', activeObservations: 'Parking.' },
        expected,
      ),
      '',
    )
    assert.equal(
      matterObservationSummary(
        { scope: 'thread', threadId: 'matter-a', resourceId: 'clerk:user_b', activeObservations: 'Someone else.' },
        expected,
      ),
      '',
    )
    assert.equal(
      matterObservationSummary(
        { scope: 'resource', threadId: null, resourceId: 'clerk:user_a', activeObservations: 'Every matter.' },
        expected,
      ),
      '',
    )
    assert.equal(matterObservationSummary(null, expected), '')
  })
})
