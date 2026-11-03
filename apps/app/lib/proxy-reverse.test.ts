import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

/**
 * Ops dry-run: nginx terminates TLS and proxies to 127.0.0.1:3011 with
 * Host: app.chatlegal.uk and X-Forwarded-Proto: https. Clerk's pk_test_
 * middleware rewrites that to localhost. This calls the proxy the way Next
 * does (absolute listen URL) and asserts the response never points there.
 */

process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_Y2xlcmsuZXhhbXBsZS5jb20k'
process.env.CLERK_SECRET_KEY = 'sk_test_chatlegalCiBuildPlaceholderNotARealSecret'
process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL = 'https://app.chatlegal.uk/sign-in'
process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL = 'https://app.chatlegal.uk/sign-up'
process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL = 'https://app.chatlegal.uk/'
process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL = 'https://app.chatlegal.uk/'

type Proxy = (request: NextRequest, event: { waitUntil: () => void }) => Promise<Response | undefined>

let proxy: Proxy

const LOOPBACK = /localhost|127\.0\.0\.1|\[::1\]|\/\/::1/

function forwarded(url: string, extra: Record<string, string> = {}) {
  return new NextRequest(url, {
    headers: {
      host: 'app.chatlegal.uk',
      'x-forwarded-host': 'app.chatlegal.uk',
      'x-forwarded-proto': 'https',
      ...extra,
    },
  })
}

function assertNoLoopback(response: Response, label: string) {
  const rewrite = response.headers.get('x-middleware-rewrite') ?? ''
  const location = response.headers.get('location') ?? ''
  assert.doesNotMatch(rewrite, LOOPBACK, `${label} rewrite points at the listen address: ${rewrite}`)
  assert.doesNotMatch(location, LOOPBACK, `${label} location points at the listen address: ${location}`)
}

describe('reverse proxy sign-in', () => {
  before(async () => {
    const imported = (await import('../proxy.ts')) as { default: Proxy }
    proxy = imported.default
  })

  for (const path of ['/sign-in', '/sign-up']) {
    it(`${path} does not rewrite to localhost behind app.chatlegal.uk`, async () => {
      const response = await proxy(forwarded(`https://127.0.0.1:3011${path}`), { waitUntil() {} })
      assert.ok(response)
      assert.equal(response.status, 200)
      assertNoLoopback(response, path)
      assert.equal(response.headers.get('location'), null)
    })

    it(`${path} stays 200 for a browser document request`, async () => {
      const response = await proxy(
        forwarded(`https://127.0.0.1:3011${path}`, {
          accept: 'text/html,application/xhtml+xml',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
        }),
        { waitUntil() {} },
      )
      assert.ok(response)
      assert.equal(response.status, 200)
      assertNoLoopback(response, `${path} document`)
      assert.equal(response.headers.get('location'), null)
    })
  }

  it('unsigned / redirects to sign-in on the public host', async () => {
    const response = await proxy(
      forwarded('https://127.0.0.1:3011/', {
        accept: 'text/html',
        'sec-fetch-dest': 'document',
      }),
      { waitUntil() {} },
    )
    assert.ok(response)
    assert.equal(response.status, 307)
    const location = response.headers.get('location') ?? ''
    assert.equal(new URL(location).origin, 'https://app.chatlegal.uk')
    assert.equal(new URL(location).pathname, '/sign-in')
    assertNoLoopback(response, '/')
  })

  it('leaves the dev-browser handshake in place on localhost', async () => {
    const request = new NextRequest('http://localhost:3210/sign-in', {
      headers: {
        host: 'localhost:3210',
        accept: 'text/html',
        'sec-fetch-dest': 'document',
      },
    })
    const response = await proxy(request, { waitUntil() {} })
    assert.ok(response)
    assert.equal(response.status, 307)
    const location = response.headers.get('location') ?? ''
    assert.match(location, /\/v1\/client\/handshake/)
    assert.doesNotMatch(location, /127\.0\.0\.1:3011/)
  })
})
