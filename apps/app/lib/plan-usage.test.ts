import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { basicPlanUsage } from './plan-usage.ts'

const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('basic plan stub', () => {
  it('names Basic, free, with a remaining placeholder and a closed upgrade', () => {
    assert.equal(basicPlanUsage.tierName, 'Basic')
    assert.equal(basicPlanUsage.priceLabel, 'Free')
    assert.equal(basicPlanUsage.modelClassId, 'small')
    assert.equal(basicPlanUsage.modelClassLabel, 'Small')
    assert.equal(basicPlanUsage.modelId, 'chatlegal-1')
    assert.equal(basicPlanUsage.modelClassAffordance, 'Small · chatlegal-1')
    assert.equal(basicPlanUsage.remainingKind, 'placeholder')
    assert.equal(basicPlanUsage.remainingLabel, 'Nothing is counted yet')
    assert.equal(basicPlanUsage.remainingDetail, 'What is left will show here.')
    assert.equal(basicPlanUsage.upgradeLabel, 'Upgrade')
    assert.equal(basicPlanUsage.upgradeAvailable, false)
    assert.equal(basicPlanUsage.upgradeDetail, 'Upgrade is not available yet.')
  })

  it('keeps the card on the signed-in shell and adds no billing env', () => {
    const layout = fs.readFileSync(path.join(appDir, 'app/(app)/layout.tsx'), 'utf8')
    const shell = fs.readFileSync(path.join(appDir, 'components/dashboard-shell.tsx'), 'utf8')
    const history = fs.readFileSync(path.join(appDir, 'components/shell/history-pane.tsx'), 'utf8')
    const viewer = fs.readFileSync(path.join(appDir, 'components/shell/document-viewer.tsx'), 'utf8')
    const chat = fs.readFileSync(path.join(appDir, 'components/chat/chat-column.tsx'), 'utf8')
    const card = fs.readFileSync(path.join(appDir, 'components/shell/plan-usage-card.tsx'), 'utf8')
    const stub = fs.readFileSync(path.join(appDir, 'lib/plan-usage.ts'), 'utf8')
    const example = fs.readFileSync(path.join(appDir, '.env.example'), 'utf8')
    const signIn = fs.readFileSync(path.join(appDir, 'app/sign-in/[[...sign-in]]/page.tsx'), 'utf8')

    assert.match(layout, /requireConsumerSession/)
    assert.match(layout, /DashboardShell/)
    assert.match(shell, /HistoryPane/)
    assert.match(history, /PlanUsageCard/)
    assert.match(history, /data-plan-footer/)
    assert.doesNotMatch(viewer, /PlanUsageCard|data-plan-card/)
    assert.doesNotMatch(chat, /PlanUsageCard|data-plan-card/)
    assert.doesNotMatch(signIn, /PlanUsageCard|data-plan-card/)
    assert.match(example, /CHATLEGAL_MATTERS_DB/)
    assert.match(example, /CHATLEGAL_WORKSPACE_ROOT/)
    assert.doesNotMatch(example, /STRIPE|BILLING|CLERK_BILLING|PRICE_|USAGE_/i)
    assert.doesNotMatch(stub + card, /process\.env/)
    assert.doesNotMatch(card, /#[0-9a-fA-F]{3,8}/)
    assert.doesNotMatch(card, /@clerk\/|checkout|OrganizationSwitcher/)
  })
})
