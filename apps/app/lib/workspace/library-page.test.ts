import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { withProcessEnvLock } from '../process-env-lock.ts'
import { writeUserFile } from './store.ts'
import { ActiveMatterProvider } from '../../components/shell/active-matter.tsx'
import { UserWorkspace } from '../../components/shell/user-workspace.tsx'

type PageComponent = () => Promise<ReactElement>

describe('library page', () => {
  it('loads the signed-in user library and hides another user', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-library-page-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousRoot = process.env.CHATLEGAL_WORKSPACE_ROOT
      const previousSession = process.env.CHATLEGAL_TEST_SESSION
      const previousEmbed = process.env.CHATLEGAL_EMBED_ENABLED
      const previousEmbedModel = process.env.CHATLEGAL_EMBED_MODEL
      const previousEmbedUrl = process.env.CHATLEGAL_EMBED_BASE_URL
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_WORKSPACE_ROOT = path.join(dir, 'workspace')
      process.env.CHATLEGAL_TEST_SESSION = 'signed-in'
      delete process.env.CHATLEGAL_EMBED_ENABLED
      delete process.env.CHATLEGAL_EMBED_MODEL
      delete process.env.CHATLEGAL_EMBED_BASE_URL
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
        assert.match(html, /data-file-search="off"/)
        assert.match(html, /Search across the words in your files is turned off/)
        assert.doesNotMatch(html, /Read these files for search|Search the words/)
      } finally {
        if (previousDb === undefined) delete process.env.CHATLEGAL_MATTERS_DB
        else process.env.CHATLEGAL_MATTERS_DB = previousDb
        if (previousRoot === undefined) delete process.env.CHATLEGAL_WORKSPACE_ROOT
        else process.env.CHATLEGAL_WORKSPACE_ROOT = previousRoot
        if (previousSession === undefined) delete process.env.CHATLEGAL_TEST_SESSION
        else process.env.CHATLEGAL_TEST_SESSION = previousSession
        if (previousEmbed === undefined) delete process.env.CHATLEGAL_EMBED_ENABLED
        else process.env.CHATLEGAL_EMBED_ENABLED = previousEmbed
        if (previousEmbedModel === undefined) delete process.env.CHATLEGAL_EMBED_MODEL
        else process.env.CHATLEGAL_EMBED_MODEL = previousEmbedModel
        if (previousEmbedUrl === undefined) delete process.env.CHATLEGAL_EMBED_BASE_URL
        else process.env.CHATLEGAL_EMBED_BASE_URL = previousEmbedUrl
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
    assert.match(html, /Open a chat to add this file to a matter/)
    assert.doesNotMatch(html, /Add notice.txt to this matter/)
    assert.doesNotMatch(html, /Select a file from the list to see it/)
    assert.doesNotMatch(html, /This file is open in the viewer/)
    const source = fs.readFileSync(new URL('../../components/shell/user-workspace.tsx', import.meta.url), 'utf8')
    assert.match(source, /openDocument/)
    assert.match(source, /attachToMatter/)
  })

  it('can add or move a selected library file onto the open matter', () => {
    const html = renderToStaticMarkup(
      createElement(
        ActiveMatterProvider,
        { matterId: 'matter-1' },
        createElement(UserWorkspace, {
          initialFiles: [{ name: 'notice.txt', size: 22, updatedAt: '2026-11-03T00:00:00.000Z' }],
          initialSelectedName: 'notice.txt',
        }),
      ),
    )
    assert.match(html, /aria-label="Open notice.txt"/)
    assert.match(html, /aria-label="Add notice.txt to this matter"/)
    assert.match(html, /aria-label="Move notice.txt to this matter"/)
    assert.match(html, /Add keeps this file in your library and puts a copy on the open matter/)
    assert.doesNotMatch(html, /Open a chat to add this file to a matter/)
    assert.doesNotMatch(html, /solicitor|claimant|defendant/i)
    const source = fs.readFileSync(new URL('../../components/shell/user-workspace.tsx', import.meta.url), 'utf8')
    assert.match(source, /scope: 'user'/)
    assert.match(source, /openDocument/)
  })
})
