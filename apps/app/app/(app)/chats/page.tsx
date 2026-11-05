import type { Metadata } from 'next'
import { requireConsumerSession } from '@/lib/session-guards'

export const metadata: Metadata = { title: 'Chats' }

export default async function ChatsPage() {
  await requireConsumerSession()

  return (
    <section className="flex max-w-prose flex-col gap-2">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Chats</h1>
      <p className="text-muted-foreground">
        Each row is one chat. Open it from the list on the left, or start a new chat. A new chat starts with
        questions. It is not legal advice.
      </p>
    </section>
  )
}
