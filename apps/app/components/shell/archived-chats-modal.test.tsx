import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ArchivedChatsBody, ArchivedChatsTrigger, type ArchivedChatsBodyProps } from './archived-chats-modal.tsx'

const here = path.dirname(fileURLToPath(import.meta.url))

function rows() {
  return [
    { id: 'chat-1', title: 'Deposit', detail: 'Opened 3 Nov 2026' },
    { id: 'chat-2', title: 'Unpaid wages', detail: 'Opened 4 Nov 2026' },
  ]
}

function renderBody(overrides: Partial<ArchivedChatsBodyProps> = {}) {
  const props: ArchivedChatsBodyProps = {
    rows: rows(),
    loaded: true,
    listError: null,
    query: '',
    onQueryChange: () => {},
    onOpen: () => {},
    onUnarchive: () => {},
    unarchivingId: null,
    onRetry: () => {},
    ...overrides,
  }
  return renderToStaticMarkup(createElement(ArchivedChatsBody, props))
}

describe('archived chats modal', () => {
  it('lists archived chats with Open and Unarchive and an accessible label per action', () => {
    const body = renderBody()
    assert.match(body, /aria-label="Archived chats"/)
    assert.match(body, /placeholder="Search archived chats"/)
    assert.match(body, /data-archived-chat-id="chat-1"/)
    assert.match(body, /data-archived-chat-id="chat-2"/)
    assert.match(body, /Deposit/)
    assert.match(body, /Opened 3 Nov 2026/)
    assert.match(body, /aria-label="Open Deposit"/)
    assert.match(body, /aria-label="Unarchive Deposit"/)
    assert.match(body, /aria-label="Open Unpaid wages"/)
    assert.match(body, /aria-label="Unarchive Unpaid wages"/)
    assert.match(body, />Unarchive</)
  })

  it('searches by title and says when nothing matches', () => {
    const hit = renderBody({ query: 'wages' })
    assert.match(hit, /Unpaid wages/)
    assert.doesNotMatch(hit, /data-archived-chat-id="chat-1"/)
    assert.doesNotMatch(hit, /data-archived-no-results/)
    const miss = renderBody({ query: 'parking' })
    assert.match(miss, /data-archived-no-results/)
    assert.match(miss, /No archived chats match that search\./)
    assert.doesNotMatch(miss, /data-archived-chat-id/)
  })

  it('shows loading, empty, and error states apart from the list', () => {
    const loading = renderBody({ loaded: false })
    assert.match(loading, /data-archived-loading/)
    assert.match(loading, /Loading archived chats…/)
    assert.doesNotMatch(loading, /data-archived-chat-id/)

    const empty = renderBody({ rows: [] })
    assert.match(empty, /data-archived-empty/)
    assert.match(empty, /No archived chats yet\./)
    assert.doesNotMatch(empty, /data-archived-chat-id|data-archived-no-results/)

    const failed = renderBody({ listError: 'Archived chats could not be loaded.' })
    assert.match(failed, /data-archived-error/)
    assert.match(failed, /role="alert"/)
    assert.match(failed, /Archived chats could not be loaded\./)
    assert.match(failed, />Try again</)
    assert.doesNotMatch(failed, /data-archived-chat-id/)
  })

  it('marks the row being unarchived busy and disabled', () => {
    const busy = renderBody({ unarchivingId: 'chat-1' })
    assert.match(busy, /aria-busy="true"/)
    assert.match(busy, /Unarchiving…/)
    assert.match(busy, /disabled/)
    // The other row keeps a usable Unarchive.
    assert.match(busy, /aria-label="Unarchive Unpaid wages"[^>]*>/)
  })

  it('keeps citizen copy on "chat" and offers no delete or purge', () => {
    const body = renderBody()
    const trigger = renderToStaticMarkup(createElement(ArchivedChatsTrigger, { onClick: () => {} }))
    assert.match(trigger, /data-archived-chats-nav/)
    assert.match(trigger, /Archived chats/)
    const combined = body + trigger
    assert.doesNotMatch(combined, /matter/i)
    assert.doesNotMatch(combined, /delete|purge|destroy|erase/i)

    // The dialog title and description are copy too: same guard there.
    const modalSource = fs.readFileSync(path.join(here, 'archived-chats-modal.tsx'), 'utf8')
    const dialogCopy = modalSource.slice(
      modalSource.indexOf('<DialogHeader>'),
      modalSource.indexOf('<ArchivedChatsBody'),
    )
    assert.match(dialogCopy, /Archived chats<\/DialogTitle>/)
    assert.doesNotMatch(dialogCopy, /matter/i)
    assert.doesNotMatch(dialogCopy, /delete|purge|destroy|erase/i)
  })

  it('opens for reading only: Open never unarchives, Unarchive does', () => {
    const modalSource = fs.readFileSync(path.join(here, 'archived-chats-modal.tsx'), 'utf8')
    assert.match(modalSource, /onClick=\{\(\) => onOpen\(item\.id\)\}/)
    assert.match(modalSource, /onClick=\{\(\) => onUnarchive\(item\.id\)\}/)
    // The Open button's element contains no unarchive call.
    const openButton = modalSource.slice(
      modalSource.indexOf('aria-label={`Open ${item.title}`}'),
      modalSource.indexOf('<Button'),
    )
    assert.doesNotMatch(openButton, /onUnarchive|unarchive/)
    // The shell opens the chat through choose(), the same path as history.
    const shell = fs.readFileSync(path.join(here, '../dashboard-shell.tsx'), 'utf8')
    const openHandler = shell.slice(shell.indexOf('onOpen={(id) => {'), shell.indexOf('onUnarchive='))
    assert.match(openHandler, /mattersSession\.choose\(id\)/)
    assert.doesNotMatch(openHandler, /unarchive|archiveMatter/i)
  })

  it('wires the dialog primitive and keyboard support behind the modal', () => {
    const modalSource = fs.readFileSync(path.join(here, 'archived-chats-modal.tsx'), 'utf8')
    const dialogSource = fs.readFileSync(path.join(here, '../ui/dialog.tsx'), 'utf8')
    // Focus trap, Escape-close, and Tab cycling come from the Base UI dialog
    // adapted from the Tourbillon modal (same primitive family as the sheet).
    assert.match(modalSource, /from '@\/components\/ui\/dialog'/)
    assert.match(modalSource, /<Dialog open=\{open\}/)
    assert.match(modalSource, /DialogContent aria-label="Archived chats"/)
    assert.match(dialogSource, /dcolley\/tourbillon@7a8595b apps\/web\/components\/ui\/dialog\.tsx/)
    assert.match(dialogSource, /@base-ui\/react\/dialog/)
    // Arrow keys move between row actions; the list reuses the Tourbillon
    // title filter pattern.
    assert.match(modalSource, /ArrowDown/)
    assert.match(modalSource, /ArrowUp/)
    assert.match(modalSource, /data-archived-row-action/)
    assert.match(modalSource, /filterMatterHistory/)
    assert.match(modalSource, /hitly-net\/hitly@94b2e92 apps\/app\/components\/project-list\.tsx/)
  })

  it('reads the archived set and unarchives through the C-12 flag API', () => {
    const hook = fs.readFileSync(path.join(here, 'use-archived-matters.ts'), 'utf8')
    assert.match(hook, /\/api\/matters\?archived=true/)
    assert.match(hook, /method: 'PATCH'/)
    assert.match(hook, /archived: false/)
    assert.match(hook, /onRestored/)
    assert.doesNotMatch(hook, /method: 'DELETE'|DELETE/)

    const sessions = fs.readFileSync(path.join(here, 'use-matter-sessions.ts'), 'utf8')
    assert.match(sessions, /function restoreMatter/)
    assert.match(sessions, /hiddenIds\.current\.delete\(matter\.id\)/)
    assert.match(sessions, /mergeRestoredMatter/)

    const shell = fs.readFileSync(path.join(here, '../dashboard-shell.tsx'), 'utf8')
    assert.match(shell, /useArchivedMatters/)
    assert.match(shell, /<ArchivedChatsModal/)
    assert.match(shell, /restoreMatter\(matter\)/)
    const history = fs.readFileSync(path.join(here, 'history-pane.tsx'), 'utf8')
    assert.match(history, /ArchivedChatsTrigger/)
    assert.match(history, /onOpenArchived/)
  })
})
