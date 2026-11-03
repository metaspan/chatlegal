import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireConsumerSession } from '@/lib/session-guards'

export const metadata: Metadata = { title: 'Home' }

export default async function HomePage() {
  const session = await requireConsumerSession()

  return (
    <div className="flex flex-col gap-4">
      <Card aria-label="Session" className="max-w-prose border shadow-none ring-0">
        <CardHeader>
          <CardTitle>
            <h2 className="font-serif text-lg font-semibold">Signed in</h2>
          </CardTitle>
          <CardDescription>
            <Badge variant="secondary">Personal account</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm">
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
        </CardContent>
      </Card>
    </div>
  )
}
