import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AgentChatPane } from './chat/agent-chat-pane.tsx'
import { DisclaimerBar } from './disclaimer-bar.tsx'

const here = path.dirname(fileURLToPath(import.meta.url))

describe('dashboard shell', () => {
  it('renders the chat pane and the disclaimer', () => {
    const html = renderToStaticMarkup(
      createElement('div', null, createElement(AgentChatPane), createElement(DisclaimerBar)),
    )
    assert.match(html, /aria-label="Chat"/)
    assert.match(html, /Resize chat pane/)
    assert.match(html, /Chat is not connected yet/)
    assert.match(html, /--chat-pane-width:448px/)
    assert.match(html, /Not a solicitor\. Not legal advice\./)
    assert.match(html, /lang="cy"/)
    assert.doesNotMatch(html, /I act for you/)
  })

  it('composes matters, work, case work, and the docked chat slot', () => {
    const shell = fs.readFileSync(path.join(here, 'dashboard-shell.tsx'), 'utf8')
    const sidebar = fs.readFileSync(path.join(here, 'dashboard-sidebar.tsx'), 'utf8')
    assert.match(shell, /DashboardSidebar/)
    assert.match(shell, /AgentChatPane/)
    assert.match(shell, /DisclaimerBar/)
    assert.match(shell, /data-chat-resize-root/)
    assert.match(shell, /id="case-work"/)
    assert.match(sidebar, /Matters/)
    assert.match(sidebar, /\/matters/)
    assert.match(sidebar, /Work/)
    assert.match(sidebar, /\/work/)
    assert.match(sidebar, /Personal account/)
    assert.match(sidebar, /SignOutControl/)
    assert.match(sidebar, /UserButton/)
    assert.doesNotMatch(shell + sidebar, /CompanySwitcher|OrganizationSwitcher/)
  })
})
