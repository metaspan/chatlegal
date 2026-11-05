import { redirect } from 'next/navigation'
import { requireConsumerSession } from '@/lib/session-guards'

/** Old bookmark. The signed-in page is /chats. */
export default async function MattersPage() {
  await requireConsumerSession()
  redirect('/chats')
}
