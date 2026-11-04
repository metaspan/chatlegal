import { modelClassAffordance, modelClassForTier } from './model-class'

/**
 * Stub plan for the signed-in shell.
 * Remaining use is not counted. Upgrade stays closed.
 * Basic uses the default model class (Small, chatlegal-1). That is a label only.
 * No environment variables, and no billing provider.
 */

const basicClass = modelClassForTier('Basic')

export const basicPlanUsage = {
  tierName: 'Basic',
  priceLabel: 'Free',
  modelClassId: basicClass.id,
  modelClassLabel: basicClass.label,
  modelId: basicClass.modelId,
  modelClassAffordance: modelClassAffordance(basicClass),
  remainingKind: 'placeholder',
  remainingLabel: 'Nothing is counted yet',
  remainingDetail: 'What is left will show here.',
  upgradeLabel: 'Upgrade',
  upgradeAvailable: false,
  upgradeDetail: 'Upgrade is not available yet.',
} as const

export type PlanUsageStub = typeof basicPlanUsage
