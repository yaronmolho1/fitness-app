'use client'

import { useState, useTransition, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { assignRotation } from '@/lib/schedule/actions'

export type RotationTemplate = {
  id: number
  name: string
}

export type ExistingRotationPosition = {
  cycle_position: number
  template_id: number
}

type PositionEntry = {
  cycle_position: number
  template_id: number | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mesocycleId: number
  dayOfWeek: number
  weekType: 'normal' | 'deload'
  timeSlot: string
  duration: number
  existingRotation?: ExistingRotationPosition[]
  templates: RotationTemplate[]
}

const CYCLE_LENGTHS = [2, 3, 4, 5, 6, 7, 8] as const

function buildPositions(length: number, existing?: ExistingRotationPosition[]): PositionEntry[] {
  return Array.from({ length }, (_, i) => {
    const pos = i + 1
    const match = existing?.find(e => e.cycle_position === pos)
    return { cycle_position: pos, template_id: match?.template_id ?? null }
  })
}

export function RotationEditorModal({ open, onOpenChange, ...rest }: Props) {
  // Increment key each time dialog opens to remount form with fresh state
  const [formKey, setFormKey] = useState(0)

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) setFormKey(k => k + 1)
    onOpenChange(nextOpen)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <RotationForm key={formKey} onOpenChange={handleOpenChange} {...rest} />
      </DialogContent>
    </Dialog>
  )
}

type FormProps = Omit<Props, 'open'> & {
  onOpenChange: (open: boolean) => void
}

function RotationForm({
  onOpenChange,
  mesocycleId,
  dayOfWeek,
  weekType,
  timeSlot,
  duration,
  existingRotation,
  templates,
}: FormProps) {
  const defaultLength = existingRotation?.length ?? 4
  const [cycleLength, setCycleLength] = useState(defaultLength)
  const [positions, setPositions] = useState<PositionEntry[]>(() =>
    buildPositions(defaultLength, existingRotation)
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleCycleLengthChange = useCallback((value: string) => {
    const newLen = Number(value)
    setCycleLength(newLen)
    setPositions(prev => {
      if (newLen > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: newLen - prev.length }, (_, i) => ({
            cycle_position: prev.length + i + 1,
            template_id: null as number | null,
          })),
        ]
      }
      return prev.slice(0, newLen)
    })
  }, [])

  const handleTemplateChange = useCallback((position: number, value: string) => {
    const templateId = Number(value)
    setPositions(prev =>
      prev.map(p =>
        p.cycle_position === position ? { ...p, template_id: templateId } : p
      )
    )
  }, [])

  const allFilled = positions.every(p => p.template_id !== null)

  const handleSave = useCallback(() => {
    if (!allFilled) return
    setError(null)

    startTransition(async () => {
      const result = await assignRotation({
        mesocycle_id: mesocycleId,
        day_of_week: dayOfWeek,
        week_type: weekType,
        time_slot: timeSlot,
        duration,
        positions: positions.map(p => ({
          cycle_position: p.cycle_position,
          template_id: p.template_id!,
        })),
      })

      if (result.success) {
        onOpenChange(false)
      } else {
        setError(result.error)
      }
    })
  }, [allFilled, positions, mesocycleId, dayOfWeek, weekType, timeSlot, duration, onOpenChange])

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {existingRotation ? 'Edit Rotation' : 'Assign Rotation'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Configure a rotating template cycle for this schedule slot
        </DialogDescription>
      </DialogHeader>

      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cycle-length">Cycle length (weeks)</Label>
          <Select value={String(cycleLength)} onValueChange={handleCycleLengthChange}>
            <SelectTrigger id="cycle-length">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CYCLE_LENGTHS.map(n => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            No running templates in this mesocycle
          </p>
        ) : (
          <div className="space-y-2">
            {positions.map(pos => (
              <div key={pos.cycle_position} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-sm text-muted-foreground">
                  Week {pos.cycle_position}
                </span>
                <Select
                  value={pos.template_id != null ? String(pos.template_id) : undefined}
                  onValueChange={(v) => handleTemplateChange(pos.cycle_position, v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!allFilled || isPending}>
          {isPending ? 'Saving...' : 'Save'}
        </Button>
      </DialogFooter>
    </>
  )
}
