import { statusLabel, type PageStatus } from '@/lib/nav'

export function StatusNote({ status }: { status: PageStatus }) {
  const label = statusLabel(status)
  return (
    <p className="status-note">
      <span className={label === 'Planned' ? 'pill pill-planned' : 'pill'}>{label}</span>
      {status === 'eval:locked' ? (
        <span>In the locked evaluation set. Not a counsel-reviewed page.</span>
      ) : status === 'planned' ? (
        <span>Not written yet.</span>
      ) : (
        <span>Placeholder. Not a counsel-reviewed page.</span>
      )}
    </p>
  )
}
