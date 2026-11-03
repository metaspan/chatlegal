import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  CHAT_SIDEBAR_WIDTH_DEFAULT,
  CHAT_SIDEBAR_WIDTH_MAX,
  CHAT_SIDEBAR_WIDTH_MIN,
  CHAT_SIDEBAR_WIDTH_STORAGE_KEY,
  clampChatSidebarWidth,
  readChatSidebarWidth,
  writeChatSidebarWidth,
} from './chat-layout-storage.ts'

const memory = new Map<string, string>()

describe('chat sidebar width', () => {
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

  it('clamps to the docked pane bounds', () => {
    assert.equal(clampChatSidebarWidth(Number.NaN), CHAT_SIDEBAR_WIDTH_DEFAULT)
    assert.equal(clampChatSidebarWidth(10), CHAT_SIDEBAR_WIDTH_MIN)
    assert.equal(clampChatSidebarWidth(5000), CHAT_SIDEBAR_WIDTH_MAX)
    assert.equal(clampChatSidebarWidth(400.4), 400)
  })

  it('persists under the ChatLegal key', () => {
    assert.equal(CHAT_SIDEBAR_WIDTH_STORAGE_KEY, 'chatlegal.chat.sidebarWidth')
    assert.equal(readChatSidebarWidth(), CHAT_SIDEBAR_WIDTH_DEFAULT)
    writeChatSidebarWidth(512)
    assert.equal(memory.get(CHAT_SIDEBAR_WIDTH_STORAGE_KEY), '512')
    assert.equal(readChatSidebarWidth(), 512)
    writeChatSidebarWidth(12)
    assert.equal(readChatSidebarWidth(), CHAT_SIDEBAR_WIDTH_MIN)
  })
})
