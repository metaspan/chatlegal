import { DashboardShell } from '@/components/dashboard-shell'
import { requireConsumerSession } from '@/lib/session-guards'

export const dynamic = 'force-dynamic'

export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  await requireConsumerSession()
  return <DashboardShell>{children}</DashboardShell>
}
