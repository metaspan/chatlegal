import fs from 'node:fs'
import path from 'node:path'

/** Repo-root `docs/`, sibling of `apps/`, read while this app builds. */
export function siblingDocsRoot(): string {
  return path.resolve(process.cwd(), '../../docs')
}

export function assertSiblingDocs(): void {
  const root = siblingDocsRoot()
  const planPath = path.join(root, 'SITE_DOCS_PLAN.md')
  const plan = fs.readFileSync(planPath, 'utf8')
  const required = [
    'Not a solicitor. Not legal advice.',
    '/docs/housing/possession-notice',
    '/docs/sources/link-out-only',
    '/docs/for-agents',
    'apps/site',
  ]
  for (const snippet of required) {
    if (!plan.includes(snippet)) {
      throw new Error(`docs/SITE_DOCS_PLAN.md is missing ${JSON.stringify(snippet)}`)
    }
  }
}
