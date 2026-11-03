import fs from 'node:fs'
import path from 'node:path'

/**
 * Local libSQL file. No secret is required.
 * CHATLEGAL_MATTERS_DB may be a file:, libsql:, https:, or :memory: URL,
 * or a filesystem path. On the host, point it outside the release directory
 * (file:/var/lib/chatlegal/matters.db) so a new checkout does not wipe matters.
 * A later move to hosted libSQL keeps this URL and adds CHATLEGAL_MATTERS_AUTH_TOKEN.
 * A later move to Postgres swaps the store for @mastra/pg and keeps the matter API.
 */

const FILE_URL = /^(file:|libsql:|https:|http:|:memory:)/

export function mattersDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.CHATLEGAL_MATTERS_DB?.trim()
  if (!configured) return `file:${path.join(process.cwd(), 'data', 'matters.db')}`
  if (FILE_URL.test(configured)) return configured
  return `file:${configured}`
}

export function mattersDatabaseAuthToken(url: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (!(url.startsWith('libsql:') || url.startsWith('https:') || url.startsWith('http:'))) return undefined
  const token = env.CHATLEGAL_MATTERS_AUTH_TOKEN?.trim()
  return token || undefined
}

/** Parent directory for a local file database. Remote and memory URLs are left alone. */
export function ensureMattersDatabaseDirectory(url: string): void {
  if (!url.startsWith('file:')) return
  const spec = url.slice('file:'.length)
  if (!spec || spec === ':memory:' || spec.startsWith(':memory:')) return
  fs.mkdirSync(path.dirname(path.resolve(spec)), { recursive: true })
}
