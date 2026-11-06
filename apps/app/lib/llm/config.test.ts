import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_CONCIERGE_MODEL,
  DEFAULT_SESSION_HEADER,
  DEFAULT_TASKRUNNER_MODEL,
  chatCompletionsEndpoint,
  getConciergeModel,
  getTaskRunnerModel,
  isLiteLLMEnabled,
  litellmConfig,
  resolveOutboundModelId,
} from './config.ts'

const ON = {
  CHATLEGAL_LITELLM_BASE_URL: 'http://192.168.10.181:4000/v1',
  CHATLEGAL_LITELLM_API_KEY: 'sk-test-value',
}

describe('LiteLLM config gate (G-00)', () => {
  it('is off unless the base URL and the key are both set', () => {
    assert.equal(isLiteLLMEnabled({}), false)
    assert.equal(isLiteLLMEnabled({ CHATLEGAL_LITELLM_BASE_URL: ON.CHATLEGAL_LITELLM_BASE_URL }), false)
    assert.equal(isLiteLLMEnabled({ CHATLEGAL_LITELLM_API_KEY: ON.CHATLEGAL_LITELLM_API_KEY }), false)
    assert.equal(isLiteLLMEnabled({ CHATLEGAL_LITELLM_BASE_URL: '   ', CHATLEGAL_LITELLM_API_KEY: '  ' }), false)
    assert.equal(litellmConfig({}), false)
  })

  it('is on when the URL and the key are set, with trimmed values and the alias defaults', () => {
    const config = litellmConfig({
      CHATLEGAL_LITELLM_BASE_URL: '  http://192.168.10.181:4000/v1/  ',
      CHATLEGAL_LITELLM_API_KEY: '  sk-test-value  ',
    })
    assert.notEqual(config, false)
    if (config === false) return
    assert.equal(config.baseUrl, 'http://192.168.10.181:4000/v1')
    assert.equal(config.apiKey, 'sk-test-value')
    assert.equal(config.conciergeModel, DEFAULT_CONCIERGE_MODEL)
    assert.equal(config.taskRunnerModel, DEFAULT_TASKRUNNER_MODEL)
    assert.equal(config.sessionHeader, DEFAULT_SESSION_HEADER)
    assert.equal(getConciergeModel(ON), 'chatlegal-concierge')
    assert.equal(getTaskRunnerModel(ON), 'chatlegal-taskrunner')
  })

  it('reads the model ids from the environment when set', () => {
    assert.equal(getConciergeModel({ ...ON, CHATLEGAL_CONCIERGE_MODEL: ' my-concierge ' }), 'my-concierge')
    assert.equal(getTaskRunnerModel({ ...ON, CHATLEGAL_TASKRUNNER_MODEL: 'my-taskrunner' }), 'my-taskrunner')
    // A blank model falls back to the alias, like the other gates.
    assert.equal(getConciergeModel({ ...ON, CHATLEGAL_CONCIERGE_MODEL: '   ' }), DEFAULT_CONCIERGE_MODEL)
  })

  it('refuses a secret tucked into the URL (same rules as the D-03 embed URL)', () => {
    for (const raw of [
      'http://user:pass@192.168.10.181:4000/v1',
      'http://192.168.10.181:4000/v1?api_key=sk-quiet',
      'http://192.168.10.181:4000/v1#sk-fragment',
      'not a url',
      'ftp://192.168.10.181:4000/v1',
    ]) {
      assert.equal(isLiteLLMEnabled({ CHATLEGAL_LITELLM_BASE_URL: raw, CHATLEGAL_LITELLM_API_KEY: 'sk-x' }), false, raw)
    }
  })

  it('keeps a session header that is a token, and falls back to the default', () => {
    const on = (extra: Record<string, string>) => litellmConfig({ ...ON, ...extra })
    const clean = on({ CHATLEGAL_LITELLM_SESSION_HEADER: ' X-Litellm-Session-Id ' })
    assert.notEqual(clean, false)
    if (clean === false) return
    assert.equal(clean.sessionHeader, 'x-litellm-session-id')
    const broken = on({ CHATLEGAL_LITELLM_SESSION_HEADER: 'bad header\r\nX: yes' })
    assert.notEqual(broken, false)
    if (broken === false) return
    assert.equal(broken.sessionHeader, DEFAULT_SESSION_HEADER)
  })

  it('maps the Small class name chatlegal-1 to the Concierge id on the server', () => {
    assert.equal(resolveOutboundModelId('chatlegal-1', ON), 'chatlegal-concierge')
    assert.equal(resolveOutboundModelId('small', ON), 'chatlegal-concierge')
    assert.equal(resolveOutboundModelId('  chatlegal-1  ', ON), 'chatlegal-concierge')
    assert.equal(resolveOutboundModelId('some-other-id', ON), 'some-other-id')
    assert.equal(resolveOutboundModelId('', ON), 'chatlegal-concierge')
    // Off means no outbound call at all.
    assert.equal(resolveOutboundModelId('chatlegal-1', {}), null)
  })

  it('names the chat completions endpoint once, without doubling it', () => {
    assert.equal(
      chatCompletionsEndpoint('http://192.168.10.181:4000/v1'),
      'http://192.168.10.181:4000/v1/chat/completions',
    )
    assert.equal(
      chatCompletionsEndpoint('http://192.168.10.181:4000/v1/chat/completions'),
      'http://192.168.10.181:4000/v1/chat/completions',
    )
  })

  it('never reads a NEXT_PUBLIC variable in the server modules', () => {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    for (const file of ['config.ts', 'client.ts', 'concierge-reply.ts', 'concierge-prompt.ts']) {
      const source = fs.readFileSync(path.join(dir, file), 'utf8')
      assert.doesNotMatch(source, /NEXT_PUBLIC/, file)
    }
  })
})
