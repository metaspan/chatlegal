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

const deposit = read('docs/housing/deposit/index.html')
const depositEdit =
  'https://github.com/metaspan/chatlegal/edit/main/apps/site/app/docs/housing/deposit/page.mdx'
if (!deposit.includes('Suggest a change to this page…') || !deposit.includes(depositEdit)) {
  console.error('Deposit page is missing the suggest-edit link')
  process.exit(1)
}
if (!deposit.includes('target="_blank"') || !deposit.includes('rel="noopener noreferrer"')) {
  console.error('Suggest-edit link is missing target or rel')
  process.exit(1)
}

const overview = read('docs/index.html')
const overviewEdit = 'https://github.com/metaspan/chatlegal/edit/main/apps/site/app/docs/page.mdx'
if (!overview.includes(overviewEdit)) {
  console.error('Overview suggest-edit link does not target apps/site/app/docs/page.mdx')
  process.exit(1)
}

const eviction = read('docs/housing/illegal-eviction/index.html')
if (!eviction.toLowerCase().includes('hard-escalate')) {
  console.error('Illegal eviction page is missing the hard-escalate callout')
  process.exit(1)
}

const home = read('index.html')
if (/http-equiv=["']refresh["']/i.test(home)) {
  console.error('out/index.html still meta-refreshes away from the landing page')
  process.exit(1)
}
for (const snippet of [
  'Join the beta waitlist',
  'Read the docs',
  'id="waitlist"',
  'href="/docs/"',
  'https://github.com/metaspan/chatlegal',
  'Source &amp; project brief on GitHub',
  disclaimer,
  'class="disclaimer"',
]) {
  if (!home.includes(snippet)) {
    console.error(`Landing page is missing ${JSON.stringify(snippet)}`)
    process.exit(1)
  }
}
if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() && !home.includes('Waitlist opening soon')) {
  console.error('Landing page should show the closed waitlist when the site key is unset')
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

const blocked = /officialinjuryclaim|oic\.gov|ask a question/i
const secretNames = /RECAPTCHA_SECRET_KEY|CHATLEGAL_WAITLIST_WEBHOOK_URL|CHATLEGAL_WAITLIST_WEBHOOK_HEADER/
function walkFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(full))
    else files.push(full)
  }
  return files
}

for (const file of walk(outDir)) {
  const html = fs.readFileSync(file, 'utf8')
  const relative = path.relative(outDir, file)
  if (blocked.test(html) || (relative !== 'index.html' && /textarea/i.test(html))) {
    console.error(`Unexpected content in ${relative}`)
    process.exit(1)
  }
}

for (const file of walkFiles(outDir)) {
  const text = fs.readFileSync(file, 'utf8')
  if (secretNames.test(text)) {
    console.error(`Static export contains a server env name: ${path.relative(outDir, file)}`)
    process.exit(1)
  }
}

console.log(`Static export OK (${flattenNav().length} docs pages)`)
