'use client'

import Link from 'next/link'
import { PanelLeft, PanelRight } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { ChatLegalMark } from '@/components/mark'
import { SignOutControl } from '@/components/sign-out-control'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

/**
 * Top bar. Account controls stay here so hiding a pane does not hide sign-out.
 * Burgundy chrome is the M1 banner colour (`bg-chrome`).
 * Adapted from the assistant shell header in
 * dcolley/tourbillon@7a8595b apps/web/components/assistant/assistant-shell.tsx
 * without a company switcher.
 */

const onChrome =
  'text-chrome-ink hover:bg-chrome-ink/10 hover:text-chrome-ink aria-expanded:bg-chrome-ink/10 aria-expanded:text-chrome-ink'

export function AppBar({
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
}: {
  leftOpen: boolean
  rightOpen: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
}) {
  const leftLabel = leftOpen ? 'Hide chats' : 'Show chats'
  const rightLabel = rightOpen ? 'Hide viewer' : 'Show viewer'

  return (
    <header
      data-chrome="burgundy"
      className="flex h-12 shrink-0 items-center gap-2 border-b border-chrome-ink/20 bg-chrome px-2 text-chrome-ink sm:px-3"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={onChrome}
        aria-label={leftLabel}
        title={leftLabel}
        aria-expanded={leftOpen}
        aria-controls="history-pane"
        onClick={onToggleLeft}
      >
        <PanelLeft />
      </Button>
      <Link href="/" className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 text-inherit no-underline">
        <ChatLegalMark size={24} tone="on-chrome" />
        <span className="truncate font-serif text-sm font-semibold tracking-tight">ChatLegal</span>
      </Link>
      <div className="flex-1" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={onChrome}
        aria-label={rightLabel}
        title={rightLabel}
        aria-expanded={rightOpen}
        aria-controls="document-viewer"
        onClick={onToggleRight}
      >
        <PanelRight />
      </Button>
      <ThemeToggle className={onChrome} />
      <div className="flex items-center gap-2">
        <UserButton />
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-xs font-medium">Personal account</p>
          <SignOutControl className="text-chrome-ink/80 hover:text-chrome-ink" />
        </div>
      </div>
    </header>
  )
}
