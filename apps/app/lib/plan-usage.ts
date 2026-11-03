/**
 * Stub plan for the signed-in shell.
 * Remaining use is not counted. Upgrade stays closed.
 * No environment variables, and no billing provider.
 */

export const basicPlanUsage = {
  tierName: 'Basic',
  priceLabel: 'Free',
  remainingKind: 'placeholder',
  remainingLabel: 'Nothing is counted yet',
  remainingDetail: 'What is left will show here.',
  upgradeLabel: 'Upgrade',
  upgradeAvailable: false,
  upgradeDetail: 'Upgrade is not available yet.',
} as const

export type PlanUsageStub = typeof basicPlanUsage
