import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createMatter, createMatterStore, type MatterStore } from '../matters/store.ts'
import { matterWorkspaceDir, userLibraryDir, workspaceRoot, WorkspaceConflictError, WorkspacePathError } from './paths.ts'
import {
  listMatterFiles,
  listUserFiles,
  moveWorkspaceFile,
  readMatterFile,
  readMatterFileBytes,
  readUserFile,
  writeMatterFile,
  writeMatterFileBytes,
  writeUserFile,
  type WorkspaceStoreOptions,
} from './store.ts'
import {
  sanitizeUploadFileName,
  UPLOAD_EMPTY_ERROR,
  UPLOAD_FORM_OVERHEAD_BYTES,
  UPLOAD_SIZE_ERROR,
  UPLOAD_TYPE_ERROR,
  uploadBodyTooLarge,
  uploadRejection,
  WORKSPACE_MAX_UPLOAD_BYTES,
} from './upload-policy.ts'

async function withFixture(run: (options: WorkspaceStoreOptions) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-workspace-'))
  const env = { CHATLEGAL_WORKSPACE_ROOT: path.join(dir, 'workspace') } as NodeJS.ProcessEnv
  let matters: MatterStore | null = null
  try {
    matters = await createMatterStore(`file:${path.join(dir, 'matters.db')}`, { env: {} })
    await run({ env, matters })
  } finally {
    await matters?.close()
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('upload policy', () => {
  it('accepts PDF, Word, and Markdown up to 10 MB', () => {
    assert.equal(WORKSPACE_MAX_UPLOAD_BYTES, 10_485_760)
    assert.equal(uploadRejection('letter.pdf', 12), null)
    assert.equal(uploadRejection('letter.md', 12), null)
    assert.equal(uploadRejection('Letter.DOCX', 12), null)
    assert.equal(uploadRejection('notes.txt', 12), UPLOAD_TYPE_ERROR)
    assert.equal(uploadRejection('photo.png', 12), UPLOAD_TYPE_ERROR)
    assert.equal(uploadRejection('letter.pdf', 0), UPLOAD_EMPTY_ERROR)
    assert.equal(uploadRejection('letter.pdf', WORKSPACE_MAX_UPLOAD_BYTES + 1), UPLOAD_SIZE_ERROR)
    assert.equal(sanitizeUploadFileName('Council letter.pdf'), 'Council-letter.pdf')
    assert.equal(sanitizeUploadFileName('../escape.pdf'), 'escape.pdf')
    assert.equal(sanitizeUploadFileName('folder\\note.md'), 'note.md')
    assert.equal(sanitizeUploadFileName('.pdf'), 'pdf')
    assert.equal(uploadRejection('pdf', 12), UPLOAD_TYPE_ERROR)
    assert.equal(uploadBodyTooLarge(String(WORKSPACE_MAX_UPLOAD_BYTES + UPLOAD_FORM_OVERHEAD_BYTES + 1)), true)
    assert.equal(uploadBodyTooLarge(String(WORKSPACE_MAX_UPLOAD_BYTES + 100)), false)
    assert.equal(uploadBodyTooLarge(null), false)
  })
})

describe('workspace root', () => {
  it('defaults to data/workspace and accepts the host directory', () => {
    const fallback = workspaceRoot({} as NodeJS.ProcessEnv)
    assert.match(fallback, /data\/workspace$/)
    assert.equal(workspaceRoot({ CHATLEGAL_WORKSPACE_ROOT: '/var/lib/chatlegal/workspace' }), '/var/lib/chatlegal/workspace')
    assert.equal(
      workspaceRoot({ CHATLEGAL_WORKSPACE_ROOT: 'file:/var/lib/chatlegal/workspace' }),
      '/var/lib/chatlegal/workspace',
    )
    assert.throws(
      () => workspaceRoot({ CHATLEGAL_WORKSPACE_ROOT: 'libsql://files.example' }),
      WorkspacePathError,
    )
  })
})

describe('mastra workspace files', () => {
  it('keeps the user library apart from each matter workspace', async () => {
    await withFixture(async (options) => {
      const first = await createMatter(options.matters!, 'user_a', { title: 'Deposit' })
      const second = await createMatter(options.matters!, 'user_a', { title: 'Parking' })
      await writeUserFile('user_a', 'library.txt', 'library secret', options)
      await writeMatterFile('user_a', first.id, 'matter.txt', 'matter secret', options)
      await writeMatterFile('user_a', second.id, 'parking.txt', 'parking secret', options)

      assert.deepEqual(
        (await listUserFiles('user_a', options)).map((file) => file.name),
        ['library.txt'],
      )
      assert.equal(await readUserFile('user_a', 'library.txt', options), 'library secret')
      assert.deepEqual(await listUserFiles('user_b', options), [])

      const own = await listMatterFiles('user_a', first.id, options)
      assert.deepEqual(own?.map((file) => file.name), ['matter.txt'])
      assert.equal(await readMatterFile('user_a', first.id, 'matter.txt', options), 'matter secret')
      assert.deepEqual((await listMatterFiles('user_a', second.id, options))?.map((file) => file.name), ['parking.txt'])
      assert.equal(await listMatterFiles('user_b', first.id, options), null)
      assert.equal(await writeMatterFile('user_b', first.id, 'stolen.txt', 'nope', options), null)

      const libraryDir = userLibraryDir('user_a', options.env)
      const matterDir = matterWorkspaceDir('user_a', first.id, options.env)
      assert.deepEqual(fs.readdirSync(libraryDir), ['library.txt'])
      assert.deepEqual(fs.readdirSync(matterDir), ['matter.txt'])
      assert.equal(fs.existsSync(matterWorkspaceDir('user_b', first.id, options.env)), false)
    })
  })

  it('moves a file from the library to a matter and back', async () => {
    await withFixture(async (options) => {
      const matter = await createMatter(options.matters!, 'user_a', { title: 'Deposit' })
      await writeUserFile('user_a', 'notice.txt', 'Bring the agreement.', options)

      const toMatter = await moveWorkspaceFile(
        'user_a',
        { name: 'notice.txt', from: { kind: 'user' }, to: { kind: 'matter', matterId: matter.id } },
        options,
      )
      assert.equal(toMatter.ok, true)
      if (!toMatter.ok) return
      assert.equal(toMatter.file.name, 'notice.txt')
      assert.deepEqual(await listUserFiles('user_a', options), [])
      assert.equal(await readMatterFile('user_a', matter.id, 'notice.txt', options), 'Bring the agreement.')

      const toLibrary = await moveWorkspaceFile(
        'user_a',
        { name: 'notice.txt', from: { kind: 'matter', matterId: matter.id }, to: { kind: 'user' } },
        options,
      )
      assert.equal(toLibrary.ok, true)
      assert.equal(await readUserFile('user_a', 'notice.txt', options), 'Bring the agreement.')
      assert.deepEqual(await listMatterFiles('user_a', matter.id, options), [])
    })
  })

  it('refuses another user and leaves both copies when the name is taken', async () => {
    await withFixture(async (options) => {
      const own = await createMatter(options.matters!, 'user_a', { title: 'Deposit' })
      const other = await createMatter(options.matters!, 'user_b', { title: 'Secret matter' })
      await writeUserFile('user_a', 'notice.txt', 'Bring the agreement.', options)
      await writeMatterFile('user_b', other.id, 'secret.txt', 'other user secret text', options)
      await writeMatterFile('user_a', own.id, 'notice.txt', 'already in the matter', options)

      const stolen = await moveWorkspaceFile(
        'user_a',
        { name: 'secret.txt', from: { kind: 'matter', matterId: other.id }, to: { kind: 'user' } },
        options,
      )
      assert.deepEqual(stolen, { ok: false, reason: 'matter' })
      assert.equal(await readMatterFile('user_b', other.id, 'secret.txt', options), 'other user secret text')
      assert.equal(await readUserFile('user_a', 'secret.txt', options), null)
      assert.equal(await listMatterFiles('user_a', other.id, options), null)

      const conflict = await moveWorkspaceFile(
        'user_a',
        { name: 'notice.txt', from: { kind: 'user' }, to: { kind: 'matter', matterId: own.id } },
        options,
      )
      assert.deepEqual(conflict, { ok: false, reason: 'conflict' })
      assert.equal(await readUserFile('user_a', 'notice.txt', options), 'Bring the agreement.')
      assert.equal(await readMatterFile('user_a', own.id, 'notice.txt', options), 'already in the matter')
    })
  })

  it('rejects a path that would leave the workspace', async () => {
    await withFixture(async (options) => {
      const root = workspaceRoot(options.env)
      await assert.rejects(writeUserFile('user_a', '../escape.txt', 'nope', options), WorkspacePathError)
      await assert.rejects(writeUserFile('user_a', 'nested/file.txt', 'nope', options), WorkspacePathError)
      assert.equal(fs.existsSync(path.join(root, 'escape.txt')), false)
      assert.deepEqual(await listUserFiles('user_a', options), [])
    })
  })

  it('stores an uploaded PDF and Word document as the original bytes', async () => {
    await withFixture(async (options) => {
      const matter = await createMatter(options.matters!, 'user_a', { title: 'Deposit' })
      const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff, 0xfe])
      const docx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0xff])
      const markdown = Buffer.from('# Deposit\n\nBring the agreement.\n', 'utf8')

      const storedPdf = await writeMatterFileBytes('user_a', matter.id, 'Council letter.PDF', pdf, options)
      assert.equal(storedPdf?.name, 'Council-letter.PDF')
      assert.equal(storedPdf?.size, pdf.length)
      assert.deepEqual(await readMatterFileBytes('user_a', matter.id, 'Council-letter.PDF', options), pdf)

      const storedDocx = await writeMatterFileBytes('user_a', matter.id, 'reply.docx', docx, options)
      assert.equal(storedDocx?.name, 'reply.docx')
      assert.deepEqual(await readMatterFileBytes('user_a', matter.id, 'reply.docx', options), docx)

      const storedMd = await writeMatterFileBytes('user_a', matter.id, 'note.md', markdown, options)
      assert.equal(await readMatterFile('user_a', matter.id, 'note.md', options), '# Deposit\n\nBring the agreement.\n')

      const names = (await listMatterFiles('user_a', matter.id, options))?.map((file) => file.name)
      assert.deepEqual(names, ['Council-letter.PDF', 'note.md', 'reply.docx'])

      await assert.rejects(
        writeMatterFileBytes('user_a', matter.id, 'Council letter.PDF', pdf, options),
        WorkspaceConflictError,
      )
      await assert.rejects(
        writeMatterFileBytes('user_a', matter.id, 'photo.png', Buffer.from([1, 2, 3]), options),
        (error: unknown) => error instanceof WorkspacePathError && error.message === UPLOAD_TYPE_ERROR,
      )
      await assert.rejects(
        writeMatterFileBytes('user_a', matter.id, 'big.pdf', Buffer.alloc(WORKSPACE_MAX_UPLOAD_BYTES + 1, 0x25), options),
        (error: unknown) => error instanceof WorkspacePathError && error.message === UPLOAD_SIZE_ERROR,
      )
      assert.equal(await writeMatterFileBytes('user_b', matter.id, 'stolen.pdf', pdf, options), null)

      const matterDir = matterWorkspaceDir('user_a', matter.id, options.env)
      assert.deepEqual(fs.readdirSync(matterDir).sort(), ['Council-letter.PDF', 'note.md', 'reply.docx'])
      assert.equal(fs.existsSync(path.join(workspaceRoot(options.env), 'stolen.pdf')), false)
      assert.equal(fs.existsSync(path.join(workspaceRoot(options.env), 'photo.png')), false)
    })
  })

  it('leaves workspace tools off', () => {
    const source = fs.readFileSync(new URL('./store.ts', import.meta.url), 'utf8')
    assert.match(source, /new Workspace\(/)
    assert.match(source, /new LocalFilesystem\(/)
    assert.match(source, /contained:\s*true/)
    assert.match(source, /tools:\s*\{\s*enabled:\s*false\s*\}/)
    assert.doesNotMatch(source, /new LocalSandbox|bm25:\s*true|vectorStore|observationalMemory:\s*true/)
  })
})
