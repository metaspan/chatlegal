import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  EMBED_CHUNK_CHARS,
  EMBED_MAX_CHUNKS,
  chunkWorkspaceText,
  isExtractableFileName,
  isIndexableFileName,
  isPlainTextFileName,
} from './chunk.ts'
import { embedBaseUrl, embeddingConfig, embeddingsEndpoint } from './config.ts'
import { embeddingDatabaseFile } from './paths.ts'

const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('embedding config', () => {
  it('stays off unless enabled, model, and base URL are all set', () => {
    assert.equal(embeddingConfig({}), false)
    assert.equal(embeddingConfig({ CHATLEGAL_EMBED_ENABLED: 'false' }), false)
    assert.equal(embeddingConfig({ CHATLEGAL_EMBED_ENABLED: '1', CHATLEGAL_EMBED_MODEL: 'local-embed', CHATLEGAL_EMBED_BASE_URL: 'http://127.0.0.1:11434/v1' }), false)
    assert.equal(embeddingConfig({ CHATLEGAL_EMBED_ENABLED: 'true' }), false)
    assert.equal(embeddingConfig({ CHATLEGAL_EMBED_ENABLED: 'true', CHATLEGAL_EMBED_MODEL: '  ' }), false)
    assert.equal(
      embeddingConfig({ CHATLEGAL_EMBED_ENABLED: 'true', CHATLEGAL_EMBED_MODEL: 'local-embed' }),
      false,
    )
    assert.equal(
      embeddingConfig({
        CHATLEGAL_EMBED_ENABLED: 'true',
        CHATLEGAL_EMBED_MODEL: 'local-embed',
        CHATLEGAL_EMBED_BASE_URL: 'file:/tmp/embed',
      }),
      false,
    )
    assert.equal(
      embeddingConfig({
        CHATLEGAL_EMBED_ENABLED: 'true',
        CHATLEGAL_EMBED_MODEL: 'local-embed',
        CHATLEGAL_EMBED_BASE_URL: 'http://user:secret@127.0.0.1/v1',
      }),
      false,
    )
    assert.equal(
      embeddingConfig({
        CHATLEGAL_EMBED_ENABLED: 'true',
        CHATLEGAL_EMBED_MODEL: 'local-embed',
        CHATLEGAL_EMBED_BASE_URL: 'http://127.0.0.1/v1?key=secret',
      }),
      false,
    )
    assert.equal(embedBaseUrl('libsql://vectors.example'), null)
    assert.deepEqual(
      embeddingConfig({
        CHATLEGAL_EMBED_ENABLED: ' true ',
        CHATLEGAL_EMBED_MODEL: ' local-embed ',
        CHATLEGAL_EMBED_BASE_URL: ' http://127.0.0.1:11434/v1/ ',
        CHATLEGAL_MATTERS_DB: 'file:/var/lib/chatlegal/matters.db',
        CHATLEGAL_WORKSPACE_ROOT: '/var/lib/chatlegal/workspace',
      }),
      { model: 'local-embed', baseUrl: 'http://127.0.0.1:11434/v1' },
    )
    assert.equal(embeddingsEndpoint('http://127.0.0.1:11434/v1'), 'http://127.0.0.1:11434/v1/embeddings')
    assert.equal(embeddingsEndpoint('http://127.0.0.1:11434/v1/embeddings'), 'http://127.0.0.1:11434/v1/embeddings')
  })

  it('keeps the vector file under the workspace root, beside the library and the matter', () => {
    const env = { CHATLEGAL_WORKSPACE_ROOT: '/var/lib/chatlegal/workspace' } as NodeJS.ProcessEnv
    assert.equal(
      embeddingDatabaseFile('user_a', { kind: 'user' }, env),
      '/var/lib/chatlegal/workspace/users/user_a/index/library.db',
    )
    assert.equal(
      embeddingDatabaseFile('user_a', { kind: 'matter', matterId: 'matter_1' }, env),
      '/var/lib/chatlegal/workspace/users/user_a/index/matters/matter_1.db',
    )
    assert.equal(embeddingDatabaseFile('../user_b', { kind: 'user' }, env), null)
    assert.equal(embeddingDatabaseFile('user_a', { kind: 'matter', matterId: '../library' }, env), null)
    const source = fs.readFileSync(new URL('./paths.ts', import.meta.url), 'utf8')
    assert.match(source, /workspaceRoot/)
    assert.doesNotMatch(source, /mattersDatabaseUrl/)
  })

  it('chunks text and treats PDF and Word as files search can read', () => {
    assert.deepEqual(chunkWorkspaceText('  Bring the agreement.  '), {
      chunks: ['Bring the agreement.'],
      truncated: false,
    })
    assert.deepEqual(chunkWorkspaceText('   \n'), { chunks: [], truncated: false })
    const long = 'a'.repeat(EMBED_CHUNK_CHARS * (EMBED_MAX_CHUNKS + 2))
    const chunked = chunkWorkspaceText(long)
    assert.equal(chunked.chunks.length, EMBED_MAX_CHUNKS)
    assert.equal(chunked.truncated, true)
    assert.equal(isPlainTextFileName('note.md'), true)
    assert.equal(isPlainTextFileName('letter.txt'), true)
    assert.equal(isPlainTextFileName('note.markdown'), true)
    assert.equal(isPlainTextFileName('scan.pdf'), false)
    assert.equal(isExtractableFileName('scan.pdf'), true)
    assert.equal(isExtractableFileName('reply.DOCX'), true)
    assert.equal(isExtractableFileName('note.md'), false)
    assert.equal(isIndexableFileName('note.md'), true)
    assert.equal(isIndexableFileName('scan.PDF'), true)
    assert.equal(isIndexableFileName('reply.docx'), true)
    assert.equal(isIndexableFileName('photo.png'), false)
    const source = fs.readFileSync(new URL('./chunk.ts', import.meta.url), 'utf8')
    assert.match(source, /no text layer/)
    assert.doesNotMatch(source, /TODO\(D-03 extract\)/)
  })

  it('does not wire chat, Concierge, or the matters database', () => {
    const messages = fs.readFileSync(path.join(appDir, 'app/api/matters/[matterId]/messages/route.ts'), 'utf8')
    const column = fs.readFileSync(path.join(appDir, 'components/chat/chat-column.tsx'), 'utf8')
    const composer = fs.readFileSync(path.join(appDir, 'components/chat/composer/composer.tsx'), 'utf8')
    const matters = fs.readFileSync(path.join(appDir, 'lib/matters/store.ts'), 'utf8')
    const embedder = fs.readFileSync(path.join(appDir, 'lib/embeddings/embed.ts'), 'utf8')
    const index = fs.readFileSync(path.join(appDir, 'lib/embeddings/index.ts'), 'utf8')
    assert.doesNotMatch(messages, /embeddings|CHATLEGAL_EMBED|prepareWorkspace|searchWorkspace/)
    assert.doesNotMatch(column, /embeddings|CHATLEGAL_EMBED|file-search/)
    assert.doesNotMatch(composer, /embeddings|CHATLEGAL_EMBED|file-search/)
    assert.match(matters, /semanticRecall:\s*false/)
    assert.doesNotMatch(matters, /LibSQLVector|CHATLEGAL_EMBED|prepareWorkspace/)
    assert.match(index, /TODO\(D-04\)/)
    assert.match(index, /TODO\(G-00\)/)
    assert.doesNotMatch(embedder, /CHATLEGAL_MATTERS_DB|Authorization|api[_-]?key|generateText|streamText|TaskRunner/i)
  })
})
