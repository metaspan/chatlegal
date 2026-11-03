import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChatColumn } from './chat/chat-column.tsx'
import { DisclaimerBar } from './disclaimer-bar.tsx'
import { DocumentViewer } from './shell/document-viewer.tsx'
import { HistoryPane } from './shell/history-pane.tsx'

const here = path.dirname(fileURLToPath(import.meta.url))

describe('dashboard shell', () => {
  it('renders the chat column, the viewer stubs, the history pane, and the disclaimer', () => {
    const chat = renderToStaticMarkup(
      createElement(ChatColumn, {
        title: 'Deposit',
        detail: 'No messages in this matter yet. Sending stays off until a model is connected.',
        matterId: 'matter-1',
        messages: [{ id: 'msg-1', role: 'user', text: 'When is the deadline?', createdAt: '2026-11-03T00:00:00.000Z' }],
        draft: 'draft for this matter',
        onDraftChange: () => {},
      }),
    )
    assert.match(chat, /aria-label="Chat"/)
    assert.match(chat, /id="chat-thread"/)
    assert.match(chat, /Deposit/)
    assert.match(chat, /data-matter-id="matter-1"/)
    assert.match(chat, /data-draft-matter-id="matter-1"/)
    assert.match(chat, /When is the deadline\?/)
    assert.match(chat, /draft for this matter/)
    assert.match(chat, /data-slot="composer"/)
    assert.match(chat, /This draft stays with this matter/)
    assert.match(chat, />Send</)
    assert.match(chat, /disabled/)

    const viewer = renderToStaticMarkup(createElement(DocumentViewer, { onCollapse: () => {} }))
    assert.match(viewer, /aria-label="Viewer"/)
    assert.match(viewer, /Resize viewer/)
    assert.match(viewer, /--viewer-pane-width:448px/)
    assert.match(viewer, /Markdown/)
    assert.match(viewer, /Image/)
    assert.match(viewer, /PDF/)
    assert.match(viewer, /Chat state/)
    assert.match(viewer, /No document is open/)

    const history = renderToStaticMarkup(
      createElement(HistoryPane, {
        query: '',
        onQueryChange: () => {},
        matters: [{ id: 'matter-1', title: 'Deposit', detail: 'Opened 3 Nov 2026' }],
        loaded: true,
        listError: null,
        activeId: 'matter-1',
        onSelect: () => {},
        onNewChat: () => {},
        creating: false,
        onCollapse: () => {},
        libraryNote: null,
        onAddFile: () => {},
      }),
    )
    assert.match(history, /Search/)
    assert.match(history, /New chat/)
    assert.match(history, /Library/)
    assert.match(history, /History/)
    assert.match(history, /No files yet/)
    assert.match(history, /One matter is one chat/)
    assert.match(history, /Deposit/)
    assert.match(history, /data-matter-id="matter-1"/)
    assert.doesNotMatch(history, /Chat title|Matter title|Placeholder/)

    const emptyHistory = renderToStaticMarkup(
      createElement(HistoryPane, {
        query: '',
        onQueryChange: () => {},
        matters: [],
        loaded: true,
        listError: null,
        activeId: null,
        onSelect: () => {},
        onNewChat: () => {},
        creating: false,
        onCollapse: () => {},
        libraryNote: null,
        onAddFile: () => {},
      }),
    )
    assert.match(emptyHistory, /No matters yet/)

    const failedHistory = renderToStaticMarkup(
      createElement(HistoryPane, {
        query: '',
        onQueryChange: () => {},
        matters: [],
        loaded: true,
        listError: 'Matters could not be loaded.',
        activeId: null,
        onSelect: () => {},
        onNewChat: () => {},
        creating: false,
        onCollapse: () => {},
        libraryNote: null,
        onAddFile: () => {},
      }),
    )
    assert.match(failedHistory, /Matters could not be loaded/)
    assert.doesNotMatch(failedHistory, /No matters yet/)

    const disclaimer = renderToStaticMarkup(createElement(DisclaimerBar))
    assert.match(disclaimer, /Not a solicitor\. Not legal advice\./)
    assert.match(disclaimer, /lang="cy"/)
    assert.doesNotMatch(chat + viewer + history + disclaimer, /I act for you/)
  })

  it('composes three panes, collapse controls, and the Clerk account control', () => {
    const shell = fs.readFileSync(path.join(here, 'dashboard-shell.tsx'), 'utf8')
    const bar = fs.readFileSync(path.join(here, 'shell/app-bar.tsx'), 'utf8')
    const combined = shell + bar
    assert.match(shell, /HistoryPane/)
    assert.match(shell, /useMatterSessions/)
    assert.match(shell, /writeDraft/)
    assert.match(shell, /ChatColumn/)
    assert.match(shell, /DocumentViewer/)
    assert.match(shell, /DisclaimerBar/)
    assert.match(shell, /data-chat-resize-root/)
    assert.match(shell, /data-shell="three-pane"/)
    assert.match(shell, /max-md:hidden/)
    assert.match(shell, /mobileLeft/)
    assert.match(bar, /Hide chats/)
    assert.match(bar, /Show chats/)
    assert.match(bar, /Hide viewer/)
    assert.match(bar, /Show viewer/)
    assert.match(bar, /Personal account/)
    assert.match(bar, /SignOutControl/)
    assert.match(bar, /UserButton/)
    assert.doesNotMatch(combined, /CompanySwitcher|OrganizationSwitcher/)
  })
})
