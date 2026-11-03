import type { NextFetchEvent, NextRequest } from 'next/server'
import { clerkMiddleware } from '@clerk/nextjs/server'
import { assertAppClerkHost } from './lib/clerk-host'
import { neutralizeProxiedClerkResponse } from './lib/proxy-response'
import { protectSignedInRoute } from './lib/route-policy'

assertAppClerkHost()

/**
 * Next.js 16 proxy (middleware). Unsigned requests to app routes are sent to
 * Clerk sign-in. /sign-in and /sign-up stay public.
 * The /__clerk matcher is reserved for an optional Frontend API proxy.
 *
 * Behind nginx (Host: app.chatlegal.uk, X-Forwarded-Proto: https, upstream
 * 127.0.0.1), Clerk's dev-instance middleware rewrites to that listen address.
 * neutralizeProxiedClerkResponse stops Next from fetching it.
 */
const clerk = clerkMiddleware(async (auth, request) => {
  await protectSignedInRoute(request.nextUrl.pathname, auth)
})

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const response = await clerk(request, event)
  if (!response) return response
  return neutralizeProxiedClerkResponse(response, request)
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes.
    '/(api|trpc)(.*)',
    // Clerk Frontend API proxy path, if NEXT_PUBLIC_CLERK_PROXY_URL points here.
    '/__clerk/(.*)',
  ],
}
