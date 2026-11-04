import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { withProcessEnvLock } from '../process-env-lock.ts'
import { createMatter, disconnectMatterStore, getMatterStore } from '../matters/store.ts'
import { workspaceContentType } from './content.ts'
import { writeMatterFile, writeUserFile } from './store.ts'

describe('workspace content type', () => {
  it('maps markdown, images, and pdf', () => {
    assert.equal(workspaceContentType('letter.md'), 'text/markdown; charset=utf-8')
    assert.equal(workspaceContentType('photo.PNG'), 'image/png')
    assert.equal(workspaceContentType('scan.jpeg'), 'image/jpeg')
    assert.equal(workspaceContentType('mark.svg'), 'image/svg+xml')
    assert.equal(workspaceContentType('notice.PDF'), 'application/pdf')
    assert.equal(workspaceContentType('notes.txt'), 'text/plain; charset=utf-8')
  })
})

describe('workspace content route', () => {
  it('returns a library file and a matter file, and hides another user', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-content-route-'))
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
        const content = await import('../../app/api/workspace/content/route.ts')
        const store = await getMatterStore()
        const own = await createMatter(store, 'user_test', { title: 'Deposit' })
        const other = await createMatter(store, 'user_b', { title: 'Secret matter' })
        await writeUserFile('user_test', 'letter.md', '# Deposit\n\nBring the agreement.')
        await writeUserFile('user_test', 'mark.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
        await writeUserFile('user_test', 'notice.pdf', '%PDF-1.4')
        await writeMatterFile('user_test', own.id, 'reply.txt', 'A short note.')
        await writeMatterFile('user_b', other.id, 'secret.txt', 'other user secret text')

        const markdown = await content.GET(
          new Request('http://localhost/api/workspace/content?name=letter.md&scope=user'),
        )
        assert.equal(markdown.status, 200)
        assert.match(markdown.headers.get('content-type') ?? '', /text\/markdown/)
        assert.equal(await markdown.text(), '# Deposit\n\nBring the agreement.')

        const image = await content.GET(new Request('http://localhost/api/workspace/content?name=mark.svg&scope=user'))
        assert.equal(image.status, 200)
        assert.equal(image.headers.get('content-type'), 'image/svg+xml')
        assert.match(image.headers.get('content-security-policy') ?? '', /sandbox/)
        assert.match(await image.text(), /<svg/)

        const pdf = await content.GET(new Request('http://localhost/api/workspace/content?name=notice.pdf&scope=user'))
        assert.equal(pdf.status, 200)
        assert.equal(pdf.headers.get('content-type'), 'application/pdf')
        assert.equal(await pdf.text(), '%PDF-1.4')

        const matterFile = await content.GET(
          new Request(
            `http://localhost/api/workspace/content?name=reply.txt&scope=matter&matterId=${encodeURIComponent(own.id)}`,
          ),
        )
        assert.equal(matterFile.status, 200)
        assert.equal(await matterFile.text(), 'A short note.')

        const missing = await content.GET(new Request('http://localhost/api/workspace/content?name=missing.txt&scope=user'))
        assert.equal(missing.status, 404)

        const hidden = await content.GET(
          new Request(
            `http://localhost/api/workspace/content?name=secret.txt&scope=matter&matterId=${encodeURIComponent(other.id)}`,
          ),
        )
        assert.equal(hidden.status, 404)
        const hiddenText = await hidden.text()
        assert.match(hiddenText, /Matter not found/)
        assert.doesNotMatch(hiddenText, /other user secret text|secret\.txt/)

        const escape = await content.GET(
          new Request('http://localhost/api/workspace/content?name=..%2Fsecret.txt&scope=user'),
        )
        assert.equal(escape.status, 400)

        const bare = await content.GET(new Request('http://localhost/api/workspace/content?name=letter.md'))
        assert.equal(bare.status, 400)
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
