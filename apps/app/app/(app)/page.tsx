import type { Metadata } from 'next'
import { requireConsumerSession } from '@/lib/session-guards'

export const metadata: Metadata = { title: 'Home' }

export default async function HomePage() {
  const session = await requireConsumerSession()

  return (
    <div className="flex flex-col gap-8">
      <section className="flex max-w-prose flex-col gap-2">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Case work</h1>
        <p className="text-muted-foreground">Papers and next steps for the open matter will appear here.</p>
      </section>
      <section aria-label="Session" className="max-w-prose rounded-lg border bg-card p-4">
        <h2 className="font-serif text-lg font-semibold">Signed in</h2>
        <p className="mt-1 text-sm text-muted-foreground">Personal account.</p>
        <dl className="mt-3 grid gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">User</dt>
            <dd className="font-mono text-xs break-all">{session.userId}</dd>
          </div>
          {session.sessionId ? (
            <div>
              <dt className="text-muted-foreground">Session</dt>
              <dd className="font-mono text-xs break-all">{session.sessionId}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </div>
  )
}
