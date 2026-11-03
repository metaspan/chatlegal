import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { HISTORY_PLACEHOLDERS, filterHistory } from './history-placeholders.ts'

describe('history placeholders', () => {
  it('lists a chat row and a matter row', () => {
    assert.deepEqual(
      HISTORY_PLACEHOLDERS.map((item) => item.group),
      ['Chats', 'Matters'],
    )
  })

  it('filters by title, group, or detail', () => {
    assert.equal(filterHistory(HISTORY_PLACEHOLDERS, '  ').length, 2)
    assert.deepEqual(
      filterHistory(HISTORY_PLACEHOLDERS, 'matter').map((item) => item.id),
      ['matter-placeholder'],
    )
    assert.equal(filterHistory(HISTORY_PLACEHOLDERS, 'nothing-here').length, 0)
  })
})
