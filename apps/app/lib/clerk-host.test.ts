import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_ORIGIN, assertAppClerkHost } from './clerk-host.ts'

const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoDir = path.join(appDir, '../..')

describe('app.chatlegal.uk host lock', () => {
  it('accepts this origin and localhost, and rejects the docs site', () => {
    assert.doesNotThrow(() =>
      assertAppClerkHost({
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: 'https://app.chatlegal.uk/sign-in',
        NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: 'https://app.chatlegal.uk/',
        NEXT_PUBLIC_CLERK_PROXY_URL: 'https://app.chatlegal.uk/__clerk',
      }),
    )
    assert.doesNotThrow(() =>
      assertAppClerkHost({
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/sign-in',
        NEXT_PUBLIC_CLERK_SIGN_UP_URL: 'http://localhost:3000/sign-up',
      }),
    )
    assert.throws(
      () => assertAppClerkHost({ NEXT_PUBLIC_CLERK_SIGN_IN_URL: 'https://chatlegal.uk/sign-in' }),
      /docs site/,
    )
    assert.throws(
      () => assertAppClerkHost({ NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: 'https://www.chatlegal.uk/' }),
      /docs site/,
    )
    assert.throws(() => assertAppClerkHost({ NEXT_PUBLIC_CLERK_IS_SATELLITE: 'true' }), /satellite/)
    assert.throws(() => assertAppClerkHost({ NEXT_PUBLIC_CLERK_DOMAIN: 'chatlegal.uk' }), /app\.chatlegal\.uk/)
  })

  it('env stub and provider target https://app.chatlegal.uk only', () => {
    const example = fs.readFileSync(path.join(appDir, '.env.example'), 'utf8')
    const layout = fs.readFileSync(path.join(appDir, 'app/layout.tsx'), 'utf8')
    assert.match(example, /NEXT_PUBLIC_CLERK_SIGN_IN_URL=https:\/\/app\.chatlegal\.uk\/sign-in/)
    assert.match(example, /NEXT_PUBLIC_CLERK_SIGN_UP_URL=https:\/\/app\.chatlegal\.uk\/sign-up/)
    assert.match(example, /NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=https:\/\/app\.chatlegal\.uk\//)
    assert.match(example, /NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=https:\/\/app\.chatlegal\.uk\//)
    const assignments = example.split('\n').filter((line) => /^[A-Z0-9_]+=/.test(line))
    for (const line of assignments) {
      for (const url of line.match(/https:\/\/\S+/g) ?? []) {
        assert.equal(new URL(url).origin, 'https://app.chatlegal.uk', line)
      }
    }
    assert.match(layout, /allowedRedirectOrigins/)
    assert.match(layout, /APP_ORIGIN/)
    assert.equal(APP_ORIGIN, 'https://app.chatlegal.uk')
  })

  it('apps/site has no Clerk', () => {
    const siteDir = path.join(repoDir, 'apps/site')
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'out') continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (/\.(ts|tsx|js|mjs|css|yml|yaml|example|md)$/.test(entry.name)) {
          const source = fs.readFileSync(full, 'utf8')
          if (/@clerk|CLERK_|ClerkProvider|clerkMiddleware/.test(source)) hits.push(path.relative(repoDir, full))
        }
      }
    }
    walk(siteDir)
    assert.deepEqual(hits, [])
  })
})