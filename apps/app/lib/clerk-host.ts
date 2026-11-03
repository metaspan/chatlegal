/**
 * Clerk for this app is https://app.chatlegal.uk only.
 * https://chatlegal.uk is apps/site (docs and waitlist) and must not receive Clerk.
 */

export const APP_ORIGIN = 'https://app.chatlegal.uk'
export const APP_SIGN_IN_URL = `${APP_ORIGIN}/sign-in`
export const APP_SIGN_UP_URL = `${APP_ORIGIN}/sign-up`
export const APP_AFTER_AUTH_URL = `${APP_ORIGIN}/`

/** User-provided redirect targets. Localhost is not included; production is this origin only. */
export const allowedRedirectOrigins = [APP_ORIGIN]

const REDIRECT_ENV_KEYS = [
  'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
  'NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL',
  'NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL',
  'NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL',
  'NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL',
  'NEXT_PUBLIC_CLERK_PROXY_URL',
] as const

/** Same-origin paths, or localhost, for a developer machine. Not the docs site. */
const DEV_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3210',
  'http://127.0.0.1:3210',
])

export function assertAppClerkHost(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NEXT_PUBLIC_CLERK_IS_SATELLITE === 'true' || env.NEXT_PUBLIC_CLERK_IS_SATELLITE === '1') {
    throw new Error('Clerk satellite mode is off. This app is https://app.chatlegal.uk, not a satellite of chatlegal.uk.')
  }

  const domain = env.NEXT_PUBLIC_CLERK_DOMAIN?.trim()
  if (domain && domain !== 'app.chatlegal.uk') {
    throw new Error(`NEXT_PUBLIC_CLERK_DOMAIN must be app.chatlegal.uk when set, not ${domain}.`)
  }

  for (const key of REDIRECT_ENV_KEYS) {
    const value = env[key]?.trim()
    if (!value || value.startsWith('/')) continue
    let origin: string
    try {
      origin = new URL(value).origin
    } catch {
      throw new Error(`${key} must be a path or an absolute URL on ${APP_ORIGIN}.`)
    }
    if (origin !== APP_ORIGIN && !DEV_ORIGINS.has(origin)) {
      throw new Error(`${key} must use ${APP_ORIGIN}. https://chatlegal.uk is the docs site, not this app.`)
    }
  }
}
