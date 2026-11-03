import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { flattenNav, normaliseHref } from '../lib/nav.ts'

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appDir = path.join(siteRoot, 'app')

function walk(dir: string): string[] {
  const hrefs: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      hrefs.push(...walk(full))
    } else if (entry.name === 'page.mdx') {
      const rel = path.relative(appDir, path.dirname(full))
      hrefs.push(`/${rel.split(path.sep).join('/')}/`)
    }
  }
  return hrefs
}

const fromFiles = new Set(walk(path.join(appDir, 'docs')).map(normaliseHref))
const fromNav = new Set(flattenNav().map((item) => normaliseHref(item.href)))

const missingFiles = [...fromNav].filter((href) => !fromFiles.has(href))
const extraFiles = [...fromFiles].filter((href) => !fromNav.has(href))

if (missingFiles.length || extraFiles.length) {
  console.error('Docs routes and lib/nav.ts disagree.')
  if (missingFiles.length) console.error('Missing page.mdx for:', missingFiles.join(', '))
  if (extraFiles.length) console.error('Not in nav:', extraFiles.join(', '))
  process.exit(1)
}

console.log(`Docs routes OK (${fromNav.size} pages)`)
