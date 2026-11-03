/**
 * Clerk's dev-instance middleware copies the middleware request URL into
 * `x-middleware-rewrite`. Behind nginx that URL is the listen address
 * (localhost, 127.0.0.1, or ::1), while Next's route URL stays on the bind
 * address. The origins differ, so Next fetches the rewrite over the network
 * and /sign-in 500s (TLS against the plain HTTP listener, or a dead ::1).
 *
 * Drop loopback rewrites and let Next render the original path. On
 * https://app.chatlegal.uk, also skip the dev-browser handshake redirect:
 * placeholder pk_test_ keys cannot complete it, and the sign-in page has to
 * answer 200. pk_live_ keys do not take that handshake.
 */

import { isPublicAppPath } from './route-policy'

const REWRITE = 'x-middleware-rewrite'
const NEXT = 'x-middleware-next'
const LOCATION = 'location'
const AUTH_REASON = 'x-clerk-auth-reason'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase())
}

/** Path, query, and hash when `value` is an absolute loopback URL. Otherwise null. */
export function loopbackAbsoluteToPath(value: string): string | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!isLoopbackHost(url.hostname)) return null
  return `${url.pathname}${url.search}${url.hash}`
}

function hostnameFromHeader(value: string | null): string | null {
  const first = value?.split(',')[0]?.trim()
  if (!first) return null
  try {
    return new URL(`http://${first}`).hostname.toLowerCase()
  } catch {
    return null
  }
}

/** True when nginx presented this app's public host, not the docs site and not the listen address. */
export function isPublicAppHost(headers: { get(name: string): string | null }): boolean {
  return [headers.get('x-forwarded-host'), headers.get('host')].some(
    (value) => hostnameFromHeader(value) === 'app.chatlegal.uk',
  )
}

function isDevBrowserHandshake(location: string, headers: Headers): boolean {
  if (!location.includes('/v1/client/handshake')) return false
  const reason = headers.get(AUTH_REASON) ?? ''
  return reason.split(',').some((part) => part.trim() === 'dev-browser-missing')
}

/** Absolute public URL for a loopback URL, including a nested redirect_url. */
function retargetLoopbackLocation(location: string): string | null {
  const path = loopbackAbsoluteToPath(location)
  if (!path) return null
  const url = new URL(`https://app.chatlegal.uk${path}`)
  const redirect = url.searchParams.get('redirect_url')
  if (redirect) {
    const redirected = loopbackAbsoluteToPath(redirect)
    if (redirected) url.searchParams.set('redirect_url', `https://app.chatlegal.uk${redirected}`)
  }
  return url.toString()
}

function publicSignInLocation(pathname: string, search: string): string {
  const redirectUrl = new URL('https://app.chatlegal.uk/sign-in')
  const returnTo = `https://app.chatlegal.uk${pathname}${search}`
  redirectUrl.searchParams.set('redirect_url', returnTo)
  return redirectUrl.toString()
}

type ProxiedRequest = {
  headers: { get(name: string): string | null }
  nextUrl: { pathname: string; search: string }
}

/**
 * Returns the same response when nothing points at a loopback listener.
 * Otherwise returns a copy Next can render or redirect on the public host.
 */
export function neutralizeProxiedClerkResponse(response: Response, request: ProxiedRequest): Response {
  const headers = new Headers(response.headers)
  let status = response.status
  let changed = false

  const rewrite = headers.get(REWRITE)
  if (rewrite && loopbackAbsoluteToPath(rewrite)) {
    headers.delete(REWRITE)
    if (!headers.get(LOCATION)) headers.set(NEXT, '1')
    changed = true
  }

  const location = headers.get(LOCATION)
  if (location && isPublicAppHost(request.headers) && isDevBrowserHandshake(location, headers)) {
    if (isPublicAppPath(request.nextUrl.pathname)) {
      headers.delete(LOCATION)
      headers.delete(REWRITE)
      headers.set(NEXT, '1')
      status = 200
    } else {
      headers.set(LOCATION, publicSignInLocation(request.nextUrl.pathname, request.nextUrl.search))
      headers.delete(REWRITE)
      headers.delete(NEXT)
      status = 307
    }
    changed = true
  } else if (location && isPublicAppHost(request.headers)) {
    const retargeted = retargetLoopbackLocation(location)
    if (retargeted) {
      headers.set(LOCATION, retargeted)
      changed = true
    }
  }

  if (!changed) return response

  return new Response(response.body, {
    status,
    statusText: status === 200 ? 'OK' : status === 307 ? 'Temporary Redirect' : response.statusText,
    headers,
  })
}
