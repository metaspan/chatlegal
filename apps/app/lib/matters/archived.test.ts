import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyUnarchiveToArchivedList,
  mergeRestoredMatter,
  parseArchivedMattersResponse,
} from './archived.ts'
import type { MatterSummary } from './types.ts'

function summary(id: string, updatedAt: string, title = `Chat ${id}`): MatterSummary {
  return { id, title, createdAt: '2026-11-01T00:00:00.000Z', updatedAt }
}

describe('archived chats list moves', () => {
  it('reads the archived body newest first and refuses a bad body', () => {
    const a = summary('a', '2026-11-02T00:00:00.000Z')
    const b = summary('b', '2026-11-03T00:00:00.000Z')
    const parsed = parseArchivedMattersResponse({ matters: [a, b] })
    assert.deepEqual(parsed?.map((matter) => matter.id), ['b', 'a'])
    assert.equal(parseArchivedMattersResponse(null), null)
    assert.equal(parseArchivedMattersResponse({}), null)
    assert.equal(parseArchivedMattersResponse({ matters: 'nope' }), null)
    assert.equal(parseArchivedMattersResponse({ matters: [{ id: 'a' }] }), null)
  })

  it('drops one chat from the archived list when it is unarchived', () => {
    const a = summary('a', '2026-11-02T00:00:00.000Z')
    const b = summary('b', '2026-11-03T00:00:00.000Z')
    assert.deepEqual(applyUnarchiveToArchivedList([a, b], 'b'), [a])
    assert.deepEqual(applyUnarchiveToArchivedList([a], 'missing'), [a])
  })

  it('puts the restored chat back into the history list, newest first', () => {
    const a = summary('a', '2026-11-02T00:00:00.000Z')
    const restored = summary('r', '2026-11-04T00:00:00.000Z')
    assert.deepEqual(mergeRestoredMatter([a], restored).map((matter) => matter.id), ['r', 'a'])
    const older = summary('r', '2026-11-01T00:00:00.000Z')
    assert.deepEqual(mergeRestoredMatter([a], older).map((matter) => matter.id), ['a', 'r'])
    const replaced = summary('a', '2026-11-05T00:00:00.000Z', 'Renamed')
    const merged = mergeRestoredMatter([a], replaced)
    assert.equal(merged.length, 1)
    assert.equal(merged[0]?.title, 'Renamed')
  })
})
