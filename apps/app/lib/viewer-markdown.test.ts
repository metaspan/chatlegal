import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SafeMarkdown } from '../components/shell/safe-markdown.tsx'
import { safeMarkdownHref } from './viewer-markdown.ts'

describe('markdown preview', () => {
  it('keeps safe links and drops the rest', () => {
    assert.equal(safeMarkdownHref('https://www.gov.uk/deposit'), 'https://www.gov.uk/deposit')
    assert.equal(safeMarkdownHref('mailto:hello@example.com'), 'mailto:hello@example.com')
    assert.equal(safeMarkdownHref('/library'), '/library')
    assert.equal(safeMarkdownHref('javascript:alert(1)'), null)
    assert.equal(safeMarkdownHref('//evil.example'), null)
    assert.equal(safeMarkdownHref('data:text/html,hi'), null)
  })

  it('renders a heading and leaves raw html as text', () => {
    const html = renderToStaticMarkup(
      createElement(SafeMarkdown, {
        text: '# Deposit\n\nBring the <script>alert(1)</script> agreement.',
      }),
    )
    assert.match(html, /data-markdown-preview/)
    assert.match(html, /<h1[^>]*>Deposit<\/h1>/)
    assert.match(html, /Bring the/)
    assert.doesNotMatch(html, /<script>/)
  })
})
