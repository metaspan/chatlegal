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
 * Adapted from the assistant shell header in
 * dcolley/tourbillon@7a8595b apps/web/components/assistant/assistant-shell.tsx
 * without a company switcher.
 */
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
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2 sm:px-3">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={leftLabel}
        title={leftLabel}
        aria-expanded={leftOpen}
        aria-controls="history-pane"
        onClick={onToggleLeft}
      >
        <PanelLeft />
      </Button>
      <Link href="/" className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1">
        <ChatLegalMark size={24} />
        <span className="truncate font-serif text-sm font-semibold tracking-tight">ChatLegal</span>
      </Link>
      <div className="flex-1" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={rightLabel}
        title={rightLabel}
        aria-expanded={rightOpen}
        aria-controls="document-viewer"
        onClick={onToggleRight}
      >
        <PanelRight />
      </Button>
      <ThemeToggle />
      <div className="flex items-center gap-2">
        <UserButton />
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-xs font-medium">Personal account</p>
          <SignOutControl />
        </div>
      </div>
    </header>
  )
}
