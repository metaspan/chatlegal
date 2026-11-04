import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChatColumn } from './chat/chat-column.tsx'
import { ComposerView } from './chat/composer/composer.tsx'
import { createComposerController } from './chat/composer/composer-controller.ts'
import { composerSendsOnEnter } from '../lib/chat-composer.ts'
import { basicPlanUsage } from '../lib/plan-usage.ts'
import { DisclaimerBar } from './disclaimer-bar.tsx'
import { DocumentViewer } from './shell/document-viewer.tsx'
import { HistoryPane } from './shell/history-pane.tsx'
import { PlanUsageCard } from './shell/plan-usage-card.tsx'
import { PaneEdgeToggle } from './shell/pane-edge-toggle.tsx'
import {
  defaultRightPaneView,
  dismissRightPaneDocument,
  openRightPaneDocument,
  rightPaneKind,
  type RightPaneView,
} from '../lib/right-pane.ts'
import type { MatterObservations } from '../lib/matters/types.ts'

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
    assert.match(chat, /data-slot="model-class"/)
    assert.match(chat, /data-model-class="small"/)
    assert.match(chat, /data-model-id="chatlegal-1"/)
    assert.match(chat, /Small · chatlegal-1/)
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

    let pane = defaultRightPaneView()
    assert.equal(rightPaneKind(pane), 'chat-state')
    const viewer = renderViewer(pane)
    assert.match(viewer, /aria-label="Viewer"/)
    assert.match(viewer, /Resize viewer/)
    assert.match(viewer, /--viewer-pane-width:448px/)
    assert.match(viewer, /data-viewer-kind="chat-state"/)
    assert.match(viewer, /Chat state/)
    assert.match(viewer, /aria-label="Summary"/)
    assert.match(viewer, /data-observation-matter-id="matter-1"/)
    assert.match(viewer, /The deposit deadline is Friday\./)
    assert.doesNotMatch(viewer, /No document is open/)
    assert.doesNotMatch(viewer, /This file is open in the viewer/)
    assert.doesNotMatch(viewer, /role="tablist"/)
    assert.doesNotMatch(viewer, /data-open-document="[^"]+"/)

    pane = openRightPaneDocument({ name: 'notice.pdf', scope: 'user' })
    assert.equal(rightPaneKind(pane), 'pdf')
    const opened = renderViewer(pane)
    assert.match(opened, /data-viewer-kind="pdf"/)
    assert.match(opened, /data-open-document="notice.pdf"/)
    assert.match(opened, /notice\.pdf/)
    assert.match(opened, />\s*PDF\s*</)
    assert.match(opened, /This file is open in the viewer/)
    assert.match(opened, /aria-label="Close document"/)
    assert.doesNotMatch(opened, /The deposit deadline is Friday/)
    assert.doesNotMatch(opened, /No document is open/)
    assert.doesNotMatch(opened, /role="tablist"/)

    const markdown = renderViewer(openRightPaneDocument({ name: 'letter.md', scope: 'user' }))
    assert.match(markdown, /data-viewer-kind="markdown"/)
    assert.match(markdown, />\s*Markdown\s*</)
    const image = renderViewer(openRightPaneDocument({ name: 'photo.png', scope: 'user' }))
    assert.match(image, /data-viewer-kind="image"/)
    assert.match(image, />\s*Image\s*</)
    const other = renderViewer(openRightPaneDocument({ name: 'notes.txt', scope: 'user' }))
    assert.match(other, /data-viewer-kind="markdown"/)
    assert.match(other, />\s*File\s*</)
    assert.doesNotMatch(other, />\s*Markdown\s*</)

    pane = dismissRightPaneDocument()
    assert.equal(rightPaneKind(pane), 'chat-state')
    assert.equal(pane.document, null)
    const restored = renderViewer(pane)
    assert.match(restored, /data-viewer-kind="chat-state"/)
    assert.match(restored, /The deposit deadline is Friday\./)
    assert.doesNotMatch(restored, /notice\.pdf/)
    assert.doesNotMatch(restored, /This file is open in the viewer/)
    assert.doesNotMatch(restored, /aria-label="Close document"/)

    const emptySummary = renderViewer(defaultRightPaneView(), {
      matterId: 'matter-2',
      observations: { enabled: false, summary: '' },
    })
    assert.match(emptySummary, /No summary for this matter yet/)
    assert.match(emptySummary, /data-observation-enabled="false"/)
    assert.doesNotMatch(emptySummary, /Friday/)

    const history = renderToStaticMarkup(
      createElement(HistoryPane, {
        ...historyProps(),
        matters: [{ id: 'matter-1', title: 'Deposit', detail: 'Opened 3 Nov 2026' }],
        activeId: 'matter-1',
      }),
    )
    assert.match(history, /Search/)
    assert.match(history, /New chat/)
    assert.match(history, /Library/)
    assert.match(history, /href="\/library"/)
    assert.match(history, /data-library-nav/)
    assert.match(history, /History/)
    assert.doesNotMatch(history, /data-library-file|data-matter-file|data-library-scope|Add a file|File name|Move to/)
    assert.doesNotMatch(history, /No files yet/)
    assert.match(history, /One matter is one chat/)
    assert.match(history, /Deposit/)
    assert.match(history, /data-matter-id="matter-1"/)
    assert.doesNotMatch(history, /Chat title|Matter title|Placeholder/)
    assertPlanCard(history)
    assert.ok(history.indexOf('data-plan-footer') > history.indexOf('>History<'))

    const libraryLink = renderToStaticMarkup(createElement(HistoryPane, { ...historyProps(), libraryActive: true }))
    assert.match(libraryLink, /href="\/library"/)
    assert.match(libraryLink, /aria-current="page"/)
    assert.match(libraryLink, />Library</)

    const emptyHistory = renderToStaticMarkup(createElement(HistoryPane, historyProps()))
    assert.match(emptyHistory, /No matters yet/)
    assert.match(emptyHistory, /href="\/library"/)
    assertPlanCard(emptyHistory)
    assert.ok(emptyHistory.indexOf('data-plan-footer') > emptyHistory.indexOf('No matters yet'))
    assert.doesNotMatch(emptyHistory, /No files yet|Open a matter to see its files|Add a file/)

    const failedHistory = renderToStaticMarkup(
      createElement(HistoryPane, {
        ...historyProps(),
        listError: 'Matters could not be loaded.',
      }),
    )
    assert.match(failedHistory, /Matters could not be loaded/)
    assert.doesNotMatch(failedHistory, /No matters yet/)

    const disclaimer = renderToStaticMarkup(createElement(DisclaimerBar))
    assert.match(disclaimer, /Not a solicitor\. Not legal advice\./)
    assert.match(disclaimer, /lang="cy"/)
    assert.doesNotMatch(chat + viewer + history + disclaimer, /I act for you/)
    assert.doesNotMatch(viewer, /data-plan-card/)

    const card = renderToStaticMarkup(createElement(PlanUsageCard))
    assertPlanCard(card)
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
    assert.match(shell, /libraryActive=\{pathname === '\/library'\}/)
    assert.match(shell, /usePathname/)
    assert.match(shell, /useMatterSessions/)
    assert.match(shell, /optimistic: false/)
    assert.match(fs.readFileSync(path.join(here, 'chat/composer/composer-controller.ts'), 'utf8'), /flushQueue/)
    assert.match(shell, /sendMessage/)
    assert.match(shell, /answerWidget/)
    assert.match(shell, /onSend=/)
    assert.match(shell, /onAnswerWidget=/)
    assert.match(shell, /ChatColumn/)
    assert.doesNotMatch(shell, /Sending stays off/)
    assert.match(shell, /observations=\{mattersSession\.observations\}/)
    assert.match(shell, /DocumentViewer/)
    assert.match(shell, /RightPaneActionsProvider/)
    assert.match(shell, /defaultRightPaneView/)
    assert.match(shell, /openRightPaneDocument/)
    assert.match(shell, /dismissRightPaneDocument/)
    assert.match(shell, /retainOpenedDocument/)
    assert.match(shell, /document=\{rightPane\.document\}/)
    assert.match(shell, /onDismiss=\{dismissDocument\}/)
    assert.doesNotMatch(shell, /initialKind|useLibrary|onAddFile|onMoveToMatter/)
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

  it('shows a waiting message with a quiet retry', async () => {
    const offline = createComposerController({
      matterId: 'matter-1',
      ready: true,
      connection: 'offline',
      makeId: () => 'q-offline',
      schedule: () => () => {},
      controls: { send: async () => ({ ok: false, reason: 'failed' }) },
    })
    offline.setText('When is the deadline?')
    await offline.primary()
    const waiting = renderToStaticMarkup(
      createElement(ComposerView, { state: offline.getState(), controller: offline, threadStatus: 'ready' }),
    )
    assert.match(waiting, /data-slot="composer-queue"/)
    assert.match(waiting, /data-queue-state="pending"/)
    assert.match(waiting, /data-connection="offline"/)
    assert.match(waiting, /When is the deadline\?/)
    assert.match(waiting, />Waiting</)
    assert.match(waiting, /offline/)
    assert.match(waiting, /sends when the connection returns/)
    assert.match(waiting, />Try again</)
    assert.match(waiting, /border-l-chrome/)
    assert.match(waiting, /aria-label="Waiting to send"/)
    assert.doesNotMatch(waiting, /text-destructive/)

    const failed = createComposerController({
      matterId: 'matter-1',
      ready: true,
      makeId: () => 'q-failed',
      schedule: () => () => {},
      controls: { send: async () => ({ ok: false, reason: 'timeout' }) },
    })
    failed.setText('The notice arrived on Friday.')
    await failed.primary()
    const retry = renderToStaticMarkup(
      createElement(ComposerView, { state: failed.getState(), controller: failed, threadStatus: 'ready' }),
    )
    assert.match(retry, /data-queue-state="failed"/)
    assert.match(retry, /Not saved yet/)
    assert.match(retry, /That took too long/)
    assert.match(retry, />Try again</)
    assert.match(retry, /border-l-chrome/)
    assert.match(retry, /The notice arrived on Friday\./)
    assert.doesNotMatch(retry, /text-destructive/)
  })
})

function assertPlanCard(html: string) {
  assert.match(html, /aria-label="Plan and usage"/)
  assert.match(html, /data-plan-card/)
  assert.match(html, new RegExp(`data-plan-tier="${basicPlanUsage.tierName}"`))
  assert.match(html, new RegExp(`data-plan-price="${basicPlanUsage.priceLabel}"`))
  assert.match(html, /data-plan-model-class="small"/)
  assert.match(html, /data-plan-model-id="chatlegal-1"/)
  assert.match(html, /data-slot="model-class"/)
  assert.match(html, /Small · chatlegal-1/)
  assert.match(html, /data-plan-remaining="placeholder"/)
  assert.match(html, /data-upgrade-available="false"/)
  assert.match(html, new RegExp(`>${basicPlanUsage.tierName}<`))
  assert.match(html, new RegExp(`>${basicPlanUsage.priceLabel}<`))
  assert.match(html, new RegExp(basicPlanUsage.remainingLabel))
  assert.match(html, new RegExp(basicPlanUsage.remainingDetail.replace(/\./g, '\\.')))
  assert.match(html, new RegExp(`>${basicPlanUsage.upgradeLabel}<`))
  assert.match(html, new RegExp(basicPlanUsage.upgradeDetail.replace(/\./g, '\\.')))
  const upgrade = html.slice(html.indexOf('data-plan-card'))
  assert.match(upgrade, /<button[^>]*disabled/)
  assert.doesNotMatch(upgrade, /href=/)
  assert.doesNotMatch(upgrade, /I act for you|we advise/i)
}

function historyProps() {
  return {
    query: '',
    onQueryChange: () => {},
    matters: [] as { id: string; title: string; detail: string }[],
    loaded: true,
    listError: null,
    activeId: null,
    onSelect: () => {},
    onNewChat: () => {},
    creating: false,
    onCollapse: () => {},
  }
}

function renderViewer(
  view: RightPaneView,
  options: { matterId?: string; observations?: MatterObservations } = {},
) {
  return renderToStaticMarkup(
    createElement(DocumentViewer, {
      onCollapse: () => {},
      onDismiss: () => {},
      matterId: options.matterId ?? 'matter-1',
      threadStatus: 'ready',
      observations: options.observations ?? { enabled: true, summary: 'The deposit deadline is Friday.' },
      document: view.document,
    }),
  )
}
