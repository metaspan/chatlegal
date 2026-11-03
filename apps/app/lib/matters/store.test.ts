import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { matterResourceId } from './resource.ts'
import { appendMatterMessage, createMatter, createMatterStore, getMatterThread, listMatters, type MatterStore } from './store.ts'

async function withStore(run: (store: MatterStore) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-matters-'))
  const url = `file:${path.join(dir, 'matters.db')}`
  let store: MatterStore | null = null
  try {
    store = await createMatterStore(url, { env: {} })
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

  it('returns a tool name for the centre pane and leaves the payload in storage only', async () => {
    await withStore(async (store) => {
      const matter = await createMatter(store, 'user_a', { title: 'Deposit' })
      await store.memory.saveMessages({
        messages: [
          {
            id: randomUUID(),
            role: 'assistant',
            createdAt: new Date('2026-11-03T00:00:00.000Z'),
            threadId: matter.id,
            resourceId: matterResourceId('user_a'),
            content: {
              format: 2,
              parts: [
                { type: 'text', text: 'Here is what the notice says.' },
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    state: 'result',
                    toolCallId: 'call-1',
                    toolName: 'search_sources',
                    args: { query: 'deposit', secret: 'do-not-show' },
                    result: { token: 'json-dump' },
                  },
                },
              ],
            },
          },
        ],
      })
      const thread = await getMatterThread(store, 'user_a', matter.id)
      assert.equal(thread?.messages[0]?.text, 'Here is what the notice says.')
      assert.deepEqual(thread?.messages[0]?.tools, [{ name: 'search_sources' }])
      const shown = JSON.stringify(thread?.messages)
      assert.equal(shown.includes('do-not-show'), false)
      assert.equal(shown.includes('json-dump'), false)
      assert.equal(shown.includes('call-1'), false)
    })
  })

  it('keeps observational memory off unless an explicit model is configured', async () => {
    const source = fs.readFileSync(new URL('./store.ts', import.meta.url), 'utf8')
    assert.match(source, /semanticRecall:\s*false/)
    assert.doesNotMatch(source, /observationalMemory:\s*true/)

    await withStore(async (store) => {
      const config = store.memory.getMergedThreadConfig().observationalMemory
      assert.equal(config, false)
      assert.equal(await store.memory.omEngine, null)
      const opened = await getMatterThread(store, 'user_a', (await createMatter(store, 'user_a')).id)
      assert.deepEqual(opened?.observations, { enabled: false, summary: '' })
    })
  })

  it('scopes a stored summary to the open matter thread', async () => {
    await withStore(async (store) => {
      const first = await createMatter(store, 'user_a', { title: 'Deposit' })
      const second = await createMatter(store, 'user_a', { title: 'Parking' })
      const resourceId = matterResourceId('user_a')
      await seedObservation(store, {
        scope: 'thread',
        matterId: first.id,
        resourceId,
        text: 'The deposit deadline is Friday.',
      })
      await seedObservation(store, {
        scope: 'thread',
        matterId: second.id,
        resourceId,
        text: 'The parking ticket is unpaid.',
      })
      await seedObservation(store, {
        scope: 'resource',
        matterId: null,
        resourceId,
        text: 'Shared across every matter.',
      })

      const opened = await getMatterThread(store, 'user_a', first.id)
      assert.equal(opened?.observations.enabled, false)
      assert.equal(opened?.observations.summary, 'The deposit deadline is Friday.')
      assert.doesNotMatch(opened?.observations.summary ?? '', /parking|Shared across/i)

      const other = await getMatterThread(store, 'user_a', second.id)
      assert.equal(other?.observations.summary, 'The parking ticket is unpaid.')
      assert.equal(await getMatterThread(store, 'user_b', first.id), null)
    })
  })

  it('attaches thread-scoped observational memory only when the model env is set', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-matters-om-'))
    const url = `file:${path.join(dir, 'matters.db')}`
    const store = await createMatterStore(url, {
      env: { CHATLEGAL_OM_ENABLED: 'true', CHATLEGAL_OM_MODEL: 'openai/gpt-4.1-mini' },
    })
    try {
      const config = store.memory.getMergedThreadConfig().observationalMemory
      assert.equal(typeof config, 'object')
      assert.notEqual(config, true)
      if (config === true || config === false || config == null) {
        assert.fail('observational memory config should be an object')
      }
      assert.equal(config.scope, 'thread')
      assert.equal(config.retrieval, false)
      assert.equal(config.model, 'openai/gpt-4.1-mini')
      const engine = await store.memory.omEngine
      assert.ok(engine)
      assert.equal(engine.scope, 'thread')
      assert.equal(engine.config.retrieval, false)
    } finally {
      await store.close()
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

async function seedObservation(
  store: MatterStore,
  input: { scope: 'thread' | 'resource'; matterId: string | null; resourceId: string; text: string },
) {
  const domain = await store.memory.storage.getStore('memory')
  if (!domain) throw new Error('memory store missing')
  const record = await domain.initializeObservationalMemory({
    threadId: input.scope === 'thread' ? input.matterId : null,
    resourceId: input.resourceId,
    scope: input.scope,
    config: { scope: input.scope },
  })
  await domain.updateActiveObservations({
    id: record.id,
    observations: input.text,
    tokenCount: input.text.length,
    lastObservedAt: new Date('2026-11-03T00:00:00.000Z'),
  })
}
