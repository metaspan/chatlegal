import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChatColumn } from './chat/chat-column.tsx'
import { composerSendsOnEnter } from '../lib/chat-composer.ts'
import { DisclaimerBar } from './disclaimer-bar.tsx'
import { DocumentViewer } from './shell/document-viewer.tsx'
import { HistoryPane } from './shell/history-pane.tsx'
import { PaneEdgeToggle } from './shell/pane-edge-toggle.tsx'

const here = path.dirname(fileURLToPath(import.meta.url))

describe('dashboard shell', () => {
  it('renders the chat column, the viewer stubs, the history pane, and the disclaimer', () => {
    const chat = renderToStaticMarkup(
      createElement(ChatColumn, {
        title: 'Deposit',
        detail: 'Write what has happened, in your own words. It stays with this matter. This is not legal advice.',
        matterId: 'matter-1',
        messages: [
          { id: 'msg-1', role: 'user', text: 'When is the deadline?', createdAt: '2026-11-03T00:00:00.000Z' },
          {
            id: 'msg-2',
            role: 'assistant',
            text: 'Here is what the notice says.',
            createdAt: '2026-11-03T00:00:01.000Z',
            tools: [{ name: 'search_sources' }],
          },
        ],
        draft: 'draft for this matter',
        onDraftChange: () => {},
        onSend: () => true,
        threadStatus: 'ready',
        observations: { enabled: false, summary: 'The deposit deadline is Friday.' },
      }),
    )
    assert.match(chat, /aria-label="Chat"/)
    assert.match(chat, /id="chat-thread"/)
    assert.match(chat, /Deposit/)
    assert.match(chat, /data-matter-id="matter-1"/)
    assert.match(chat, /data-draft-matter-id="matter-1"/)
    assert.match(chat, /When is the deadline\?/)
    assert.match(chat, /Here is what the notice says/)
    assert.match(chat, /data-tool-use="search_sources"/)
    assert.match(chat, /Checked search sources\./)
    assert.doesNotMatch(chat, /\{|args|json|toolCall/)
    assert.match(chat, /aria-label="Summary"/)
    assert.match(chat, /data-observation-matter-id="matter-1"/)
    assert.match(chat, /The deposit deadline is Friday\./)
    assert.match(chat, /only for the open matter/)
    assert.match(chat, /draft for this matter/)
    assert.match(chat, /data-slot="composer"/)
    assert.match(chat, /This stays with this matter/)
    assert.match(chat, />Send</)
    const sendButton = chat.match(/<button type="submit"[^>]*>/)?.[0] ?? ''
    assert.equal(/\sdisabled(?:=|[>\s])/.test(sendButton), false)
    assert.equal(composerSendsOnEnter({ key: 'Enter' }), true)
    assert.equal(composerSendsOnEnter({ key: 'Enter', shiftKey: true }), false)

    const emptyChat = renderToStaticMarkup(
      createElement(ChatColumn, {
        title: 'Start a matter',
        detail: 'New chat opens a place for what is happening. Write it in your own words. This is not legal advice.',
        matterId: null,
        messages: [],
        draft: '',
        onDraftChange: () => {},
        onNewChat: () => {},
      }),
    )
    assert.match(emptyChat, /data-chat-empty/)
    assert.match(emptyChat, /Start a matter/)
    assert.match(emptyChat, /not legal advice/i)
    assert.match(emptyChat, />New chat</)
    assert.match(emptyChat, /disabled/)
    assert.doesNotMatch(emptyChat, /I act for you|we advise/i)

    const viewer = renderToStaticMarkup(
      createElement(DocumentViewer, {
        onCollapse: () => {},
        matterId: 'matter-1',
        threadStatus: 'ready',
        observations: { enabled: true, summary: 'The deposit deadline is Friday.' },
      }),
    )
    assert.match(viewer, /aria-label="Viewer"/)
    assert.match(viewer, /Resize viewer/)
    assert.match(viewer, /--viewer-pane-width:448px/)
    assert.match(viewer, /Markdown/)
    assert.match(viewer, /Image/)
    assert.match(viewer, /PDF/)
    assert.match(viewer, /Chat state/)
    assert.match(viewer, /No document is open/)
    assert.doesNotMatch(viewer, /The deposit deadline is Friday/)

    const chatState = renderToStaticMarkup(
      createElement(DocumentViewer, {
        onCollapse: () => {},
        matterId: 'matter-1',
        threadStatus: 'ready',
        observations: { enabled: true, summary: 'The deposit deadline is Friday.' },
        initialKind: 'chat-state',
      }),
    )
    assert.match(chatState, /data-viewer-kind="chat-state"/)
    assert.match(chatState, /data-observation-matter-id="matter-1"/)
    assert.match(chatState, /The deposit deadline is Friday\./)
    assert.doesNotMatch(chatState, /No document is open/)

    const emptySummary = renderToStaticMarkup(
      createElement(DocumentViewer, {
        onCollapse: () => {},
        matterId: 'matter-2',
        threadStatus: 'ready',
        observations: { enabled: false, summary: '' },
        initialKind: 'chat-state',
      }),
    )
    assert.match(emptySummary, /No summary for this matter yet/)
    assert.match(emptySummary, /data-observation-enabled="false"/)
    assert.doesNotMatch(emptySummary, /Friday/)

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
        ...libraryProps({
          libraryFiles: [{ name: 'notice.txt', size: 4, updatedAt: '2026-11-03T00:00:00.000Z' }],
          matterFiles: [{ name: 'reply.txt', size: 5, updatedAt: '2026-11-03T00:00:00.000Z' }],
        }),
      }),
    )
    assert.match(history, /Search/)
    assert.match(history, /New chat/)
    assert.match(history, /Library/)
    assert.match(history, /History/)
    assert.match(history, /data-library-file="notice.txt"/)
    assert.match(history, /Move notice\.txt to this matter/)
    assert.match(history, /data-matter-files="matter-1"/)
    assert.match(history, /data-matter-file="reply.txt"/)
    assert.match(history, /Move reply\.txt to your library/)
    assert.match(history, /Add a file/)
    assert.doesNotMatch(history, /No files yet/)
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
        ...libraryProps(),
      }),
    )
    assert.match(emptyHistory, /No matters yet/)
    assert.match(emptyHistory, /No files yet/)
    assert.match(emptyHistory, /Open a matter to see its files/)

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
        ...libraryProps(),
      }),
    )
    assert.match(failedHistory, /Matters could not be loaded/)
    assert.doesNotMatch(failedHistory, /No matters yet/)

    const disclaimer = renderToStaticMarkup(createElement(DisclaimerBar))
    assert.match(disclaimer, /Not a solicitor\. Not legal advice\./)
    assert.match(disclaimer, /lang="cy"/)
    assert.doesNotMatch(chat + viewer + history + disclaimer, /I act for you/)
  })

  it('renders a pending askChoice card and an answered one locked to the pick', () => {
    const options = [
      { id: 'scheme', label: 'Deposit scheme', description: 'The scheme that holds it' },
      { id: 'court', label: 'Court' },
    ]
    const chat = renderToStaticMarkup(
      createElement(ChatColumn, {
        title: 'Deposit',
        detail: '',
        matterId: 'matter-1',
        messages: [
          { id: 'msg-1', role: 'user', text: 'The landlord has not protected the deposit.', createdAt: '2026-11-03T00:00:00.000Z' },
          {
            id: 'msg-2',
            role: 'assistant',
            text: '',
            createdAt: '2026-11-03T00:00:01.000Z',
            widget: {
              toolCallId: 'call-pending',
              name: 'askChoice',
              version: 2,
              question: 'Which route fits this notice?',
              detail: 'Pick one. This is not a decision for you.',
              options,
              multiSelect: false,
              minSelected: 1,
              maxSelected: 1,
              recommended: ['scheme'],
              defaultOption: 'scheme',
              status: 'pending',
            },
          },
          {
            id: 'msg-3',
            role: 'assistant',
            text: '',
            createdAt: '2026-11-03T00:00:02.000Z',
            widget: {
              toolCallId: 'call-answered',
              name: 'askChoice',
              version: 2,
              question: 'Which papers do you have?',
              options: [
                { id: 'tenancy', label: 'Tenancy' },
                { id: 'certificate', label: 'Certificate' },
              ],
              multiSelect: true,
              minSelected: 1,
              maxSelected: 2,
              status: 'answered',
              answer: { choices: ['tenancy', 'certificate'] },
              answeredAt: '2026-11-03T00:00:03.000Z',
            },
          },
        ],
        draft: '',
        onDraftChange: () => {},
        onAnswerWidget: () => {},
        threadStatus: 'ready',
        observations: { enabled: false, summary: '' },
      }),
    )
    assert.match(chat, /data-widget="askChoice"/)
    assert.match(chat, /data-widget-status="pending"/)
    assert.match(chat, /data-widget-status="answered"/)
    assert.match(chat, /Which route fits this notice\?/)
    assert.match(chat, /Deposit scheme/)
    assert.match(chat, /data-option="scheme"/)
    assert.match(chat, /data-recommended="true"/)
    assert.match(chat, /Recommended/)
    assert.match(chat, />Choose</)
    assert.match(chat, /Which papers do you have\?/)
    assert.match(chat, /data-multi="true"/)
    assert.match(chat, /data-card-answer/)
    assert.match(chat, /Chosen: Tenancy, Certificate/)
    assert.match(chat, /The landlord has not protected the deposit\./)
    assert.doesNotMatch(chat, /data-chat-empty/)
    assert.doesNotMatch(chat, /I act for you|we advise/i)
    const answered = chat.slice(chat.indexOf('data-widget-status="answered"'))
    assert.match(answered, /disabled/)
    assert.doesNotMatch(answered, />Choose</)
  })

  it('composes three panes, collapse controls, and the Clerk account control', () => {
    const shell = fs.readFileSync(path.join(here, 'dashboard-shell.tsx'), 'utf8')
    const bar = fs.readFileSync(path.join(here, 'shell/app-bar.tsx'), 'utf8')
    const combined = shell + bar
    assert.match(shell, /HistoryPane/)
    assert.match(shell, /useLibrary/)
    assert.match(shell, /useMatterSessions/)
    assert.match(shell, /writeDraft/)
    assert.match(shell, /sendMessage/)
    assert.match(shell, /answerWidget/)
    assert.match(shell, /onSend=/)
    assert.match(shell, /onAnswerWidget=/)
    assert.match(shell, /ChatColumn/)
    assert.doesNotMatch(shell, /Sending stays off/)
    assert.match(shell, /observations=\{mattersSession\.observations\}/)
    assert.match(shell, /DocumentViewer/)
    assert.match(shell, /DisclaimerBar/)
    assert.match(shell, /data-chat-resize-root/)
    assert.match(shell, /data-shell="three-pane"/)
    assert.match(shell, /data-pane-rail/)
    assert.match(shell, /data-left-open/)
    assert.match(shell, /data-right-open/)
    assert.match(shell, /escapeRestoresLeftPane/)
    assert.match(shell, /setLeftOpen\(true\)/)
    assert.match(shell, /When both side panes are hidden, Escape shows chats/)
    assert.match(shell, /max-md:hidden/)
    assert.match(shell, /mobileLeft/)
    assert.match(shell, /PaneEdgeToggle/)
    assert.match(bar, /Hide chats/)
    assert.match(bar, /Show chats/)
    assert.match(bar, /Hide viewer/)
    assert.match(bar, /Show viewer/)
    assert.match(bar, /Personal account/)
    assert.match(bar, /SignOutControl/)
    assert.match(bar, /UserButton/)
    assert.match(bar, /data-chrome="burgundy"/)
    assert.match(bar, /bg-chrome/)
    assert.doesNotMatch(combined, /CompanySwitcher|OrganizationSwitcher/)

    const hiddenChats = renderToStaticMarkup(createElement(PaneEdgeToggle, { side: 'left', open: false, onToggle: () => {} }))
    assert.match(hiddenChats, /data-pane-edge="left"/)
    assert.match(hiddenChats, /data-pane-open="false"/)
    assert.match(hiddenChats, /aria-label="Show chats"/)
    assert.match(hiddenChats, /aria-expanded="false"/)
    assert.match(hiddenChats, /aria-controls="history-pane"/)

    const openViewer = renderToStaticMarkup(createElement(PaneEdgeToggle, { side: 'right', open: true, onToggle: () => {} }))
    assert.match(openViewer, /data-pane-edge="right"/)
    assert.match(openViewer, /data-pane-open="true"/)
    assert.match(openViewer, /aria-label="Hide viewer"/)
    assert.match(openViewer, /aria-controls="document-viewer"/)
    const libraryHook = fs.readFileSync(path.join(here, 'shell/use-library.ts'), 'utf8')
    assert.match(libraryHook, /\/api\/library/)
    assert.match(libraryHook, /\/api\/matters\//)
    assert.match(libraryHook, /\/api\/workspace\/move/)
    assert.match(libraryHook, /kind: 'user'/)
    assert.match(libraryHook, /kind: 'matter'/)
  })
})

function libraryProps(overrides: Record<string, unknown> = {}) {
  return {
    libraryFiles: [],
    libraryLoaded: true,
    libraryError: null,
    addingFile: false,
    onAddFile: () => true,
    matterFiles: [],
    matterFilesLoaded: true,
    matterFilesError: null,
    movingName: null,
    onMoveToMatter: () => {},
    onMoveToLibrary: () => {},
    ...overrides,
  }
}
