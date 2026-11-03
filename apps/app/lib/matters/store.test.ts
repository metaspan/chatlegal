import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { appendMatterMessage, createMatter, createMatterStore, getMatterThread, listMatters, type MatterStore } from './store.ts'

async function withStore(run: (store: MatterStore) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-matters-'))
  const url = `file:${path.join(dir, 'matters.db')}`
  let store: MatterStore | null = null
  try {
    store = await createMatterStore(url)
    await run(store)
  } finally {
    await store?.close()
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('mastra matter store', () => {
  it('creates a matter for the signed-in user and hides it from everyone else', async () => {
    await withStore(async (store) => {
      const created = await createMatter(store, 'user_a')
      assert.equal(created.title, 'New chat')
      assert.match(created.id, /^[0-9a-f-]{36}$/i)

      const named = await createMatter(store, 'user_a', { title: '  Deposit  ' })
      assert.equal(named.title, 'Deposit')

      const own = await listMatters(store, 'user_a')
      assert.deepEqual(
        own.map((matter) => matter.id).sort(),
        [created.id, named.id].sort(),
      )
      assert.deepEqual(await listMatters(store, 'user_b'), [])

      const opened = await getMatterThread(store, 'user_a', named.id)
      assert.equal(opened?.matter.title, 'Deposit')
      assert.deepEqual(opened?.messages, [])
      assert.equal(await getMatterThread(store, 'user_b', named.id), null)
      assert.equal(await getMatterThread(store, 'user_a', created.id.replaceAll('-', '') + 'nope'), null)
    })
  })

  it('loads messages only for the matter thread that owns them', async () => {
    await withStore(async (store) => {
      const first = await createMatter(store, 'user_a', { title: 'First' })
      const second = await createMatter(store, 'user_a', { title: 'Second' })
      const saved = await appendMatterMessage(store, 'user_a', first.id, { role: 'user', text: 'When is the deadline?' })
      assert.ok(saved)
      assert.equal(await appendMatterMessage(store, 'user_b', first.id, { role: 'user', text: 'nope' }), null)

      const thread = await getMatterThread(store, 'user_a', first.id)
      assert.deepEqual(
        thread?.messages.map((message) => message.text),
        ['When is the deadline?'],
      )
      assert.equal(thread?.messages[0]?.role, 'user')

      const other = await getMatterThread(store, 'user_a', second.id)
      assert.deepEqual(other?.messages, [])

      const listed = await listMatters(store, 'user_a')
      assert.equal(listed[0]?.id, first.id)
    })
  })

  it('keeps observational memory and semantic recall off', () => {
    const source = fs.readFileSync(new URL('./store.ts', import.meta.url), 'utf8')
    assert.match(source, /observationalMemory:\s*false/)
    assert.match(source, /semanticRecall:\s*false/)
    assert.doesNotMatch(source, /observationalMemory:\s*true/)
  })
})
