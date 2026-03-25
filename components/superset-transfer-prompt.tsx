'use client'

import { useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  slotId: number
  groupSlotIds: number[]
  mode: 'copy' | 'move'
  onChoice: (slotIds: number[]) => void
}

export function SupersetTransferPrompt({
  open,
  onOpenChange,
  slotId,
  groupSlotIds,
  mode,
  onChoice,
}: Props) {
  const label = mode === 'copy' ? 'Copy' : 'Move'

  const handleSingle = useCallback(() => {
    onChoice([slotId])
    onOpenChange(false)
  }, [slotId, onChoice, onOpenChange])

  const handleGroup = useCallback(() => {
    onChoice(groupSlotIds)
    onOpenChange(false)
  }, [groupSlotIds, onChoice, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{label} superset exercise</DialogTitle>
          <DialogDescription>
            This exercise is part of a superset with {groupSlotIds.length} exercises.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          <Button variant="outline" onClick={handleSingle}>
            This exercise only
          </Button>
          <Button onClick={handleGroup}>
            Entire superset ({groupSlotIds.length} exercises)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
