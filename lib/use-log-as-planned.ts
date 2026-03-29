'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'

type UseLogAsPlannedOptions = {
  saved: boolean
  scrollSelector?: string
}

/**
 * Tracks whether the user has modified any autofilled input.
 * Once modified, the "Log as Planned" button is hidden permanently.
 */
export function useLogAsPlanned({
  saved,
  scrollSelector = '[data-testid="rating-notes-section"]',
}: UseLogAsPlannedOptions) {
  const [isModified, setIsModified] = useState(false)

  const markModified = useCallback(() => {
    setIsModified(true)
  }, [])

  const handleLogAsPlanned = useCallback(() => {
    const el = document.querySelector(scrollSelector)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    toast.info('Review and save when ready.')
  }, [scrollSelector])

  const showButton = !saved && !isModified

  return { showButton, markModified, handleLogAsPlanned }
}
