import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Badge } from '../components/ui/badge.tsx'
import { Card, CardHeader, CardTitle } from '../components/ui/card.tsx'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('M1 design tokens', () => {
  const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8')

  it('keeps the locked light palette as the only hex assignments', () => {
    const once: Record<string, string> = {
      '#f3ecdf': '--bg:',
      '#faf6ef': '--bg-raised:',
      '#221c16': '--selection-ink:',
      '#5e564c': '--ink-muted:',
      '#1c4f4a': '--link:',
      '#6e2430': '--chrome:',
      '#8a3140': '--chrome-dark:',
      '#fff7f4': '--chrome-ink:',
    }
    for (const [hex, declaration] of Object.entries(once)) {
      assert.equal(count(css, hex), 1, hex)
      assert.match(css, new RegExp(`${declaration}\\s*${hex}`))
    }
    assert.match(css, /--ink:\s*var\(--selection-ink\)/)
    assert.match(css, /--background:\s*var\(--bg\)/)
    assert.match(css, /--foreground:\s*var\(--ink\)/)
    assert.match(css, /--card:\s*var\(--bg-raised\)/)
    assert.match(css, /--primary:\s*var\(--chrome\)/)
    assert.match(css, /--primary-foreground:\s*var\(--chrome-ink\)/)
    assert.match(css, /--muted-foreground:\s*var\(--ink-muted\)/)
    assert.match(css, /--ring:\s*var\(--link\)/)
    assert.match(css, /--sidebar:\s*var\(--bg-raised\)/)
    assert.match(css, /--color-link:\s*var\(--link\)/)
    assert.match(css, /--color-chrome:\s*var\(--chrome\)/)
    assert.match(css, /--font-serif:\s*var\(--font-newsreader\)/)
    assert.match(css, /--font-sans:\s*var\(--font-atkinson\)/)
  })

  it('uses the locked darker burgundy for dark chrome', () => {
    assert.match(css, /--chrome:\s*var\(--chrome-dark\)/)
    assert.match(css, /--link:\s*var\(--link-bright\)/)
    assert.match(css, /--link-bright:\s*#9ed9d1/)
    assert.doesNotMatch(css, /--background:\s*#/)
    assert.doesNotMatch(css, /--primary:\s*#/)
  })

  it('points Clerk at the same tokens', () => {
    const clerk = fs.readFileSync(path.join(root, 'lib/clerk-appearance.ts'), 'utf8')
    assert.match(clerk, /colorPrimary:\s*'var\(--chrome\)'/)
    assert.match(clerk, /colorBackground:\s*'var\(--bg-raised\)'/)
    assert.match(clerk, /colorText:\s*'var\(--ink\)'/)
    assert.match(clerk, /colorTextSecondary:\s*'var\(--ink-muted\)'/)
    assert.match(clerk, /colorInputBackground:\s*'var\(--bg\)'/)
    assert.doesNotMatch(clerk, /#[0-9a-fA-F]{3,8}/)
  })

  it('paints the three-pane shell with those tokens', () => {
    const bar = fs.readFileSync(path.join(root, 'components/shell/app-bar.tsx'), 'utf8')
    const viewer = fs.readFileSync(path.join(root, 'components/shell/document-viewer.tsx'), 'utf8')
    const chat = fs.readFileSync(path.join(root, 'components/chat/composer/composer.tsx'), 'utf8')
    const history = fs.readFileSync(path.join(root, 'components/shell/history-pane.tsx'), 'utf8')
    const button = fs.readFileSync(path.join(root, 'components/ui/button.tsx'), 'utf8')
    assert.match(bar, /data-chrome="burgundy"/)
    assert.match(bar, /bg-chrome/)
    assert.match(bar, /text-chrome-ink/)
    assert.match(viewer, /bg-sidebar/)
    assert.match(chat, /bg-card/)
    assert.match(history, /var\(--chrome\)/)
    assert.match(button, /text-link/)
    assert.doesNotMatch(button, /link: "text-primary/)
  })

  it('renders the card and badge baseline', () => {
    const card = renderToStaticMarkup(
      createElement(Card, null, createElement(CardHeader, null, createElement(CardTitle, null, 'Signed in'))),
    )
    assert.match(card, /data-slot="card"/)
    assert.match(card, /data-slot="card-title"/)
    assert.match(card, /Signed in/)

    const badge = renderToStaticMarkup(createElement(Badge, { variant: 'secondary' }, 'Personal account'))
    assert.match(badge, /data-slot="badge"/)
    assert.match(badge, /data-variant="secondary"/)
    assert.match(badge, /Personal account/)
  })
})

function count(source: string, needle: string): number {
  return source.split(needle).length - 1
}
