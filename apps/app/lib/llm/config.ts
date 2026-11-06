/**
 * Server-only LiteLLM proxy settings (G-00).
 *
 * The proxy is the LiteLLM router. Concierge and TaskRunner model ids resolve
 * there. This module is read by route handlers and server code only. The API
 * key must never reach a client bundle: it is not a public client-side
 * variable and nothing here returns it to the browser.
 *
 * Gate style mirrors the other env-gated services:
 * lib/matters/observational-memory.ts (F-04) and lib/embeddings/config.ts (D-03).
 * There is no ENABLED flag. The proxy is a key-gated service: on when the base
 * URL and the API key are both present and valid, off otherwise.
 *
 * The base URL follows the D-03 rules through embedBaseUrl: http or https, and
 * a user name, password, query string, or fragment is refused so a key cannot
 * be tucked into the URL. The session stickiness header name and its default
 * x-litellm-session-id are adapted from dcolley/tourbillon@7a8595b
 * apps/web/lib/llm-providers.ts (stickinessHeaderName, chat stickiness).
 */

import { embedBaseUrl } from '../embeddings/config'

/** Alias issued by Ops on the router. */
export const DEFAULT_CONCIERGE_MODEL = 'chatlegal-concierge'
/** Alias issued by Ops on the router. TaskRunner is wired in G-02; the helper is exported for it. */
export const DEFAULT_TASKRUNNER_MODEL = 'chatlegal-taskrunner'
/** Header that pins a conversation to one router worker (chat stickiness). */
export const DEFAULT_SESSION_HEADER = 'x-litellm-session-id'

export type LiteLLMConfig = {
  baseUrl: string
  apiKey: string
  conciergeModel: string
  taskRunnerModel: string
  sessionHeader: string
}

/**
 * Off unless CHATLEGAL_LITELLM_BASE_URL and CHATLEGAL_LITELLM_API_KEY are both
 * present and valid. Values are trimmed. A blank value counts as unset.
 */
export function litellmConfig(env: NodeJS.ProcessEnv = process.env): LiteLLMConfig | false {
  const baseUrl = litellmBaseUrl(env.CHATLEGAL_LITELLM_BASE_URL)
  if (!baseUrl) return false
  const apiKey = env.CHATLEGAL_LITELLM_API_KEY?.trim()
  if (!apiKey) return false
  return {
    baseUrl,
    apiKey,
    conciergeModel: env.CHATLEGAL_CONCIERGE_MODEL?.trim() || DEFAULT_CONCIERGE_MODEL,
    taskRunnerModel: env.CHATLEGAL_TASKRUNNER_MODEL?.trim() || DEFAULT_TASKRUNNER_MODEL,
    sessionHeader: sessionHeaderName(env.CHATLEGAL_LITELLM_SESSION_HEADER),
  }
}

export function isLiteLLMEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return litellmConfig(env) !== false
}

/** The Concierge model id, or null when the proxy is off. */
export function getConciergeModel(env: NodeJS.ProcessEnv = process.env): string | null {
  const config = litellmConfig(env)
  return config ? config.conciergeModel : null
}

/** The TaskRunner model id, or null when the proxy is off. Unused by the UI until G-02. */
export function getTaskRunnerModel(env: NodeJS.ProcessEnv = process.env): string | null {
  const config = litellmConfig(env)
  return config ? config.taskRunnerModel : null
}

/**
 * The outbound model id for a model class name (C-06 / C-07).
 * The Small class names chatlegal-1. That label stays in the UI. When the
 * proxy is on, chatlegal-1 and small resolve here to the Concierge alias, so
 * the id is chosen on the server. Any other name is sent as it is.
 * Returns null when the proxy is off: there is no outbound call to make.
 */
export function resolveOutboundModelId(modelId: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const config = litellmConfig(env)
  if (!config) return null
  const id = modelId.trim()
  if (!id || id === 'chatlegal-1' || id === 'small') return config.conciergeModel
  return id
}

/** Same http(s) rules as the D-03 embeddings base URL: no secret in the URL, no trailing slash. */
export function litellmBaseUrl(raw: string | undefined): string | null {
  return embedBaseUrl(raw)
}

export function chatCompletionsEndpoint(baseUrl: string): string {
  return baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`
}

/** A header name that cannot smuggle a value: token characters only, else the default. */
function sessionHeaderName(raw: string | undefined): string {
  const trimmed = raw?.trim().toLowerCase()
  if (!trimmed || !/^[a-z0-9-]+$/.test(trimmed)) return DEFAULT_SESSION_HEADER
  return trimmed
}
