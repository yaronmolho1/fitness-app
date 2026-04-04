'use client'

import { useTransition, useState } from 'react'
import { activateMesocycle, completeMesocycle, planMesocycle } from '@/lib/mesocycles/actions'
import { Button } from '@/components/ui/button'

type MesocycleStatus = 'draft' | 'planned' | 'active' | 'completed'

type TransitionConfig = {
  label: string
  action: (id: number) => Promise<{ success: boolean; error?: string }>
  variant: 'outline' | 'default' | 'secondary'
  confirm?: string
}

const transitions: Partial<Record<MesocycleStatus, TransitionConfig>> = {
  draft: { label: 'Mark as Planned', action: planMesocycle, variant: 'outline' },
  planned: { label: 'Activate', action: activateMesocycle, variant: 'default' },
  active: { label: 'Complete', action: completeMesocycle, variant: 'secondary', confirm: 'Complete this mesocycle? This action cannot be undone.' },
}

export function StatusTransitionButton({
  mesocycleId,
  status,
}: {
  mesocycleId: number
  status: MesocycleStatus
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const config = transitions[status]
  if (!config) return null

  function handleClick() {
    setError(null)

    if (config!.confirm) {
      const confirmed = window.confirm(config!.confirm)
      if (!confirmed) return
    }

    startTransition(async () => {
      const result = await config!.action(mesocycleId)
      if (!result.success) {
        setError(result.error ?? 'Unknown error')
      }
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        onClick={handleClick}
        disabled={isPending}
        variant={config.variant}
        size="sm"
        className="min-w-[100px]"
      >
        {isPending ? `${config.label}…` : config.label}
      </Button>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
