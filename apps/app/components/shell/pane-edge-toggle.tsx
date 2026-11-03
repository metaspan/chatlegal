'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Chevron on the seam of a side pane.
 * The control stays available when the pane is hidden, so the left nav can
 * always be opened again. Shape follows the hideable sidebar chevron in
 * BerriAI/litellm-docs src/theme/DocSidebar/Desktop/CollapseButton.
 * Colours stay on the M1 tokens already used by Button.
 */
export function PaneEdgeToggle({
  side,
  open,
  onToggle,
}: {
  side: 'left' | 'right'
  open: boolean
  onToggle: () => void
}) {
  const label = side === 'left' ? (open ? 'Hide chats' : 'Show chats') : open ? 'Hide viewer' : 'Show viewer'
  const Icon =
    side === 'left' ? (open ? ChevronLeft : ChevronRight) : open ? ChevronRight : ChevronLeft

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-xs"
      data-pane-edge={side}
      data-pane-open={open ? 'true' : 'false'}
      aria-label={label}
      title={label}
      aria-expanded={open}
      aria-controls={side === 'left' ? 'history-pane' : 'document-viewer'}
      onClick={onToggle}
    >
      <Icon />
    </Button>
  )
}
