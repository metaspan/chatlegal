import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isPublicAppPath, protectSignedInRoute } from './route-policy.ts'

const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('Consumer route gate', () => {
  it('leaves Clerk sign-in and sign-up public', () => {
    for (const pathname of ['/sign-in', '/sign-in/factor-one', '/sign-up', '/sign-up/verify']) {
      assert.equal(isPublicAppPath(pathname), true, pathname)
    }
  })

  it('does not treat lookalike paths as public', () => {
    for (const pathname of ['/sign-in-help', '/signing', '/sign-up-later', '/']) {
      assert.equal(isPublicAppPath(pathname), false, pathname)
    }
  })

  it('calls protect() for signed-in app routes and skips it for auth routes', async () => {
    const calls: string[] = []
    const auth = {
      protect: async () => {
        calls.push('protect')
      },
    }
    await protectSignedInRoute('/sign-in', auth)
    await protectSignedInRoute('/sign-up/continue', auth)
    assert.deepEqual(calls, [])
    for (const pathname of [
      '/',
      '/library',
      '/matters',
      '/chats',
      '/work',
      '/work/later',
      '/api/matters',
      '/api/matters/matter-1',
      '/api/matters/matter-1/files',
      '/api/matters/matter-1/index',
      '/api/library',
      '/api/library/index',
      '/api/workspace/move',
      '/api/workspace/content',
    ]) {
      await protectSignedInRoute(pathname, auth)
    }
    assert.equal(calls.length, 14)
  })

  it('sends the old /matters bookmark to /chats', () => {
    const page = fs.readFileSync(path.join(appDir, 'app/(app)/matters/page.tsx'), 'utf8')
    const chats = fs.readFileSync(path.join(appDir, 'app/(app)/chats/page.tsx'), 'utf8')
    const config = fs.readFileSync(path.join(appDir, 'next.config.ts'), 'utf8')
    assert.match(page, /requireConsumerSession/)
    assert.match(page, /redirect\('\/chats'\)/)
    assert.match(chats, />Chats</)
    assert.doesNotMatch(chats, /matter/i)
    assert.match(config, /source: '\/matters'/)
    assert.match(config, /destination: '\/chats'/)
  })

  it('wires clerkMiddleware to the route gate and keeps the Frontend API matcher', () => {
    const source = fs.readFileSync(path.join(appDir, 'proxy.ts'), 'utf8')
    assert.match(source, /clerkMiddleware/)
    assert.match(source, /protectSignedInRoute/)
    assert.match(source, /\/__clerk\/\(\.\*\)/)
    assert.doesNotMatch(source, /better-auth|OrganizationSwitcher|createRouteMatcher/)
  })
})
