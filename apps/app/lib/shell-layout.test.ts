import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  SHELL_LEFT_OPEN_KEY,
  SHELL_RIGHT_OPEN_KEY,
  escapeRestoresLeftPane,
  readPaneOpen,
  writePaneOpen,
} from './shell-layout.ts'

const memory = new Map<string, string>()

describe('shell pane open state', () => {
  beforeEach(() => {
    memory.clear()
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
    }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } })
  })

  it('stores left and right under ChatLegal keys', () => {
    assert.equal(SHELL_LEFT_OPEN_KEY, 'chatlegal.shell.leftOpen')
    assert.equal(SHELL_RIGHT_OPEN_KEY, 'chatlegal.shell.rightOpen')
    assert.equal(readPaneOpen(SHELL_LEFT_OPEN_KEY), true)
    writePaneOpen(SHELL_LEFT_OPEN_KEY, false)
    writePaneOpen(SHELL_RIGHT_OPEN_KEY, false)
    assert.equal(memory.get(SHELL_LEFT_OPEN_KEY), 'false')
    assert.equal(readPaneOpen(SHELL_LEFT_OPEN_KEY), false)
    assert.equal(readPaneOpen(SHELL_RIGHT_OPEN_KEY), false)
    writePaneOpen(SHELL_RIGHT_OPEN_KEY, true)
    assert.equal(readPaneOpen(SHELL_RIGHT_OPEN_KEY), true)
  })

  it('ignores unexpected stored values', () => {
    memory.set(SHELL_LEFT_OPEN_KEY, 'yes')
    assert.equal(readPaneOpen(SHELL_LEFT_OPEN_KEY), true)
    assert.equal(readPaneOpen(SHELL_LEFT_OPEN_KEY, false), false)
  })

  it('uses Escape to show chats only when both panes are hidden', () => {
    const escape = { key: 'Escape' }
    assert.equal(escapeRestoresLeftPane(escape, { leftOpen: false, rightOpen: false }), true)
    assert.equal(escapeRestoresLeftPane(escape, { leftOpen: true, rightOpen: false }), false)
    assert.equal(escapeRestoresLeftPane(escape, { leftOpen: false, rightOpen: true }), false)
    assert.equal(escapeRestoresLeftPane(escape, { leftOpen: true, rightOpen: true }), false)
    assert.equal(escapeRestoresLeftPane({ key: 'Enter' }, { leftOpen: false, rightOpen: false }), false)
    assert.equal(
      escapeRestoresLeftPane({ key: 'Escape', defaultPrevented: true }, { leftOpen: false, rightOpen: false }),
      false,
    )
    assert.equal(
      escapeRestoresLeftPane({ key: 'Escape', shiftKey: true }, { leftOpen: false, rightOpen: false }),
      false,
    )
    assert.equal(
      escapeRestoresLeftPane({ key: 'Escape', metaKey: true }, { leftOpen: false, rightOpen: false }),
      false,
    )
  })
})
