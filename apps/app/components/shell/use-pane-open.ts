'use client'

import { useCallback, useEffect, useState } from 'react'
import { readPaneOpen, writePaneOpen } from '@/lib/shell-layout'

/** First paint matches the server (open). The stored choice applies after mount. */
export function usePaneOpen(key: string): [boolean, (open: boolean) => void] {
  const [open, setOpenState] = useState(true)

  useEffect(() => {
    setOpenState(readPaneOpen(key))
  }, [key])

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next)
      writePaneOpen(key, next)
    },
    [key],
  )

  return [open, setOpen]
}
