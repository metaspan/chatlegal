import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { withProcessEnvLock } from '../process-env-lock.ts'
import { createMatter, disconnectMatterStore, getMatterStore } from '../matters/store.ts'
import { readMatterFile, readMatterFileBytes, readUserFile, readUserFileBytes, writeMatterFile } from './store.ts'

describe('workspace routes', () => {
  it('moves a file between the library and a matter, and hides another user', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-workspace-route-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousRoot = process.env.CHATLEGAL_WORKSPACE_ROOT
      const previousSession = process.env.CHATLEGAL_TEST_SESSION
      const previousOm = process.env.CHATLEGAL_OM_ENABLED
      const previousModel = process.env.CHATLEGAL_OM_MODEL
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_WORKSPACE_ROOT = path.join(dir, 'workspace')
      process.env.CHATLEGAL_TEST_SESSION = 'signed-in'
      delete process.env.CHATLEGAL_OM_ENABLED
      delete process.env.CHATLEGAL_OM_MODEL
      await disconnectMatterStore()
      try {
        const library = await import('../../app/api/library/route.ts')
        const matterFiles = await import('../../app/api/matters/[matterId]/files/route.ts')
        const move = await import('../../app/api/workspace/move/route.ts')
        const store = await getMatterStore()
        const own = await createMatter(store, 'user_test', { title: 'Deposit' })
        const other = await createMatter(store, 'user_b', { title: 'Secret matter' })
        await writeMatterFile('user_b', other.id, 'secret.txt', 'other user secret text')

        const added = await library.POST(
          new Request('http://localhost/api/library', {
            method: 'POST',
            body: JSON.stringify({ name: 'notice.txt', text: 'Bring the agreement.' }),
          }),
        )
        assert.equal(added.status, 201)

        const listed = await library.GET()
        assert.equal(listed.status, 200)
        const libraryBody = (await listed.json()) as { files: { name: string }[] }
        assert.deepEqual(libraryBody.files.map((file) => file.name), ['notice.txt'])

        const before = await matterFiles.GET(new Request('http://localhost/api/matters/' + own.id + '/files'), {
          params: Promise.resolve({ matterId: own.id }),
        })
        assert.equal(before.status, 200)
        assert.deepEqual(((await before.json()) as { files: unknown[] }).files, [])

        const moved = await move.POST(
          new Request('http://localhost/api/workspace/move', {
            method: 'POST',
            body: JSON.stringify({
              name: 'notice.txt',
              from: { kind: 'user' },
              to: { kind: 'matter', matterId: own.id },
            }),
          }),
        )
        assert.equal(moved.status, 200)
        assert.deepEqual(((await library.GET().then((response) => response.json())) as { files: unknown[] }).files, [])
        const inMatter = await matterFiles.GET(new Request('http://localhost/api/matters/' + own.id + '/files'), {
          params: Promise.resolve({ matterId: own.id }),
        })
        assert.deepEqual(
          ((await inMatter.json()) as { files: { name: string }[] }).files.map((file) => file.name),
          ['notice.txt'],
        )
        assert.equal(await readMatterFile('user_test', own.id, 'notice.txt'), 'Bring the agreement.')

        const back = await move.POST(
          new Request('http://localhost/api/workspace/move', {
            method: 'POST',
            body: JSON.stringify({
              name: 'notice.txt',
              from: { kind: 'matter', matterId: own.id },
              to: { kind: 'user' },
            }),
          }),
        )
        assert.equal(back.status, 200)
        assert.equal(await readUserFile('user_test', 'notice.txt'), 'Bring the agreement.')
        assert.deepEqual(await readMatterFile('user_test', own.id, 'notice.txt'), null)

        const attached = await move.POST(
          new Request('http://localhost/api/workspace/move', {
            method: 'POST',
            body: JSON.stringify({
              name: 'notice.txt',
              from: { kind: 'user' },
              to: { kind: 'matter', matterId: own.id },
              mode: 'copy',
            }),
          }),
        )
        assert.equal(attached.status, 200)
        assert.equal(await readUserFile('user_test', 'notice.txt'), 'Bring the agreement.')
        assert.equal(await readMatterFile('user_test', own.id, 'notice.txt'), 'Bring the agreement.')

        const hidden = await matterFiles.GET(new Request('http://localhost/api/matters/' + other.id + '/files'), {
          params: Promise.resolve({ matterId: other.id }),
        })
        assert.equal(hidden.status, 404)
        const hiddenText = await hidden.text()
        assert.match(hiddenText, /Matter not found/)
        assert.doesNotMatch(hiddenText, /secret\.txt|other user secret text|Secret matter/)

        const stolen = await move.POST(
          new Request('http://localhost/api/workspace/move', {
            method: 'POST',
            body: JSON.stringify({
              name: 'secret.txt',
              from: { kind: 'matter', matterId: other.id },
              to: { kind: 'user' },
            }),
          }),
        )
        assert.equal(stolen.status, 404)
        const stolenText = await stolen.text()
        assert.match(stolenText, /Matter not found/)
        assert.doesNotMatch(stolenText, /other user secret text/)
        assert.equal(await readUserFile('user_test', 'secret.txt'), null)
        assert.equal(await readMatterFile('user_b', other.id, 'secret.txt'), 'other user secret text')

        const bad = await library.POST(
          new Request('http://localhost/api/library', {
            method: 'POST',
            body: JSON.stringify({ name: '../escape.txt', text: 'nope' }),
          }),
        )
        assert.equal(bad.status, 400)
        assert.equal(fs.existsSync(path.join(dir, 'workspace', 'escape.txt')), false)

        const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x00, 0xff])
        const uploadForm = new FormData()
        uploadForm.append('file', new File([pdf], 'Council letter.PDF', { type: 'application/pdf' }))
        const uploaded = await matterFiles.POST(
          new Request('http://localhost/api/matters/' + own.id + '/files', { method: 'POST', body: uploadForm }),
          { params: Promise.resolve({ matterId: own.id }) },
        )
        assert.equal(uploaded.status, 201)
        const uploadedBody = (await uploaded.json()) as { file: { name: string; size: number } }
        assert.equal(uploadedBody.file.name, 'Council-letter.PDF')
        assert.equal(uploadedBody.file.size, pdf.length)
        assert.deepEqual(await readMatterFileBytes('user_test', own.id, 'Council-letter.PDF'), pdf)

        const copied = await move.POST(
          new Request('http://localhost/api/workspace/move', {
            method: 'POST',
            body: JSON.stringify({
              name: 'Council-letter.PDF',
              from: { kind: 'matter', matterId: own.id },
              to: { kind: 'user' },
              mode: 'copy',
            }),
          }),
        )
        assert.equal(copied.status, 200)
        assert.deepEqual(await readUserFileBytes('user_test', 'Council-letter.PDF'), pdf)
        assert.deepEqual(await readMatterFileBytes('user_test', own.id, 'Council-letter.PDF'), pdf)

        const copiedAgain = await move.POST(
          new Request('http://localhost/api/workspace/move', {
            method: 'POST',
            body: JSON.stringify({
              name: 'Council-letter.PDF',
              from: { kind: 'matter', matterId: own.id },
              to: { kind: 'user' },
              mode: 'copy',
            }),
          }),
        )
        assert.equal(copiedAgain.status, 409)

        const badMode = await move.POST(
          new Request('http://localhost/api/workspace/move', {
            method: 'POST',
            body: JSON.stringify({
              name: 'Council-letter.PDF',
              from: { kind: 'user' },
              to: { kind: 'matter', matterId: own.id },
              mode: 'link',
            }),
          }),
        )
        assert.equal(badMode.status, 400)
        assert.match(await badMode.text(), /move or copy/)

        const afterUpload = await matterFiles.GET(new Request('http://localhost/api/matters/' + own.id + '/files'), {
          params: Promise.resolve({ matterId: own.id }),
        })
        assert.deepEqual(
          ((await afterUpload.json()) as { files: { name: string }[] }).files.map((file) => file.name),
          ['Council-letter.PDF', 'notice.txt'],
        )

        const textForm = new FormData()
        textForm.append('file', new File([Buffer.from('hello')], 'notes.txt', { type: 'text/plain' }))
        const rejected = await matterFiles.POST(
          new Request('http://localhost/api/matters/' + own.id + '/files', { method: 'POST', body: textForm }),
          { params: Promise.resolve({ matterId: own.id }) },
        )
        assert.equal(rejected.status, 400)
        const rejectedText = await rejected.text()
        assert.match(rejectedText, /PDF, Word document, or Markdown/)
        assert.equal(await readMatterFile('user_test', own.id, 'notes.txt'), null)

        const emptyForm = new FormData()
        emptyForm.append('file', new File([], 'empty.pdf', { type: 'application/pdf' }))
        const empty = await matterFiles.POST(
          new Request('http://localhost/api/matters/' + own.id + '/files', { method: 'POST', body: emptyForm }),
          { params: Promise.resolve({ matterId: own.id }) },
        )
        assert.equal(empty.status, 400)
        assert.match(await empty.text(), /empty/)

        const again = new FormData()
        again.append('file', new File([pdf], 'Council-letter.PDF', { type: 'application/pdf' }))
        const conflict = await matterFiles.POST(
          new Request('http://localhost/api/matters/' + own.id + '/files', { method: 'POST', body: again }),
          { params: Promise.resolve({ matterId: own.id }) },
        )
        assert.equal(conflict.status, 409)

        const stolenForm = new FormData()
        stolenForm.append('file', new File([pdf], 'notice.pdf', { type: 'application/pdf' }))
        const stolenUpload = await matterFiles.POST(
          new Request('http://localhost/api/matters/' + other.id + '/files', { method: 'POST', body: stolenForm }),
          { params: Promise.resolve({ matterId: other.id }) },
        )
        assert.equal(stolenUpload.status, 404)
        assert.match(await stolenUpload.text(), /Matter not found/)
        assert.equal(await readMatterFileBytes('user_b', other.id, 'notice.pdf'), null)
        assert.equal(fs.existsSync(path.join(dir, 'workspace', 'notice.pdf')), false)

        const docx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0xfe])
        const docxForm = new FormData()
        docxForm.append('file', new File([docx], 'reply.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
        const docxUpload = await matterFiles.POST(
          new Request('http://localhost/api/matters/' + own.id + '/files', { method: 'POST', body: docxForm }),
          { params: Promise.resolve({ matterId: own.id }) },
        )
        assert.equal(docxUpload.status, 201)
        assert.deepEqual(await readMatterFileBytes('user_test', own.id, 'reply.docx'), docx)
      } finally {
        await disconnectMatterStore()
        if (previousDb === undefined) delete process.env.CHATLEGAL_MATTERS_DB
        else process.env.CHATLEGAL_MATTERS_DB = previousDb
        if (previousRoot === undefined) delete process.env.CHATLEGAL_WORKSPACE_ROOT
        else process.env.CHATLEGAL_WORKSPACE_ROOT = previousRoot
        if (previousSession === undefined) delete process.env.CHATLEGAL_TEST_SESSION
        else process.env.CHATLEGAL_TEST_SESSION = previousSession
        if (previousOm === undefined) delete process.env.CHATLEGAL_OM_ENABLED
        else process.env.CHATLEGAL_OM_ENABLED = previousOm
        if (previousModel === undefined) delete process.env.CHATLEGAL_OM_MODEL
        else process.env.CHATLEGAL_OM_MODEL = previousModel
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })
  })
})
