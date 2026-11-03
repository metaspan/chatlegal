import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { basicPlanUsage, type PlanUsageStub } from '@/lib/plan-usage'

/**
 * Plan and remaining use for the signed-in person.
 * Pinned in the left pane footer so it stays in view while history scrolls.
 * Content shape follows the static edition card in hitly-net/hitly@94b2e92
 * packages/cloud/src/pages/billing.tsx (muted label, name, one quiet line).
 * That card's billing props are not used. The panel is components/ui/card.tsx,
 * adapted from dcolley/tourbillon@7a8595b apps/web/components/ui/card.tsx.
 * Colours stay on the M1 tokens.
 * The tier line names the default class. It is not a class picker.
 */
export function PlanUsageCard({ plan = basicPlanUsage }: { plan?: PlanUsageStub }) {
  return (
    <Card
      size="sm"
      role="region"
      aria-label="Plan and usage"
      data-plan-card=""
      data-plan-tier={plan.tierName}
      data-plan-price={plan.priceLabel}
      data-plan-model-class={plan.modelClassId}
      data-plan-model-id={plan.modelId}
      data-plan-remaining={plan.remainingKind}
      data-upgrade-available={plan.upgradeAvailable ? 'true' : 'false'}
      className="border bg-background shadow-none ring-0"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Plan</p>
            <CardTitle>
              <h2 className="font-serif text-sm font-semibold">{plan.tierName}</h2>
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground" data-slot="model-class">
              <span className="sr-only">Default model class </span>
              {plan.modelClassAffordance}
            </p>
          </div>
          <Badge variant="secondary">{plan.priceLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Remaining</p>
        <p className="mt-1 text-sm">{plan.remainingLabel}</p>
        <p className="mt-1 text-xs text-muted-foreground">{plan.remainingDetail}</p>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-1.5 border-t bg-transparent">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={!plan.upgradeAvailable}
          aria-describedby="plan-upgrade-note"
        >
          {plan.upgradeLabel}
        </Button>
        <p id="plan-upgrade-note" className="text-center text-xs text-muted-foreground">
          {plan.upgradeDetail}
        </p>
      </CardFooter>
    </Card>
  )
}
