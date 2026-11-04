import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { withProcessEnvLock } from '../process-env-lock.ts'
import { createMatter, disconnectMatterStore, getMatterStore } from '../matters/store.ts'
import { writeMatterFile, writeUserFile } from '../workspace/store.ts'
import { FILE_SEARCH_OFF, FILE_SEARCH_UNAVAILABLE } from './messages.ts'

function hashEmbed(texts: string[]): number[][] {
  const dimension = 4096
  return texts.map((text) => {
    const vector = new Array<number>(dimension).fill(0)
    const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 8)
    for (const token of tokens.length ? tokens : text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
      let hash = 2166136261
      for (let index = 0; index < token.length; index += 1) {
        hash ^= token.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
      }
      vector[(hash >>> 0) % dimension] += 1
    }
    const norm = Math.hypot(...vector) || 1
    return vector.map((value) => value / norm)
  })
}

describe('embedding routes', () => {
  it('returns an empty off message and does not call the embeddings endpoint', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-embed-route-off-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousRoot = process.env.CHATLEGAL_WORKSPACE_ROOT
      const previousSession = process.env.CHATLEGAL_TEST_SESSION
      const previousEnabled = process.env.CHATLEGAL_EMBED_ENABLED
      const previousModel = process.env.CHATLEGAL_EMBED_MODEL
      const previousUrl = process.env.CHATLEGAL_EMBED_BASE_URL
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_WORKSPACE_ROOT = path.join(dir, 'workspace')
      process.env.CHATLEGAL_TEST_SESSION = 'signed-in'
      delete process.env.CHATLEGAL_EMBED_ENABLED
      delete process.env.CHATLEGAL_EMBED_MODEL
      delete process.env.CHATLEGAL_EMBED_BASE_URL
      const originalFetch = globalThis.fetch
      let fetched = 0
      await disconnectMatterStore()
      try {
        await writeUserFile('user_test', 'notice.txt', 'Bring the agreement.')
        const store = await getMatterStore()
        const own = await createMatter(store, 'user_test', { title: 'Deposit' })
        const foreign = await createMatter(store, 'user_b', { title: 'Secret matter' })
        await writeMatterFile('user_b', foreign.id, 'secret.md', 'betasecrettoken hidden')
        globalThis.fetch = (async () => {
          fetched += 1
          throw new Error('embeddings endpoint was called while search is off')
        }) as typeof fetch
        const library = await import('../../app/api/library/index/route.ts')
        const matter = await import('../../app/api/matters/[matterId]/index/route.ts')

        const listed = await library.GET(new Request('http://localhost/api/library/index?q=agreement'))
        assert.equal(listed.status, 200)
        const listedBody = (await listed.json()) as { enabled: boolean; message: string; hits: unknown[] }
        assert.equal(listedBody.enabled, false)
        assert.equal(listedBody.message, FILE_SEARCH_OFF)
        assert.deepEqual(listedBody.hits, [])
        assert.equal(JSON.stringify(listedBody).includes('Bring the agreement'), false)

        const prepared = await library.POST(
          new Request('http://localhost/api/library/index', { method: 'POST', body: 'not-json' }),
        )
        assert.equal(prepared.status, 200)
        assert.equal(((await prepared.json()) as { message: string }).message, FILE_SEARCH_OFF)

        const ownStatus = await matter.GET(new Request('http://localhost/api/matters/' + own.id + '/index'), {
          params: Promise.resolve({ matterId: own.id }),
        })
        assert.equal(ownStatus.status, 200)
        assert.equal(((await ownStatus.json()) as { message: string }).message, FILE_SEARCH_OFF)

        const hidden = await matter.POST(new Request('http://localhost/api/matters/' + foreign.id + '/index', { method: 'POST' }), {
          params: Promise.resolve({ matterId: foreign.id }),
        })
        assert.equal(hidden.status, 404)
        const hiddenText = await hidden.text()
        assert.match(hiddenText, /Matter not found/)
        assert.doesNotMatch(hiddenText, /betasecrettoken|secret\.md|Secret matter/)
        assert.equal(fetched, 0)
        assert.equal(fs.existsSync(path.join(dir, 'workspace', 'users', 'user_test', 'index')), false)
        assert.equal(fs.existsSync(path.join(dir, 'workspace', 'users', 'user_b', 'index')), false)
      } finally {
        globalThis.fetch = originalFetch
        await disconnectMatterStore()
        if (previousDb === undefined) delete process.env.CHATLEGAL_MATTERS_DB
        else process.env.CHATLEGAL_MATTERS_DB = previousDb
        if (previousRoot === undefined) delete process.env.CHATLEGAL_WORKSPACE_ROOT
        else process.env.CHATLEGAL_WORKSPACE_ROOT = previousRoot
        if (previousSession === undefined) delete process.env.CHATLEGAL_TEST_SESSION
        else process.env.CHATLEGAL_TEST_SESSION = previousSession
        if (previousEnabled === undefined) delete process.env.CHATLEGAL_EMBED_ENABLED
        else process.env.CHATLEGAL_EMBED_ENABLED = previousEnabled
        if (previousModel === undefined) delete process.env.CHATLEGAL_EMBED_MODEL
        else process.env.CHATLEGAL_EMBED_MODEL = previousModel
        if (previousUrl === undefined) delete process.env.CHATLEGAL_EMBED_BASE_URL
        else process.env.CHATLEGAL_EMBED_BASE_URL = previousUrl
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it('prepares and searches through the embeddings endpoint when the flags are set', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-embed-route-on-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousRoot = process.env.CHATLEGAL_WORKSPACE_ROOT
      const previousSession = process.env.CHATLEGAL_TEST_SESSION
      const previousEnabled = process.env.CHATLEGAL_EMBED_ENABLED
      const previousModel = process.env.CHATLEGAL_EMBED_MODEL
      const previousUrl = process.env.CHATLEGAL_EMBED_BASE_URL
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_WORKSPACE_ROOT = path.join(dir, 'workspace')
      process.env.CHATLEGAL_TEST_SESSION = 'signed-in'
      process.env.CHATLEGAL_EMBED_ENABLED = 'true'
      process.env.CHATLEGAL_EMBED_MODEL = 'local-embed'
      process.env.CHATLEGAL_EMBED_BASE_URL = 'http://127.0.0.1:11434/v1'
      const originalFetch = globalThis.fetch
      const calls: { url: string; headers: [string, string][]; body: string }[] = []
      await disconnectMatterStore()
      try {
        await writeUserFile('user_test', 'notice.txt', 'alphalibrarytoken in the agreement')
        await writeUserFile('user_b', 'secret.txt', 'betasecrettoken for the other person')
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
          const body = String(init?.body ?? '')
          const parsed = JSON.parse(body) as { model?: string; input: string[] }
          calls.push({
            url: String(input),
            headers: [...new Headers(init?.headers).entries()],
            body,
          })
          assert.equal(parsed.model, 'local-embed')
          return new Response(
            JSON.stringify({
              data: parsed.input.map((text, index) => ({ index, embedding: hashEmbed([text])[0] })),
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }) as typeof fetch
        const library = await import('../../app/api/library/index/route.ts')
        const matter = await import('../../app/api/matters/[matterId]/index/route.ts')
        const store = await getMatterStore()
        const foreign = await createMatter(store, 'user_b', { title: 'Secret matter' })

        const status = await library.GET(new Request('http://localhost/api/library/index'))
        assert.equal(status.status, 200)
        assert.equal(((await status.json()) as { enabled: boolean }).enabled, true)
        assert.equal(calls.length, 0)

        const prepared = await library.POST(
          new Request('http://localhost/api/library/index', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          }),
        )
        assert.equal(prepared.status, 200)
        const preparedBody = (await prepared.json()) as { indexed: { name: string }[] }
        assert.deepEqual(preparedBody.indexed.map((file) => file.name), ['notice.txt'])
        assert.equal(calls.length, 1)
        assert.equal(calls[0]?.url, 'http://127.0.0.1:11434/v1/embeddings')
        assert.equal(
          calls[0]?.headers.some(([key]) => key.toLowerCase() === 'authorization'),
          false,
        )
        assert.equal(calls[0]?.body.includes('betasecrettoken'), false)

        const found = await library.GET(new Request('http://localhost/api/library/index?q=alphalibrarytoken'))
        assert.equal(found.status, 200)
        const foundBody = (await found.json()) as { hits: { name: string; excerpt: string }[] }
        assert.deepEqual(foundBody.hits.map((hit) => hit.name), ['notice.txt'])
        assert.match(foundBody.hits[0]?.excerpt ?? '', /alphalibrarytoken/)
        assert.equal(JSON.stringify(foundBody).includes('betasecrettoken'), false)

        const missing = await matter.GET(new Request('http://localhost/api/matters/' + foreign.id + '/index?q=betasecrettoken'), {
          params: Promise.resolve({ matterId: foreign.id }),
        })
        assert.equal(missing.status, 404)
        assert.doesNotMatch(await missing.text(), /betasecrettoken/)

        const tooLong = await library.GET(new Request('http://localhost/api/library/index?q=' + 'a'.repeat(501)))
        assert.equal(tooLong.status, 400)
        assert.match(await tooLong.text(), /Use a shorter search/)

        globalThis.fetch = (async () => new Response('no', { status: 503 })) as typeof fetch
        const failed = await library.POST(
          new Request('http://localhost/api/library/index', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'notice.txt' }),
          }),
        )
        assert.equal(failed.status, 502)
        assert.match(await failed.text(), new RegExp(FILE_SEARCH_UNAVAILABLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      } finally {
        globalThis.fetch = originalFetch
        await disconnectMatterStore()
        if (previousDb === undefined) delete process.env.CHATLEGAL_MATTERS_DB
        else process.env.CHATLEGAL_MATTERS_DB = previousDb
        if (previousRoot === undefined) delete process.env.CHATLEGAL_WORKSPACE_ROOT
        else process.env.CHATLEGAL_WORKSPACE_ROOT = previousRoot
        if (previousSession === undefined) delete process.env.CHATLEGAL_TEST_SESSION
        else process.env.CHATLEGAL_TEST_SESSION = previousSession
        if (previousEnabled === undefined) delete process.env.CHATLEGAL_EMBED_ENABLED
        else process.env.CHATLEGAL_EMBED_ENABLED = previousEnabled
        if (previousModel === undefined) delete process.env.CHATLEGAL_EMBED_MODEL
        else process.env.CHATLEGAL_EMBED_MODEL = previousModel
        if (previousUrl === undefined) delete process.env.CHATLEGAL_EMBED_BASE_URL
        else process.env.CHATLEGAL_EMBED_BASE_URL = previousUrl
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })
  })
})
