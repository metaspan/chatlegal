import { datesViewModel, partiesViewCopy, statusViewModel, type MatterViewMatter, type MatterViewRow } from '@/lib/matters/matter-views'
import type { MatterMessage, MatterObservations, MatterThreadStatus } from '@/lib/matters/types'
import type { MatterPaneView } from '@/lib/right-pane'

/**
 * People, dates, and status inside the viewer.
 * The fact rows follow the detail shape in hitly-net/hitly@94b2e92
 * apps/app/components/work-item-detail.tsx (a heading, then the facts we have).
 * That screen is a reviewer inbox. This one only shows the open matter.
 * People, letter dates, and a waiting status are labelled stubs.
 */

function FactList({ rows }: { rows: readonly MatterViewRow[] }) {
  if (rows.length === 0) return null
  return (
    <dl className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.id} data-matter-fact={row.id}>
          <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{row.label}</dt>
          <dd className="text-sm">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function StubNote({ kind, text }: { kind: MatterPaneView; text: string }) {
  return (
    <p data-view-stub={kind} className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
      {text}
    </p>
  )
}

export function MatterPaneViews({
  mode,
  matterId,
  matter,
  messages,
  threadStatus,
  observations,
  replying = false,
}: {
  mode: MatterPaneView
  matterId: string | null
  matter: MatterViewMatter | null
  messages: readonly MatterMessage[]
  threadStatus: MatterThreadStatus
  observations: MatterObservations | null
  /** The Concierge stream is still filling the chat (G-01 narration). */
  replying?: boolean
}) {
  if (mode === 'parties') {
    const copy = partiesViewCopy(matterId)
    return (
      <section aria-label="People" className="flex max-w-prose flex-col gap-3">
        <h3 className="font-serif text-lg font-semibold">People</h3>
        <p className="text-sm text-muted-foreground">{copy.detail}</p>
        {copy.stub ? <StubNote kind="parties" text={copy.stub} /> : null}
      </section>
    )
  }
  if (mode === 'dates') {
    const model = datesViewModel({ matterId, matter, messages })
    return (
      <section aria-label="Dates" className="flex max-w-prose flex-col gap-3">
        <h3 className="font-serif text-lg font-semibold">Dates</h3>
        <p className="text-sm text-muted-foreground">{model.detail}</p>
        <FactList rows={model.rows} />
        {model.stub ? <StubNote kind="dates" text={model.stub} /> : null}
      </section>
    )
  }
  const model = statusViewModel({
    matterId,
    status: threadStatus,
    messageCount: messages.length,
    observations,
    messages,
    replying,
  })
  return (
    <section aria-label="Status" className="flex max-w-prose flex-col gap-3">
      <h3 className="font-serif text-lg font-semibold">Status</h3>
      <p className="text-sm text-muted-foreground">{model.detail}</p>
      <FactList rows={model.rows} />
      {model.stub ? <StubNote kind="status" text={model.stub} /> : null}
    </section>
  )
}
