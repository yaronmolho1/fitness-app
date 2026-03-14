'use client'

import { useTransition, useState } from 'react'
import { activateMesocycle, completeMesocycle } from '@/lib/mesocycles/actions'
import { Button } from '@/components/ui/button'

type MesocycleStatus = 'planned' | 'active' | 'completed'

export function StatusTransitionButton({
  mesocycleId,
  status,
}: {
  mesocycleId: number
  status: MesocycleStatus
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (status === 'completed') return null

  const isActivate = status === 'planned'
  const label = isActivate ? 'Activate' : 'Complete'

  function handleClick() {
    setError(null)

    if (!isActivate) {
      const confirmed = window.confirm(
        'Complete this mesocycle? This action cannot be undone.'
      )
      if (!confirmed) return
    }

    startTransition(async () => {
      const result = isActivate
        ? await activateMesocycle(mesocycleId)
        : await completeMesocycle(mesocycleId)

      if (!result.success) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        onClick={handleClick}
        disabled={isPending}
        variant={isActivate ? 'default' : 'secondary'}
        size="sm"
        className="min-w-[100px]"
      >
        {isPending ? `${label}…` : label}
      </Button>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
