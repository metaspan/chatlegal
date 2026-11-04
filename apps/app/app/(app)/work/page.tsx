import type { Metadata } from 'next'
import { MatterFiles } from '@/components/shell/matter-files'
import { requireConsumerSession } from '@/lib/session-guards'

export const metadata: Metadata = { title: 'Work' }

export default async function WorkPage() {
  await requireConsumerSession()

  return (
    <section className="flex max-w-prose flex-col gap-3">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Work</h1>
      <p className="text-muted-foreground">Files you add stay with the open matter.</p>
      <MatterFiles />
    </section>
  )
}
