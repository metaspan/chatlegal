import { clerkMiddleware } from '@clerk/nextjs/server'
import { assertAppClerkHost } from './lib/clerk-host'
import { protectSignedInRoute } from './lib/route-policy'

assertAppClerkHost()

/**
 * Next.js 16 proxy (middleware). Unsigned requests to app routes are sent to
 * Clerk sign-in. /sign-in and /sign-up stay public.
 * The /__clerk matcher is reserved for an optional Frontend API proxy.
 */
export default clerkMiddleware(async (auth, request) => {
  await protectSignedInRoute(request.nextUrl.pathname, auth)
})

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
