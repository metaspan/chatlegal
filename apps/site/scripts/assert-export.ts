import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { flattenNav } from '../lib/nav.ts'

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(siteRoot, 'out')

function read(relative: string): string {
  const file = path.join(outDir, relative)
  if (!fs.existsSync(file)) {
    console.error(`Missing export file: ${relative}`)
    process.exit(1)
  }
  return fs.readFileSync(file, 'utf8')
}

const disclaimer = 'Not a solicitor. Not legal advice.'
const major = [
  'docs/index.html',
  'docs/how-it-works/index.html',
  'docs/housing/index.html',
  'docs/housing/deposit/index.html',
  'docs/housing/illegal-eviction/index.html',
  'docs/employment/index.html',
  'docs/employment/unpaid-wages/index.html',
  'docs/consumer/index.html',
  'docs/consumer/private-parking/index.html',
  'docs/welfare/index.html',
  'docs/welfare/uc-sanction-mr/index.html',
  'docs/sources/index.html',
  'docs/sources/link-out-only/index.html',
  'docs/referrals/index.html',
  'docs/policies/index.html',
  'docs/for-agents/index.html',
]

for (const relative of major) {
  const html = read(relative)
  if (!html.includes(disclaimer) || !html.includes('class="disclaimer"')) {
    console.error(`${relative} is missing the sticky disclaimer footer`)
    process.exit(1)
  }
  if (html.includes('class="banner"')) {
    console.error(`${relative} still has the top banner`)
    process.exit(1)
  }
}

const eviction = read('docs/housing/illegal-eviction/index.html')
if (!eviction.toLowerCase().includes('hard-escalate')) {
  console.error('Illegal eviction page is missing the hard-escalate callout')
  process.exit(1)
}

const home = read('index.html')
if (!/http-equiv=["']refresh["'][^>]*url=\/docs\//i.test(home) && !home.includes('url=/docs/')) {
  console.error('out/index.html does not refresh to /docs/')
  process.exit(1)
}
if (!home.includes('href="/docs/"') && !home.includes('href="/docs"')) {
  console.error('out/index.html has no link to /docs/')
  process.exit(1)
}

const llms = read('llms.txt')
if (!llms.startsWith('# ChatLegal docs')) {
  console.error('llms.txt is missing its title')
  process.exit(1)
}
if (!llms.includes(disclaimer)) {
  console.error('llms.txt is missing the not-legal-advice line')
  process.exit(1)
}
for (const item of flattenNav()) {
  const htmlPath = `${item.href.replace(/^\//, '')}index.html`
  read(htmlPath)
  if (!llms.includes(`https://chatlegal.uk${item.href}`)) {
    console.error(`llms.txt is missing ${item.href}`)
    process.exit(1)
  }
}

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else if (entry.name.endsWith('.html')) files.push(full)
  }
  return files
}

const blocked = /officialinjuryclaim|oic\.gov|textarea|ask a question/i
for (const file of walk(outDir)) {
  const html = fs.readFileSync(file, 'utf8')
  if (blocked.test(html)) {
    console.error(`Unexpected content in ${path.relative(outDir, file)}`)
    process.exit(1)
  }
}

console.log(`Static export OK (${flattenNav().length} docs pages)`)
