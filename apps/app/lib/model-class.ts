/**
 * Default model class for the signed-in shell.
 * Basic maps to Small, and Small names chatlegal-1.
 * This is a label only. It does not call a proxy, and it does not read a model setting.
 * Medium, Large, and SOTA are not offered yet.
 * Observational memory still uses its own setting when that is turned on. That id is not this class.
 */

export const smallModelClass = {
  id: 'small',
  label: 'Small',
  modelId: 'chatlegal-1',
} as const

export type ModelClass = typeof smallModelClass

export const planTierModelClasses = {
  Basic: smallModelClass,
} as const

export type PlanTierName = keyof typeof planTierModelClasses

export function modelClassForTier(tierName: PlanTierName): ModelClass {
  return planTierModelClasses[tierName]
}

export const defaultModelClass = modelClassForTier('Basic')

/** Quiet line for the plan card and the composer. Same words in both places. */
export function modelClassAffordance(modelClass: ModelClass = defaultModelClass): string {
  return `${modelClass.label} · ${modelClass.modelId}`
}
