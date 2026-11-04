import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActiveMatterProvider } from '../../components/shell/active-matter.tsx'
import { MatterFiles } from '../../components/shell/matter-files.tsx'

describe('matter files', () => {
  it('offers Open for a file stored with the matter', () => {
    const html = renderToStaticMarkup(
      createElement(MatterFiles, {
        files: [{ name: 'notice.pdf', size: 12, updatedAt: '2026-11-03T00:00:00.000Z' }],
      }),
    )
    assert.match(html, /data-matter-workspace/)
    assert.match(html, /data-library-scope="matter"/)
    assert.match(html, /data-matter-file="notice.pdf"/)
    assert.match(html, /aria-label="Open notice.pdf"/)
    assert.doesNotMatch(html, /Move to/)
    assert.doesNotMatch(html, /data-matter-upload/)
    const source = fs.readFileSync(new URL('../../components/shell/matter-files.tsx', import.meta.url), 'utf8')
    assert.match(source, /scope: 'matter'/)
    assert.match(source, /openDocument/)
  })

  it('offers an upload when a matter is open', () => {
    const html = renderToStaticMarkup(
      createElement(
        ActiveMatterProvider,
        { matterId: 'matter-1' },
        createElement(MatterFiles, {
          files: [{ name: 'notice.pdf', size: 12, updatedAt: '2026-11-03T00:00:00.000Z' }],
        }),
      ),
    )
    assert.match(html, /data-matter-upload/)
    assert.match(html, /id="matter-file-upload"/)
    assert.match(html, /accept="[^"]*\.pdf[^"]*\.docx[^"]*\.md/)
    assert.match(html, /PDF, Word, or Markdown\. Up to 10 MB\./)
    assert.match(html, /aria-label="Open notice.pdf"/)
    assert.doesNotMatch(html, /Move to|solicitor|drag/i)
    const source = fs.readFileSync(new URL('../../components/shell/matter-files.tsx', import.meta.url), 'utf8')
    const hook = fs.readFileSync(new URL('../../components/shell/use-library.ts', import.meta.url), 'utf8')
    assert.match(source, /uploadMatterFile/)
    assert.match(hook, /\/api\/matters\/\$\{encodeURIComponent\(id\)\}\/files/)
  })

  it('asks for a chat when no matter is open', () => {
    const html = renderToStaticMarkup(createElement(MatterFiles))
    assert.match(html, /Open a chat to see files stored with it/)
    assert.doesNotMatch(html, /aria-label="Open /)
    assert.doesNotMatch(html, /data-matter-upload/)
  })
})
