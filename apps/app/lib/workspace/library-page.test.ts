import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { withProcessEnvLock } from '../process-env-lock.ts'
import { writeUserFile } from './store.ts'
import { UserWorkspace } from '../../components/shell/user-workspace.tsx'

type PageComponent = () => Promise<ReactElement>

describe('library page', () => {
  it('loads the signed-in user library and hides another user', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-library-page-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousRoot = process.env.CHATLEGAL_WORKSPACE_ROOT
      const previousSession = process.env.CHATLEGAL_TEST_SESSION
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_WORKSPACE_ROOT = path.join(dir, 'workspace')
      process.env.CHATLEGAL_TEST_SESSION = 'signed-in'
      try {
        await writeUserFile('user_test', 'notice.txt', 'Bring the agreement.')
        await writeUserFile('user_b', 'secret.txt', 'other user secret text')
        const { default: page } = (await import('../../app/(app)/library/page.tsx')) as { default: PageComponent }
        const html = renderToStaticMarkup(await page())
        assert.match(html, /data-user-workspace/)
        assert.match(html, /data-library-file="notice.txt"/)
        assert.match(html, /data-library-scope="user"/)
        assert.match(html, /Add a file/)
        assert.match(html, /Select a file from the list to see it/)
        assert.doesNotMatch(html, /secret\.txt|other user secret text|Move to this matter|Move to library/)
        assert.doesNotMatch(html, /Bring the agreement/)
      } finally {
        if (previousDb === undefined) delete process.env.CHATLEGAL_MATTERS_DB
        else process.env.CHATLEGAL_MATTERS_DB = previousDb
        if (previousRoot === undefined) delete process.env.CHATLEGAL_WORKSPACE_ROOT
        else process.env.CHATLEGAL_WORKSPACE_ROOT = previousRoot
        if (previousSession === undefined) delete process.env.CHATLEGAL_TEST_SESSION
        else process.env.CHATLEGAL_TEST_SESSION = previousSession
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it('shows a library file in the workspace and keeps the add form there', () => {
    const html = renderToStaticMarkup(
      createElement(UserWorkspace, {
        initialFiles: [{ name: 'notice.txt', size: 22, updatedAt: '2026-11-03T00:00:00.000Z' }],
      }),
    )
    assert.match(html, /data-library-file="notice.txt"/)
    assert.match(html, /id="library-file-name"/)
    assert.match(html, /Select a file from the list to see it/)
    assert.doesNotMatch(html, /Move to/)
    assert.doesNotMatch(html, /aria-label="Open notice.txt"/)
  })

  it('opens a selected library file on request without showing its text', () => {
    const html = renderToStaticMarkup(
      createElement(UserWorkspace, {
        initialFiles: [{ name: 'notice.txt', size: 22, updatedAt: '2026-11-03T00:00:00.000Z' }],
        initialSelectedName: 'notice.txt',
      }),
    )
    assert.match(html, /data-library-open="notice.txt"/)
    assert.match(html, /aria-label="Open notice.txt"/)
    assert.match(html, /22 bytes/)
    assert.doesNotMatch(html, /Select a file from the list to see it/)
    assert.doesNotMatch(html, /This file is open in the viewer/)
    const source = fs.readFileSync(new URL('../../components/shell/user-workspace.tsx', import.meta.url), 'utf8')
    assert.match(source, /openDocument/)
  })
})
