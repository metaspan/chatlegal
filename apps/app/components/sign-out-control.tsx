'use client'

import { SignOutButton } from '@clerk/nextjs'
import { APP_SIGN_IN_URL } from '@/lib/clerk-host'
import { cn } from '@/lib/utils'

export function SignOutControl({ className }: { className?: string }) {
  return (
    <SignOutButton redirectUrl={APP_SIGN_IN_URL}>
      <button
        type="button"
        className={cn(
          'text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline',
          className,
        )}
      >
        Sign out
      </button>
    </SignOutButton>
  )
}
