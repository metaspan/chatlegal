import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isPublicAppHost, loopbackAbsoluteToPath, neutralizeProxiedClerkResponse } from './proxy-response.ts'

const publicHeaders = {
  get(name: string) {
    const values: Record<string, string> = {
      host: 'app.chatlegal.uk',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'app.chatlegal.uk',
    }
    return values[name.toLowerCase()] ?? null
  },
}

describe('loopback rewrite targets', () => {
  it('recognises localhost, 127.0.0.1, and ::1', () => {
    assert.equal(loopbackAbsoluteToPath('https://localhost:3011/sign-in'), '/sign-in')
    assert.equal(loopbackAbsoluteToPath('http://127.0.0.1:3011/sign-up?x=1'), '/sign-up?x=1')
    assert.equal(loopbackAbsoluteToPath('https://[::1]:3011/sign-in'), '/sign-in')
    assert.equal(loopbackAbsoluteToPath('https://app.chatlegal.uk/sign-in'), null)
    assert.equal(loopbackAbsoluteToPath('/sign-in'), null)
  })

  it('treats app.chatlegal.uk as the public host and ignores the docs site', () => {
    assert.equal(isPublicAppHost(publicHeaders), true)
    assert.equal(
      isPublicAppHost({
        get: (name) => (name.toLowerCase() === 'host' ? 'app.chatlegal.uk' : null),
      }),
      true,
    )
    assert.equal(
      isPublicAppHost({
        get: (name) => (name.toLowerCase() === 'host' ? 'chatlegal.uk' : null),
      }),
      false,
    )
    assert.equal(
      isPublicAppHost({
        get: (name) => (name.toLowerCase() === 'host' ? 'localhost:3011' : null),
      }),
      false,
    )
  })

  it('drops a loopback x-middleware-rewrite so Next renders the path', () => {
    const response = new Response(null, {
      status: 200,
      headers: { 'x-middleware-rewrite': 'https://localhost:3011/sign-in', 'x-clerk-auth-reason': 'dev-browser-missing' },
    })
    const next = neutralizeProxiedClerkResponse(response, {
      headers: publicHeaders,
      nextUrl: { pathname: '/sign-in', search: '' },
    })
    assert.equal(next.status, 200)
    assert.equal(next.headers.get('x-middleware-rewrite'), null)
    assert.equal(next.headers.get('x-middleware-next'), '1')
    assert.equal(next.headers.get('location'), null)
    assert.equal(next.headers.get('x-clerk-auth-reason'), 'dev-browser-missing')
  })

  it('moves a loopback Location onto https://app.chatlegal.uk', () => {
    const response = new Response(null, {
      status: 307,
      headers: { location: 'https://127.0.0.1:3011/sign-in?redirect_url=https%3A%2F%2F127.0.0.1%3A3011%2F' },
    })
    const next = neutralizeProxiedClerkResponse(response, {
      headers: publicHeaders,
      nextUrl: { pathname: '/', search: '' },
    })
    const location = next.headers.get('location') ?? ''
    assert.equal(next.status, 307)
    assert.equal(new URL(location).origin, 'https://app.chatlegal.uk')
    assert.equal(new URL(location).pathname, '/sign-in')
    assert.doesNotMatch(location, /localhost|127\.0\.0\.1|\[::1\]/)
  })

  it('renders public sign-in instead of the dev-browser handshake on the public host', () => {
    const response = new Response(null, {
      status: 307,
      headers: {
        location:
          'https://clerk.example.com/v1/client/handshake?redirect_url=https%3A%2F%2Flocalhost%3A3011%2Fsign-in&__clerk_hs_reason=dev-browser-missing',
        'x-clerk-auth-reason': 'dev-browser-missing',
      },
    })
    const next = neutralizeProxiedClerkResponse(response, {
      headers: publicHeaders,
      nextUrl: { pathname: '/sign-in', search: '' },
    })
    assert.equal(next.status, 200)
    assert.equal(next.headers.get('location'), null)
    assert.equal(next.headers.get('x-middleware-rewrite'), null)
    assert.equal(next.headers.get('x-middleware-next'), '1')
  })

  it('sends an unsigned document on the public host to the public sign-in URL', () => {
    const response = new Response(null, {
      status: 307,
      headers: {
        location: 'https://clerk.example.com/v1/client/handshake?redirect_url=https%3A%2F%2Flocalhost%3A3011%2F',
        'x-clerk-auth-reason': 'dev-browser-missing',
      },
    })
    const next = neutralizeProxiedClerkResponse(response, {
      headers: publicHeaders,
      nextUrl: { pathname: '/', search: '' },
    })
    const location = next.headers.get('location') ?? ''
    assert.equal(next.status, 307)
    assert.equal(new URL(location).origin, 'https://app.chatlegal.uk')
    assert.equal(new URL(location).pathname, '/sign-in')
    assert.equal(new URL(location).searchParams.get('redirect_url'), 'https://app.chatlegal.uk/')
    assert.doesNotMatch(location, /localhost|127\.0\.0\.1|\[::1\]/)
  })
})
