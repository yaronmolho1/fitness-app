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
  estimated_duration: number | null
  target_duration: number | null
  planned_duration: number | null
}

export type ExistingRotationPosition = {
  cycle_position: number
  template_id: number
  time_slot: string
  duration: number
}

type PositionEntry = {
  cycle_position: number
  template_id: number | null
  time_slot: string
  duration: number
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

// Time options: every 15 min from 05:00 to 22:00
const TIME_OPTIONS = Array.from({ length: 69 }, (_, i) => {
  const totalMin = 300 + i * 15
  const h = String(Math.floor(totalMin / 60)).padStart(2, '0')
  const m = String(totalMin % 60).padStart(2, '0')
  return `${h}:${m}`
})

// Duration options: every 15 min from 15 to 300 min
const DURATION_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const mins = (i + 1) * 15
  const label = mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`
  return { value: String(mins), label }
})

const DEFAULT_DURATION = 90

function snapDuration(mins: number): number {
  const snapped = Math.round(mins / 15) * 15
  return Math.max(15, Math.min(300, snapped))
}

function getTemplateDuration(tmpl: RotationTemplate): number {
  if (tmpl.estimated_duration) return snapDuration(tmpl.estimated_duration)
  if (tmpl.target_duration) return snapDuration(tmpl.target_duration)
  if (tmpl.planned_duration) return snapDuration(tmpl.planned_duration)
  return DEFAULT_DURATION
}

function buildPositions(
  length: number,
  defaultTimeSlot: string,
  defaultDuration: number,
  existing?: ExistingRotationPosition[],
): PositionEntry[] {
  return Array.from({ length }, (_, i) => {
    const pos = i + 1
    const match = existing?.find(e => e.cycle_position === pos)
    return {
      cycle_position: pos,
      template_id: match?.template_id ?? null,
      time_slot: match?.time_slot ?? defaultTimeSlot,
      duration: match?.duration ?? defaultDuration,
    }
  })
}

export function RotationEditorModal({ open, onOpenChange, ...rest }: Props) {
  const [formKey, setFormKey] = useState(0)

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) setFormKey(k => k + 1)
    onOpenChange(nextOpen)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
    buildPositions(defaultLength, timeSlot, duration, existingRotation)
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
            time_slot: timeSlot,
            duration,
          })),
        ]
      }
      return prev.slice(0, newLen)
    })
  }, [timeSlot, duration])

  const handleTemplateChange = useCallback((position: number, value: string) => {
    const templateId = Number(value)
    const tmpl = templates.find(t => t.id === templateId)
    setPositions(prev =>
      prev.map(p =>
        p.cycle_position === position
          ? { ...p, template_id: templateId, duration: tmpl ? getTemplateDuration(tmpl) : p.duration }
          : p
      )
    )
  }, [templates])

  const handleTimeChange = useCallback((position: number, value: string) => {
    setPositions(prev =>
      prev.map(p =>
        p.cycle_position === position ? { ...p, time_slot: value } : p
      )
    )
  }, [])

  const handleDurationChange = useCallback((position: number, value: string) => {
    setPositions(prev =>
      prev.map(p =>
        p.cycle_position === position ? { ...p, duration: Number(value) } : p
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
        time_slot: positions[0].time_slot,
        duration: positions[0].duration,
        positions: positions.map(p => ({
          cycle_position: p.cycle_position,
          template_id: p.template_id!,
          time_slot: p.time_slot,
          duration: p.duration,
        })),
      })

      if (result.success) {
        onOpenChange(false)
      } else {
        setError(result.error)
      }
    })
  }, [allFilled, positions, mesocycleId, dayOfWeek, weekType, onOpenChange])

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
            No templates in this mesocycle
          </p>
        ) : (
          <div className="space-y-3">
            {positions.map(pos => (
              <div key={pos.cycle_position} className="space-y-1.5 rounded-md border p-3">
                <div className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-sm font-medium text-muted-foreground">
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
                <div className="flex items-center gap-2 pl-16">
                  <select
                    value={pos.time_slot}
                    onChange={(e) => handleTimeChange(pos.cycle_position, e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {TIME_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <select
                    value={String(pos.duration)}
                    onChange={(e) => handleDurationChange(pos.cycle_position, e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {DURATION_OPTIONS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
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
