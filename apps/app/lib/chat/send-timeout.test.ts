import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { MESSAGE_SEND_TIMEOUT_MS, isSendTimeout } from './send-timeout.ts'

describe('message send timeout', () => {
  it('waits 20 seconds and recognises a timeout', () => {
    assert.equal(MESSAGE_SEND_TIMEOUT_MS, 20_000)
    assert.equal(isSendTimeout(Object.assign(new Error('timed out'), { name: 'TimeoutError' })), true)
    assert.equal(
      isSendTimeout(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'AbortError' })),
      true,
    )
    assert.equal(isSendTimeout(Object.assign(new Error('aborted'), { name: 'AbortError' })), false)
    assert.equal(isSendTimeout(new Error('network')), false)
    assert.equal(isSendTimeout(null), false)
  })

  it('aborts the matter message request without a new setting', () => {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
    const hook = fs.readFileSync(path.join(root, 'components/shell/use-matter-sessions.ts'), 'utf8')
    const timeout = fs.readFileSync(path.join(root, 'lib/chat/send-timeout.ts'), 'utf8')
    assert.match(hook, /sendAbortSignal\(/)
    assert.match(hook, /isSendTimeout\(error\) \? 'timeout'/)
    assert.doesNotMatch(timeout, /process\.env/)
    assert.doesNotMatch(hook, /CHATLEGAL_.*TIMEOUT/)
  })
})
