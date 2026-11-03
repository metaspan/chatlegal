import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

/**
 * Consumer session gate for signed-in pages.
 * A missing or unreadable Clerk session redirects to /sign-in.
 * Organizations, workspaces, and team roles are out of scope.
 */

export function consumerSessionRedirect(userId: string | null | undefined): '/sign-in' | null {
  if (typeof userId === 'string' && userId.length > 0) return null
  return '/sign-in'
}

type ConsumerSessionState = {
  userId: string | null
  sessionId: string | null
}

/**
 * Fixed fixtures for node tests. Ignored unless NODE_ENV is test, so a
 * development or production server cannot take this path.
 */
function sessionOverrideForTests(): ConsumerSessionState | null {
  if (process.env.NODE_ENV !== 'test') return null
  const mode = process.env.CHATLEGAL_TEST_SESSION
  if (mode === 'unsigned') return { userId: null, sessionId: null }
  if (mode === 'signed-in') return { userId: 'user_test', sessionId: 'sess_test' }
  return null
}

async function readConsumerSession(): Promise<ConsumerSessionState> {
  const override = sessionOverrideForTests()
  if (override) return override
  try {
    const { userId, sessionId } = await auth()
    return { userId: userId ?? null, sessionId: sessionId ?? null }
  } catch {
    // Fail closed: no detectable Consumer session, so the page must not render.
    return { userId: null, sessionId: null }
  }
}

export async function requireConsumerSession(): Promise<{ userId: string; sessionId: string | null }> {
  const session = await readConsumerSession()
  const dest = consumerSessionRedirect(session.userId)
  if (dest) redirect(dest)
  if (!session.userId) redirect('/sign-in')
  return { userId: session.userId, sessionId: session.sessionId }
}
