import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderLlmsTxt } from '../lib/nav.ts'

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(siteRoot, 'public', 'llms.txt')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, renderLlmsTxt())
console.log(`Wrote ${path.relative(siteRoot, target)}`)
