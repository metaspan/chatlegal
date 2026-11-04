/**
 * Prepared search stays off unless three settings are present.
 * Same shape as observational memory in lib/matters/observational-memory.ts:
 * the word true, plus the companion settings. Anything else leaves it off.
 *
 * No provider secret is read. A user name, password, query, or hash in the
 * base URL is refused so a key cannot be tucked into the URL.
 *
 * TODO(D-04): chat does not query this index.
 * TODO(G-00): Concierge and TaskRunner stay off. This does not start them.
 */

export type EmbeddingConfig = {
  model: string
  baseUrl: string
}

export function embeddingConfig(env: NodeJS.ProcessEnv = process.env): EmbeddingConfig | false {
  if (env.CHATLEGAL_EMBED_ENABLED?.trim().toLowerCase() !== 'true') return false
  const model = env.CHATLEGAL_EMBED_MODEL?.trim()
  const baseUrl = embedBaseUrl(env.CHATLEGAL_EMBED_BASE_URL)
  if (!model || !baseUrl) return false
  return { model, baseUrl }
}

/** http(s) origin or path, with no embedded secret and no trailing slash. */
export function embedBaseUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password || url.search || url.hash) return null
  return url.toString().replace(/\/$/, '')
}

export function embeddingsEndpoint(baseUrl: string): string {
  return baseUrl.endsWith('/embeddings') ? baseUrl : `${baseUrl}/embeddings`
}
