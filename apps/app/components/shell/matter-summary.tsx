import { matterObservationCopy } from '@/lib/matters/present'
import type { MatterObservations, MatterThreadStatus } from '@/lib/matters/types'

/**
 * Concierge summary for the open matter.
 * The text is the thread's observational memory. Another matter is not shown.
 */
export function MatterSummary({
  matterId,
  status,
  observations,
}: {
  matterId: string | null
  status: MatterThreadStatus
  observations: MatterObservations | null
}) {
  const copy = matterObservationCopy({ matterId, status, observations })
  return (
    <section
      aria-label="Summary"
      data-observation-matter-id={matterId ?? ''}
      data-observation-enabled={observations ? String(observations.enabled) : ''}
      className="max-w-prose"
    >
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Summary</h2>
      <p className="mt-1 text-sm text-muted-foreground">{copy.detail}</p>
      {copy.summary ? <p data-matter-summary className="mt-2 text-sm whitespace-pre-wrap">{copy.summary}</p> : null}
    </section>
  )
}
