/**
 * Observational memory on the matter Memory instance.
 *
 * Adapted from getAgentMemory in dcolley/tourbillon@7a8595b
 * packages/mastra/src/agent-factory.ts: an explicit model, scope `thread`,
 * and never `observationalMemory: true` (that turns on Mastra's Gemini default).
 *
 * Scope `resource` would keep one summary for every matter of the same Clerk
 * user. Scope `thread` keeps it on the open matter. Retrieval stays off because
 * its default scope is `resource`, which can read other threads.
 *
 * The observer and the reflector call a model. Both stay off unless
 * CHATLEGAL_OM_ENABLED is the word true and CHATLEGAL_OM_MODEL names a model.
 * Reading a summary that is already stored does not call a model.
 */

/** Mastra's own observer threshold. Named here so the config does not use the boolean default. */
const OBSERVER_MESSAGE_TOKENS = 30_000
/** Mastra's own reflector threshold. */
const REFLECTOR_OBSERVATION_TOKENS = 40_000

export type MatterObservationalMemoryConfig = {
  model: string
  scope: 'thread'
  retrieval: false
  observation: { messageTokens: number }
  reflection: { observationTokens: number }
}

export function matterObservationalMemoryConfig(
  env: NodeJS.ProcessEnv = process.env,
): MatterObservationalMemoryConfig | false {
  if (env.CHATLEGAL_OM_ENABLED?.trim().toLowerCase() !== 'true') return false
  const model = env.CHATLEGAL_OM_MODEL?.trim()
  if (!model) return false
  return {
    model,
    scope: 'thread',
    retrieval: false,
    observation: { messageTokens: OBSERVER_MESSAGE_TOKENS },
    reflection: { observationTokens: REFLECTOR_OBSERVATION_TOKENS },
  }
}

/**
 * Text the concierge would see for this matter.
 * A resource-scoped row, or a row for a different thread or owner, is ignored.
 */
export function matterObservationSummary(
  record: {
    scope?: string | null
    threadId?: string | null
    resourceId?: string | null
    activeObservations?: string | null
  } | null | undefined,
  expected: { matterId: string; resourceId: string },
): string {
  if (!record) return ''
  if (record.scope !== 'thread') return ''
  if (record.threadId !== expected.matterId) return ''
  if (record.resourceId !== expected.resourceId) return ''
  if (typeof record.activeObservations !== 'string') return ''
  return record.activeObservations.trim()
}
