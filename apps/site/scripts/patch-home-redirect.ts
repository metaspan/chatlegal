import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const indexPath = path.join(siteRoot, 'out', 'index.html')
let html = fs.readFileSync(indexPath, 'utf8')

if (!/http-equiv=["']refresh["']/i.test(html)) {
  const tag = '<meta http-equiv="refresh" content="0; url=/docs/" />'
  if (!html.includes('</head>')) {
    console.error('out/index.html has no </head>')
    process.exit(1)
  }
  html = html.replace('</head>', `${tag}</head>`)
  fs.writeFileSync(indexPath, html)
  console.log('Added home → /docs/ meta refresh')
} else {
  console.log('Home meta refresh already present')
}
