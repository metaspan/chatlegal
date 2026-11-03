import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsRoot = path.resolve(siteRoot, '../../docs')

const required = [
  'SITE_DOCS_PLAN.md',
  'CURATED_LAWS.md',
  'SOURCE_LICENCE_ALLOWLIST.md',
  'REFERRALS.md',
  'CASE_TAXONOMY.md',
  'policies/01-code-of-ethics.md',
]

for (const relative of required) {
  const file = path.join(docsRoot, relative)
  if (!fs.existsSync(file)) {
    console.error(`Missing sibling docs file: ${file}`)
    process.exit(1)
  }
}

const plan = fs.readFileSync(path.join(docsRoot, 'SITE_DOCS_PLAN.md'), 'utf8')
const snippets = [
  'Not a solicitor. Not legal advice.',
  '/docs/housing/deposit',
  '/docs/employment/unpaid-wages',
  '/docs/consumer/private-parking',
  '/docs/welfare/uc-sanction-mr',
  '/docs/sources/attribution',
  '/docs/referrals',
  '/docs/for-agents',
]

for (const snippet of snippets) {
  if (!plan.includes(snippet)) {
    console.error(`docs/SITE_DOCS_PLAN.md is missing ${JSON.stringify(snippet)}`)
    process.exit(1)
  }
}

console.log(`Sibling docs/ OK (${plan.length} bytes in SITE_DOCS_PLAN.md)`)
