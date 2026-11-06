import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ComposerView } from '../components/chat/composer/composer.tsx'
import { createComposerController } from '../components/chat/composer/composer-controller.ts'
import { PlanUsageCard } from '../components/shell/plan-usage-card.tsx'
import {
  defaultModelClass,
  modelClassAffordance,
  modelClassForTier,
  planTierModelClasses,
} from './model-class.ts'

const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('default model class', () => {
  it('maps Basic to Small and chatlegal-1', () => {
    assert.deepEqual(Object.keys(planTierModelClasses), ['Basic'])
    assert.equal(modelClassForTier('Basic').id, 'small')
    assert.equal(modelClassForTier('Basic').label, 'Small')
    assert.equal(modelClassForTier('Basic').modelId, 'chatlegal-1')
    assert.equal(defaultModelClass, planTierModelClasses.Basic)
    assert.equal(modelClassAffordance(), 'Small · chatlegal-1')
    assert.equal(modelClassAffordance(modelClassForTier('Basic')), 'Small · chatlegal-1')
  })

  it('stays a label: no proxy, no model env, and no other class', () => {
    const source = fs.readFileSync(path.join(appDir, 'lib/model-class.ts'), 'utf8')
    const example = fs.readFileSync(path.join(appDir, '.env.example'), 'utf8')
    const messages = fs.readFileSync(path.join(appDir, 'app/api/matters/[matterId]/messages/route.ts'), 'utf8')
    const composer = fs.readFileSync(path.join(appDir, 'components/chat/composer/composer.tsx'), 'utf8')
    const card = fs.readFileSync(path.join(appDir, 'components/shell/plan-usage-card.tsx'), 'utf8')

    assert.doesNotMatch(source, /process\.env|CHATLEGAL_|LiteLLM|litellm|fetch\(|generateText|streamText/)
    assert.match(example, /CHATLEGAL_MATTERS_DB/)
    assert.match(example, /CHATLEGAL_WORKSPACE_ROOT/)
    assert.match(example, /CHATLEGAL_OM_MODEL/)
    assert.doesNotMatch(example, /CHATLEGAL_(SMALL|DEFAULT|CLASS|CHAT)_MODEL/)
    // G-00: the route may gate on LiteLLM, but it reads no env and names no
    // model id itself. The label chatlegal-1 and its Concierge resolution
    // live in lib/llm (config.ts resolveOutboundModelId), not here.
    assert.doesNotMatch(messages, /process\.env|CHATLEGAL_|chatlegal-1|model-class|generateText|streamText|fetch\(/)
    assert.match(messages, /isLiteLLMEnabled\(\)/)
    const litellm = fs.readFileSync(path.join(appDir, 'lib/llm/config.ts'), 'utf8')
    assert.match(litellm, /CHATLEGAL_LITELLM_BASE_URL/)
    assert.match(litellm, /chatlegal-1/)
    assert.doesNotMatch(composer, /DropdownMenu|<select|Medium|Large|SOTA|process\.env|fetch\(/)
    assert.doesNotMatch(card, /DropdownMenu|<select|Medium|Large|SOTA|process\.env|fetch\(/)
    assert.match(composer, /data-slot="model-class"/)
    assert.match(card, /data-slot="model-class"/)
  })

  it('shows the same class on the plan card and the composer', () => {
    const card = renderToStaticMarkup(createElement(PlanUsageCard))
    assert.match(card, /data-plan-model-class="small"/)
    assert.match(card, /data-plan-model-id="chatlegal-1"/)
    assert.match(card, /data-slot="model-class"/)
    assert.match(card, /Small · chatlegal-1/)

    const controller = createComposerController({
      matterId: 'matter-1',
      ready: true,
      controls: { send: async () => ({ ok: true }) },
    })
    const composer = renderToStaticMarkup(
      createElement(ComposerView, { state: controller.getState(), controller, threadStatus: 'ready' }),
    )
    assert.match(composer, /data-slot="model-class"/)
    assert.match(composer, /data-model-class="small"/)
    assert.match(composer, /data-model-id="chatlegal-1"/)
    assert.match(composer, /Small · chatlegal-1/)
    assert.doesNotMatch(composer, /<button[^>]*data-slot="model-class"/)
  })
})
