import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { withProcessEnvLock } from '../process-env-lock.ts'
import { createMatter, disconnectMatterStore, getMatterStore } from '../matters/store.ts'
import { copyWorkspaceFile, listUserFiles, moveWorkspaceFile, writeMatterFile, writeMatterFileBytes, writeUserFile } from '../workspace/store.ts'
import { prepareWorkspace, searchWorkspace } from './index.ts'
import { FILE_SEARCH_EMPTY_FILE, FILE_SEARCH_OFF, FILE_SEARCH_UNREADABLE } from './messages.ts'
import { docxWithText, docxWithoutText, pdfWithText } from './office-samples.test.ts'
import { embeddingDatabaseFile } from './paths.ts'

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

function readTree(dir: string): Buffer {
  if (!fs.existsSync(dir)) return Buffer.alloc(0)
  const parts: Buffer[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) parts.push(readTree(full))
    else parts.push(fs.readFileSync(full))
  }
  return Buffer.concat(parts)
}

describe('workspace embeddings', () => {
  it('does not prepare or search when the flags are unset', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-embed-off-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousRoot = process.env.CHATLEGAL_WORKSPACE_ROOT
      const previousEnabled = process.env.CHATLEGAL_EMBED_ENABLED
      const previousModel = process.env.CHATLEGAL_EMBED_MODEL
      const previousUrl = process.env.CHATLEGAL_EMBED_BASE_URL
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_WORKSPACE_ROOT = path.join(dir, 'workspace')
      delete process.env.CHATLEGAL_EMBED_ENABLED
      delete process.env.CHATLEGAL_EMBED_MODEL
      delete process.env.CHATLEGAL_EMBED_BASE_URL
      let fetched = 0
      const options = {
        embed: async (texts: string[]) => {
          fetched += 1
          return hashEmbed(texts)
        },
      }
      try {
        await writeUserFile('user_a', 'notice.txt', 'Bring the agreement.')
        await writeUserFile('user_a', 'scan.pdf', '%PDF-1.4 otherpdfsecret')
        await writeUserFile('user_a', 'reply.docx', 'wordsecretnotindexed')
        const status = await searchWorkspace('user_a', { kind: 'user' }, 'agreement', options)
        const prepared = await prepareWorkspace('user_a', { kind: 'user' }, undefined, options)
        assert.equal(status?.enabled, false)
        assert.equal(status?.message, FILE_SEARCH_OFF)
        assert.deepEqual(status?.hits, [])
        assert.equal(prepared?.enabled, false)
        assert.equal(prepared?.message, FILE_SEARCH_OFF)
        assert.equal(fetched, 0)
        assert.equal(fs.existsSync(path.join(dir, 'workspace', 'users', 'user_a', 'index')), false)
        assert.equal(status?.message.includes('Bring the agreement'), false)
        assert.equal(JSON.stringify(status).includes('otherpdfsecret'), false)
        assert.equal(JSON.stringify(prepared).includes('wordsecretnotindexed'), false)
      } finally {
        if (previousDb === undefined) delete process.env.CHATLEGAL_MATTERS_DB
        else process.env.CHATLEGAL_MATTERS_DB = previousDb
        if (previousRoot === undefined) delete process.env.CHATLEGAL_WORKSPACE_ROOT
        else process.env.CHATLEGAL_WORKSPACE_ROOT = previousRoot
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

  it('keeps each user and each matter in its own index file', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-embed-iso-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousRoot = process.env.CHATLEGAL_WORKSPACE_ROOT
      const previousEnabled = process.env.CHATLEGAL_EMBED_ENABLED
      const previousModel = process.env.CHATLEGAL_EMBED_MODEL
      const previousUrl = process.env.CHATLEGAL_EMBED_BASE_URL
      const root = path.join(dir, 'workspace')
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_WORKSPACE_ROOT = root
      process.env.CHATLEGAL_EMBED_ENABLED = 'true'
      process.env.CHATLEGAL_EMBED_MODEL = 'local-embed'
      process.env.CHATLEGAL_EMBED_BASE_URL = 'http://127.0.0.1:11434/v1'
      let fetched = 0
      const options = {
        embed: async (texts: string[]) => {
          fetched += 1
          return hashEmbed(texts)
        },
        fetch: (async () => {
          throw new Error('embeddings HTTP should not run when a test embedder is set')
        }) as typeof fetch,
      }
      await disconnectMatterStore()
      try {
        const store = await getMatterStore()
        const own = await createMatter(store, 'user_a', { title: 'Deposit' })
        const otherMatter = await createMatter(store, 'user_a', { title: 'Parking' })
        const foreign = await createMatter(store, 'user_b', { title: 'Secret matter' })
        await writeUserFile('user_a', 'notice.txt', 'alphalibrarytoken in the agreement')
        await writeUserFile('user_b', 'secret.txt', 'betasecrettoken for the other person')
        await writeUserFile('user_a', 'parking.txt', 'gammamattertoken stays in the library for now')
        const pdf = Buffer.from('%PDF-1.4 otherpdfsecret')
        await writeMatterFileBytes('user_a', own.id, 'scan.pdf', pdf)
        await writeMatterFileBytes('user_a', own.id, 'note.md', Buffer.from('deltamattertoken on this matter'))
        await writeMatterFileBytes('user_a', otherMatter.id, 'other.md', Buffer.from('epsilonothertoken on the other matter'))
        await writeMatterFileBytes('user_b', foreign.id, 'hidden.md', Buffer.from('zetasecrettoken hidden matter'))

        const before = await searchWorkspace('user_a', { kind: 'user' }, 'alphalibrarytoken', options)
        assert.equal(before?.message, 'Nothing in your files has been prepared for search yet.')
        assert.equal(fetched, 0)

        const library = await prepareWorkspace('user_a', { kind: 'user' }, undefined, options)
        assert.equal(library?.enabled, true)
        assert.deepEqual(
          library?.indexed.map((file) => file.name),
          ['notice.txt', 'parking.txt'],
        )
        const again = await prepareWorkspace('user_a', { kind: 'user' }, 'notice.txt', options)
        assert.equal(again?.indexed.length, 1)

        await prepareWorkspace('user_b', { kind: 'user' }, undefined, options)
        const ownIndex = await prepareWorkspace('user_a', { kind: 'matter', matterId: own.id }, undefined, options)
        assert.deepEqual(ownIndex?.indexed.map((file) => file.name), ['note.md'])
        assert.deepEqual(ownIndex?.skipped, [{ name: 'scan.pdf', reason: FILE_SEARCH_UNREADABLE }])
        const matterBytes = fs.readFileSync(embeddingDatabaseFile('user_a', { kind: 'matter', matterId: own.id }) ?? '')
        assert.equal(matterBytes.includes(Buffer.from('otherpdfsecret')), false)
        await prepareWorkspace('user_a', { kind: 'matter', matterId: otherMatter.id }, undefined, options)
        const hidden = await prepareWorkspace('user_a', { kind: 'matter', matterId: foreign.id }, undefined, options)
        assert.equal(hidden, null)

        const alpha = await searchWorkspace('user_a', { kind: 'user' }, 'alphalibrarytoken', options)
        assert.deepEqual(alpha?.hits.map((hit) => hit.name), ['notice.txt'])
        assert.match(alpha?.hits[0]?.excerpt ?? '', /alphalibrarytoken/)
        assert.equal(JSON.stringify(alpha).includes('betasecrettoken'), false)

        const beta = await searchWorkspace('user_b', { kind: 'user' }, 'betasecrettoken', options)
        assert.deepEqual(beta?.hits.map((hit) => hit.name), ['secret.txt'])
        assert.equal(JSON.stringify(beta).includes('alphalibrarytoken'), false)

        const libraryBytes = readTree(path.join(root, 'users', 'user_a', 'index'))
        const otherBytes = readTree(path.join(root, 'users', 'user_b', 'index'))
        assert.equal(libraryBytes.includes(Buffer.from('betasecrettoken')), false)
        assert.equal(libraryBytes.includes(Buffer.from('zetasecrettoken')), false)
        assert.equal(libraryBytes.includes(Buffer.from('otherpdfsecret')), false)
        assert.equal(otherBytes.includes(Buffer.from('alphalibrarytoken')), false)
        assert.equal(otherBytes.includes(Buffer.from('deltamattertoken')), false)

        const matterHits = await searchWorkspace('user_a', { kind: 'matter', matterId: own.id }, 'deltamattertoken', options)
        assert.deepEqual(matterHits?.hits.map((hit) => hit.name), ['note.md'])
        const otherHits = await searchWorkspace('user_a', { kind: 'matter', matterId: otherMatter.id }, 'deltamattertoken', options)
        assert.deepEqual(otherHits?.hits, [])
        const libraryMiss = await searchWorkspace('user_a', { kind: 'user' }, 'deltamattertoken', options)
        assert.deepEqual(libraryMiss?.hits, [])
        const crossed = await searchWorkspace('user_a', { kind: 'matter', matterId: own.id }, 'alphalibrarytoken', options)
        assert.deepEqual(crossed?.hits, [])

        const foreignSearch = await searchWorkspace('user_a', { kind: 'matter', matterId: foreign.id }, 'zetasecrettoken', options)
        assert.equal(foreignSearch, null)
        assert.equal(fs.existsSync(embeddingDatabaseFile('user_b', { kind: 'matter', matterId: foreign.id }) ?? ''), false)

        const names = (await listUserFiles('user_a')).map((file) => file.name)
        assert.deepEqual(names, ['notice.txt', 'parking.txt'])
        const mattersDb = fs.readFileSync(path.join(dir, 'matters.db'))
        assert.equal(mattersDb.includes(Buffer.from('alphalibrarytoken')), false)
        assert.equal(mattersDb.includes(Buffer.from('betasecrettoken')), false)

        const libraryDb = embeddingDatabaseFile('user_a', { kind: 'user' })
        const matterDb = embeddingDatabaseFile('user_a', { kind: 'matter', matterId: own.id })
        assert.equal(libraryDb?.startsWith(root), true)
        assert.equal(matterDb?.startsWith(root), true)
        assert.notEqual(libraryDb, path.join(dir, 'matters.db'))
        assert.equal(fs.existsSync(libraryDb ?? ''), true)
        assert.equal(path.basename(path.dirname(libraryDb ?? '')), 'index')

        await moveWorkspaceFile('user_a', {
          name: 'parking.txt',
          from: { kind: 'user' },
          to: { kind: 'matter', matterId: own.id },
        })
        const movedAway = await searchWorkspace('user_a', { kind: 'user' }, 'gammamattertoken', options)
        assert.deepEqual(movedAway?.hits, [])
        const notYet = await searchWorkspace('user_a', { kind: 'matter', matterId: own.id }, 'gammamattertoken', options)
        assert.deepEqual(notYet?.hits, [])
        await prepareWorkspace('user_a', { kind: 'matter', matterId: own.id }, 'parking.txt', options)
        const moved = await searchWorkspace('user_a', { kind: 'matter', matterId: own.id }, 'gammamattertoken', options)
        assert.deepEqual(moved?.hits.map((hit) => hit.name), ['parking.txt'])
        const stillLibrary = await searchWorkspace('user_a', { kind: 'user' }, 'gammamattertoken', options)
        assert.deepEqual(stillLibrary?.hits, [])

        await copyWorkspaceFile('user_a', {
          name: 'notice.txt',
          from: { kind: 'user' },
          to: { kind: 'matter', matterId: otherMatter.id },
        })
        const kept = await searchWorkspace('user_a', { kind: 'user' }, 'alphalibrarytoken', options)
        assert.deepEqual(kept?.hits.map((hit) => hit.name), ['notice.txt'])
        const copyNotIndexed = await searchWorkspace(
          'user_a',
          { kind: 'matter', matterId: otherMatter.id },
          'alphalibrarytoken',
          options,
        )
        assert.deepEqual(copyNotIndexed?.hits, [])
        assert.ok(fetched > 0)
      } finally {
        await disconnectMatterStore()
        if (previousDb === undefined) delete process.env.CHATLEGAL_MATTERS_DB
        else process.env.CHATLEGAL_MATTERS_DB = previousDb
        if (previousRoot === undefined) delete process.env.CHATLEGAL_WORKSPACE_ROOT
        else process.env.CHATLEGAL_WORKSPACE_ROOT = previousRoot
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

  it('indexes PDF and Word text beside Markdown, and skips a file it cannot read', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-embed-extract-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousRoot = process.env.CHATLEGAL_WORKSPACE_ROOT
      const previousEnabled = process.env.CHATLEGAL_EMBED_ENABLED
      const previousModel = process.env.CHATLEGAL_EMBED_MODEL
      const previousUrl = process.env.CHATLEGAL_EMBED_BASE_URL
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_WORKSPACE_ROOT = path.join(dir, 'workspace')
      process.env.CHATLEGAL_EMBED_ENABLED = 'true'
      process.env.CHATLEGAL_EMBED_MODEL = 'local-embed'
      process.env.CHATLEGAL_EMBED_BASE_URL = 'http://127.0.0.1:11434/v1'
      const embedded: string[] = []
      const options = {
        embed: async (texts: string[]) => {
          embedded.push(...texts)
          return hashEmbed(texts)
        },
        fetch: (async () => {
          throw new Error('embeddings HTTP should not run when a test embedder is set')
        }) as typeof fetch,
      }
      await disconnectMatterStore()
      try {
        const store = await getMatterStore()
        const own = await createMatter(store, 'user_a', { title: 'Deposit' })
        const foreign = await createMatter(store, 'user_b', { title: 'Secret matter' })
        const letter = await pdfWithText('depositlettertoken in the agreement')
        const reply = docxWithText('wordagreementtoken in the reply')
        const blank = docxWithoutText()
        const broken = Buffer.from('%PDF-1.4 corruptpdfsecret')
        await writeMatterFileBytes('user_a', own.id, 'letter.pdf', letter)
        await writeMatterFileBytes('user_a', own.id, 'reply.docx', reply)
        await writeMatterFileBytes('user_a', own.id, 'blank.docx', blank)
        await writeMatterFileBytes('user_a', own.id, 'broken.pdf', broken)
        await writeMatterFile('user_a', own.id, 'note.md', 'markdownnotetoken on this matter')
        const hiddenPdf = await pdfWithText('zetasecrettoken hidden from the other person')
        await writeMatterFileBytes('user_b', foreign.id, 'hidden.pdf', hiddenPdf)

        const hidden = await prepareWorkspace('user_a', { kind: 'matter', matterId: foreign.id }, undefined, options)
        assert.equal(hidden, null)
        assert.equal(fs.existsSync(embeddingDatabaseFile('user_b', { kind: 'matter', matterId: foreign.id }) ?? ''), false)

        const prepared = await prepareWorkspace('user_a', { kind: 'matter', matterId: own.id }, undefined, options)
        assert.equal(prepared?.enabled, true)
        assert.deepEqual(prepared?.indexed.map((file) => file.name), ['letter.pdf', 'note.md', 'reply.docx'])
        assert.deepEqual(prepared?.skipped, [
          { name: 'blank.docx', reason: FILE_SEARCH_EMPTY_FILE },
          { name: 'broken.pdf', reason: FILE_SEARCH_UNREADABLE },
        ])
        assert.match(prepared?.message ?? '', /Those files are ready to search/)
        assert.match(prepared?.message ?? '', /could not read the words/)
        assert.equal(embedded.some((text) => text.includes('corruptpdfsecret')), false)
        assert.equal(embedded.some((text) => text.includes('depositlettertoken')), true)
        assert.equal(embedded.some((text) => text.includes('wordagreementtoken')), true)
        assert.equal(embedded.some((text) => text.includes('markdownnotetoken')), true)

        const pdfHit = await searchWorkspace('user_a', { kind: 'matter', matterId: own.id }, 'depositlettertoken', options)
        assert.deepEqual(pdfHit?.hits.map((hit) => hit.name), ['letter.pdf'])
        assert.match(pdfHit?.hits[0]?.excerpt ?? '', /depositlettertoken/)
        const wordHit = await searchWorkspace('user_a', { kind: 'matter', matterId: own.id }, 'wordagreementtoken', options)
        assert.deepEqual(wordHit?.hits.map((hit) => hit.name), ['reply.docx'])
        const noteHit = await searchWorkspace('user_a', { kind: 'matter', matterId: own.id }, 'markdownnotetoken', options)
        assert.deepEqual(noteHit?.hits.map((hit) => hit.name), ['note.md'])
        const secretHit = await searchWorkspace('user_a', { kind: 'matter', matterId: own.id }, 'corruptpdfsecret', options)
        assert.deepEqual(secretHit?.hits, [])

        const matterBytes = fs.readFileSync(embeddingDatabaseFile('user_a', { kind: 'matter', matterId: own.id }) ?? '')
        assert.equal(matterBytes.includes(Buffer.from('corruptpdfsecret')), false)
        assert.equal(matterBytes.includes(Buffer.from('zetasecrettoken')), false)
        assert.equal(matterBytes.includes(Buffer.from('depositlettertoken')), true)

        const copied = await copyWorkspaceFile('user_a', {
          name: 'letter.pdf',
          from: { kind: 'matter', matterId: own.id },
          to: { kind: 'user' },
        })
        assert.equal(copied.ok, true)
        const beforeLibrary = await searchWorkspace('user_a', { kind: 'user' }, 'depositlettertoken', options)
        assert.deepEqual(beforeLibrary?.hits, [])
        const library = await prepareWorkspace('user_a', { kind: 'user' }, undefined, options)
        assert.deepEqual(library?.indexed.map((file) => file.name), ['letter.pdf'])
        const libraryHit = await searchWorkspace('user_a', { kind: 'user' }, 'depositlettertoken', options)
        assert.deepEqual(libraryHit?.hits.map((hit) => hit.name), ['letter.pdf'])
        assert.equal(JSON.stringify(libraryHit).includes('zetasecrettoken'), false)
        assert.equal(JSON.stringify(libraryHit).includes('wordagreementtoken'), false)
      } finally {
        await disconnectMatterStore()
        if (previousDb === undefined) delete process.env.CHATLEGAL_MATTERS_DB
        else process.env.CHATLEGAL_MATTERS_DB = previousDb
        if (previousRoot === undefined) delete process.env.CHATLEGAL_WORKSPACE_ROOT
        else process.env.CHATLEGAL_WORKSPACE_ROOT = previousRoot
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
