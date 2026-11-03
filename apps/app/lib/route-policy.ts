/**
 * Signed-in route gate for the Next.js proxy.
 * Personal Consumer accounts only — Clerk Organizations are not consulted.
 *
 * The public-path list and the protect() call are the session boundary.
 * Page modules also call requireConsumerSession() (see lib/session-guards.ts).
 */

const PUBLIC_PREFIXES = ['/sign-in', '/sign-up'] as const

export function isPublicAppPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export async function protectSignedInRoute(
  pathname: string,
  auth: { protect: () => Promise<unknown> },
): Promise<void> {
  if (isPublicAppPath(pathname)) return
  await auth.protect()
}
