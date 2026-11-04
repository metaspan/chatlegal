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

  it('covers the home, library, matters, and work routes', () => {
    const rels = pages.map((file) => path.relative(signedInDir, file)).sort()
    assert.deepEqual(rels, ['layout.tsx', 'library/page.tsx', 'matters/page.tsx', 'page.tsx', 'work/page.tsx'])
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
      [
        'app/api/matters/[matterId]/files/route.ts',
        'app/api/matters/[matterId]/messages/route.ts',
        'app/api/matters/[matterId]/route.ts',
        'app/api/matters/[matterId]/widgets/[toolCallId]/answer/route.ts',
        'app/api/matters/[matterId]/widgets/route.ts',
        'app/api/matters/route.ts',
      ],
    )
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
      assert.match(source, /requireConsumerSession/)
      assert.doesNotMatch(source, /searchParams|userId=/)
    }
  })

  it('library and workspace move check the session', () => {
    for (const rel of ['app/api/library/route.ts', 'app/api/workspace/move/route.ts']) {
      const source = fs.readFileSync(path.join(appDir, rel), 'utf8')
      assert.match(source, /requireConsumerSession/, rel)
      assert.doesNotMatch(source, /searchParams|userId=/, rel)
    }
  })

  it('workspace content checks the session and does not take a user id from the query', () => {
    const source = fs.readFileSync(path.join(appDir, 'app/api/workspace/content/route.ts'), 'utf8')
    assert.match(source, /requireConsumerSession/)
    assert.match(source, /searchParams/)
    assert.doesNotMatch(source, /userId=/)
  })

  it('sign-in and sign-up pages do not require a session', () => {
    for (const rel of ['app/sign-in/[[...sign-in]]/page.tsx', 'app/sign-up/[[...sign-up]]/page.tsx']) {
      const source = fs.readFileSync(path.join(appDir, rel), 'utf8')
      assert.doesNotMatch(source, /requireConsumerSession/)
      assert.match(source, /Sign(In|Up)/)
    }
  })
})
