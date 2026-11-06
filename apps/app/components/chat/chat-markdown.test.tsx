import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChatMarkdown } from './chat-markdown.tsx'
import { MessageList } from './message-list.tsx'
import type { MatterMessage } from '../../lib/matters/types.ts'

function render(text: string): string {
  return renderToStaticMarkup(createElement(ChatMarkdown, { text }))
}

describe('C-14 chat markdown', () => {
  it('renders bold, italic, and inline code as elements, not as stars', () => {
    const html = render('The deadline is **Friday**. *Maybe* earlier. File `form N1.jar`.')
    assert.match(html, /data-chat-markdown/)
    assert.match(html, /<strong>Friday<\/strong>/)
    assert.match(html, /<em>Maybe<\/em>/)
    assert.match(html, /<code[^>]*>form N1\.jar<\/code>/)
    assert.doesNotMatch(html, /\*\*Friday\*\*/)
  })

  it('renders bullet lists and numbered lists', () => {
    const html = render('- shelter\n- stepchange\n\n1. first\n2. second')
    assert.match(html, /<ul[^>]*>[\s\S]*<li>shelter<\/li>[\s\S]*<li>stepchange<\/li>[\s\S]*<\/ul>/)
    assert.match(html, /<ol[^>]*>[\s\S]*<li>first<\/li>[\s\S]*<li>second<\/li>[\s\S]*<\/ol>/)
  })

  it('renders paragraphs and keeps the source line breaks', () => {
    const html = render('Money at risk: https://www.gov.uk/x\nFree money guidance: https://www.moneyhelper.org.uk/en')
    assert.match(html, /<p[^>]*whitespace-pre-line[^>]*>/)
    assert.match(html, /\n/) // the newline survives inside the paragraph text
  })

  it('renders markdown links only for safe targets and keeps the label', () => {
    const good = render('Read [the possession guide](https://www.gov.uk/guidance/legal-aid-for-possession-proceedings).')
    assert.match(good, /href="https:\/\/www\.gov\.uk\/guidance\/legal-aid-for-possession-proceedings"/)
    assert.match(good, /rel="noopener noreferrer nofollow"/)
    assert.match(good, />the possession guide<\/a>/)

    const bad = render('Click [here](javascript:alert(1)) and [bad](data:text/html,x).')
    assert.doesNotMatch(bad, /<a /)
    assert.match(bad, />here<\/span>/)
    assert.match(bad, />bad<\/span>/)
  })

  it('linkifies bare https URLs with the URL as the link text', () => {
    const html = render('Police: https://www.gov.uk/contact-police.')
    assert.match(html, /<a href="https:\/\/www\.gov\.uk\/contact-police"[^>]*>https:\/\/www\.gov\.uk\/contact-police<\/a>/)
    assert.match(html, /\./) // the trailing period is not part of the href
  })

  it('never parses HTML in a message; tags stay text', () => {
    const html = render('<script>alert(1)</script> <img src=x onerror=alert(1)>')
    assert.doesNotMatch(html, /<script/)
    assert.doesNotMatch(html, /<img/)
    assert.match(html, /&lt;script&gt;/)
  })

  it('renders fenced code and quotes', () => {
    const code = render('```\nplain text block\n```')
    assert.match(code, /<pre[^>]*><code>plain text block<\/code><\/pre>/)
    const quote = render('> The notice says it is disputed.')
    assert.match(quote, /<blockquote[^>]*>/)
  })

  it('assistant rows use markdown; user rows stay verbatim', () => {
    const messages: MatterMessage[] = [
      { id: 'u1', role: 'user', text: 'I think **bold** matters here https://www.gov.uk/x', createdAt: '2026-11-06T00:00:00.000Z' },
      { id: 'a1', role: 'assistant', text: '**Check the notice.**', createdAt: '2026-11-06T00:00:01.000Z' },
    ]
    const html = renderToStaticMarkup(createElement(MessageList, { messages }))
    // Assistant row went through markdown.
    assert.match(html, /<strong>Check the notice\.<\/strong>/)
    // User row kept the stars the person typed.
    assert.match(html, /I think \*\*bold\*\* matters here/)
  })
})
