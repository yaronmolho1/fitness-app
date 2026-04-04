'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { deleteMesocycle } from '@/lib/mesocycles/delete-actions'
import type { CascadeSummary } from '@/lib/mesocycles/queries'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type MesocycleStatus = 'draft' | 'planned' | 'active' | 'completed'

export function DeleteMesocycleButton({
  mesocycleId,
  mesocycleName,
  status,
  cascadeSummary,
}: {
  mesocycleId: number
  mesocycleName: string
  status: MesocycleStatus
  cascadeSummary: CascadeSummary
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const isActive = status === 'active'

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteMesocycle(mesocycleId)
      if (result.success) {
        setOpen(false)
        toast.success(`"${mesocycleName}" deleted`)
        router.push('/mesocycles')
      } else {
        setError(result.error)
      }
    })
  }

  if (isActive) {
    return (
      <div className="flex flex-col gap-1">
        <Button variant="outline" size="sm" disabled title="Complete the mesocycle before deleting">
          <Trash2 className="mr-1.5 h-4 w-4" />
          Delete
        </Button>
        <p className="text-xs text-muted-foreground">Complete first to delete</p>
      </div>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="mr-1.5 h-4 w-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{mesocycleName}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>This will permanently delete the mesocycle and:</p>
              <ul className="list-inside list-disc space-y-1 text-sm">
                <li>{cascadeSummary.templates} template{cascadeSummary.templates !== 1 ? 's' : ''} (and their slots/sections)</li>
                <li>{cascadeSummary.schedules} schedule entr{cascadeSummary.schedules !== 1 ? 'ies' : 'y'}</li>
                {cascadeSummary.routineItems > 0 && (
                  <li>{cascadeSummary.routineItems} routine item{cascadeSummary.routineItems !== 1 ? 's' : ''} will be promoted to global scope</li>
                )}
              </ul>
              <p>Logged workouts are not affected.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
