import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { consumerSessionRedirect } from './session-guards.ts'

/**
 * Session-guard posture adapted from hitly-net/hitly@94b2e92
 * apps/app/lib/session-guards.test.ts: every signed-in page must call the
 * server session helper, and public auth pages must not.
 */

const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir: string): string[] {
  const found: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...walk(full))
    else found.push(full)
  }
  return found
}

describe('consumerSessionRedirect', () => {
  it('sends a missing user to sign-in', () => {
    assert.equal(consumerSessionRedirect(null), '/sign-in')
    assert.equal(consumerSessionRedirect(undefined), '/sign-in')
    assert.equal(consumerSessionRedirect(''), '/sign-in')
  })

  it('keeps a Consumer user id on the page', () => {
    assert.equal(consumerSessionRedirect('user_123'), null)
  })
})

describe('signed-in pages guard the session', () => {
  const signedInDir = path.join(appDir, 'app/(app)')
  const pages = walk(signedInDir).filter((file) => file.endsWith('page.tsx') || file.endsWith('layout.tsx'))

  it('covers the home, matters, and work routes', () => {
    const rels = pages.map((file) => path.relative(signedInDir, file)).sort()
    assert.deepEqual(rels, ['layout.tsx', 'matters/page.tsx', 'page.tsx', 'work/page.tsx'])
  })

  for (const file of pages) {
    it(`${path.relative(appDir, file)} checks the session server-side`, () => {
      const source = fs.readFileSync(file, 'utf8')
      assert.match(
        source,
        /requireConsumerSession/,
        `${file} must call requireConsumerSession(), so an invalid session redirects to /sign-in`,
      )
    })
  }

  it('matter routes check the session before listing or opening a matter', () => {
    const files = walk(path.join(appDir, 'app/api/matters')).filter((file) => file.endsWith('route.ts'))
    assert.deepEqual(
      files.map((file) => path.relative(appDir, file)).sort(),
      ['app/api/matters/[matterId]/route.ts', 'app/api/matters/route.ts'],
    )
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
      assert.match(source, /requireConsumerSession/)
      assert.doesNotMatch(source, /searchParams|userId=/)
    }
  })

  it('sign-in and sign-up pages do not require a session', () => {
    for (const rel of ['app/sign-in/[[...sign-in]]/page.tsx', 'app/sign-up/[[...sign-up]]/page.tsx']) {
      const source = fs.readFileSync(path.join(appDir, rel), 'utf8')
      assert.doesNotMatch(source, /requireConsumerSession/)
      assert.match(source, /Sign(In|Up)/)
    }
  })
})
