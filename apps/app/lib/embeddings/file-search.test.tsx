import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it } from 'node:test'
import { FileSearch } from '../../components/shell/file-search.tsx'
import { FILE_SEARCH_OFF, FILE_SEARCH_READY } from './messages.ts'

describe('file search pane', () => {
  it('shows one quiet sentence when search is off', () => {
    const html = renderToStaticMarkup(createElement(FileSearch, { href: null, resolved: true }))
    assert.match(html, /data-file-search="off"/)
    assert.match(html, new RegExp(FILE_SEARCH_OFF))
    assert.doesNotMatch(html, /Read these files for search|Search the words/)
    assert.doesNotMatch(html, /solicitor|claimant|defendant/i)
  })

  it('offers prepare and search only when the settings are on', () => {
    const html = renderToStaticMarkup(
      createElement(FileSearch, {
        href: '/api/library/index',
        resolved: true,
        initialEnabled: true,
        initialNote: FILE_SEARCH_READY,
      }),
    )
    assert.match(html, /data-file-search="on"/)
    assert.match(html, /Read these files for search/)
    assert.match(html, /Search the words/)
    assert.match(html, new RegExp(FILE_SEARCH_READY))
    assert.match(html, /text-muted-foreground/)
    assert.doesNotMatch(html, /solicitor|claimant|defendant/i)
    assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}/)
    const source = fs.readFileSync(new URL('../../components/shell/file-search.tsx', import.meta.url), 'utf8')
    assert.match(source, /TODO\(D-04\)/)
    assert.doesNotMatch(source, /@mastra\/|#[0-9a-fA-F]{3,8}|solicitor/i)
  })
})
