import type { Metadata } from 'next'
import { requireConsumerSession } from '@/lib/session-guards'

export const metadata: Metadata = { title: 'Matters' }

export default async function MattersPage() {
  await requireConsumerSession()

  return (
    <section className="flex max-w-prose flex-col gap-2">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Matters</h1>
      <p className="text-muted-foreground">Matters will be listed here. None are open yet.</p>
    </section>
  )
}
