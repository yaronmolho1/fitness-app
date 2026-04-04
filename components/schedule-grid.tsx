'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { assignTemplate, removeAssignment, updateScheduleEntry } from '@/lib/schedule/actions'
import type { ScheduleEntry, TemplateOption } from '@/lib/schedule/queries'
import { DAY_NAMES, displayToInternal } from '@/lib/day-mapping'
import { derivePeriod, checkOverlap, timeSlotSchema, formatDuration } from '@/lib/schedule/time-utils'
import { RotationEditorModal } from '@/components/rotation-editor-modal'
import type { ExistingRotationPosition } from '@/components/rotation-editor-modal'

const PERIOD_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

const DEFAULT_TIME_SLOT = '07:00'
const DEFAULT_DURATION = 90

// Time options: every 30 min from 05:00 to 22:00
const TIME_OPTIONS = Array.from({ length: 35 }, (_, i) => {
  const totalMin = 300 + i * 30 // start at 05:00
  const h = String(Math.floor(totalMin / 60)).padStart(2, '0')
  const m = String(totalMin % 60).padStart(2, '0')
  return `${h}:${m}`
})

// Duration options: every 15 min from 15 to 300 min (5h)
const DURATION_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const mins = (i + 1) * 15
  const label = mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`
  return { value: String(mins), label }
})

type Props = {
  mesocycleId: number
  templates: TemplateOption[]
  schedule: ScheduleEntry[]
  isCompleted: boolean
  variant: 'normal' | 'deload'
}

type FormState = {
  day: number
  selectedTemplateId: number | null
  timeSlot: string
  duration: string
  mode: 'template' | 'rotation' | null
} | null

type EditFormState = {
  entryId: number
  day: number
  timeSlot: string
  duration: string
} | null

// Rotation modal context: which slot we're editing
type RotationModalState = {
  day: number
  timeSlot: string
  duration: number
  existingRotation?: ExistingRotationPosition[]
} | null

// A grouped rotation: multiple entries sharing (day, time_slot) with cycle_length > 1
type RotationGroup = {
  key: string
  day_of_week: number
  time_slot: string
  duration: number
  period: string
  cycle_length: number
  entries: ScheduleEntry[]
}

// Snap to nearest 15-min increment, clamped to 15–300
function snapDuration(mins: number): number {
  const snapped = Math.round(mins / 15) * 15
  return Math.max(15, Math.min(300, snapped))
}

// Get duration from template fields
function getTemplateDuration(tmpl: TemplateOption): number {
  if (tmpl.estimated_duration) return snapDuration(tmpl.estimated_duration)
  if (tmpl.target_duration) return snapDuration(tmpl.target_duration)
  if (tmpl.planned_duration) return snapDuration(tmpl.planned_duration)
  return DEFAULT_DURATION
}

// Group entries into single entries + rotation groups
function groupAssignments(entries: ScheduleEntry[]): Array<ScheduleEntry | RotationGroup> {
  const result: Array<ScheduleEntry | RotationGroup> = []
  const grouped = new Map<string, ScheduleEntry[]>()

  for (const entry of entries) {
    if (entry.cycle_length > 1) {
      const key = `${entry.day_of_week}-${entry.time_slot}`
      const group = grouped.get(key)
      if (group) {
        group.push(entry)
      } else {
        grouped.set(key, [entry])
      }
    } else {
      result.push(entry)
    }
  }

  for (const [key, entries] of grouped) {
    const first = entries[0]
    result.push({
      key,
      day_of_week: first.day_of_week,
      time_slot: first.time_slot,
      duration: first.duration,
      period: first.period,
      cycle_length: first.cycle_length,
      entries: entries.sort((a, b) => a.cycle_position - b.cycle_position),
    })
  }

  // Sort by time_slot
  result.sort((a, b) => {
    const aTime = 'time_slot' in a ? a.time_slot : ''
    const bTime = 'time_slot' in b ? b.time_slot : ''
    return aTime.localeCompare(bTime)
  })

  return result
}

function isRotationGroup(item: ScheduleEntry | RotationGroup): item is RotationGroup {
  return 'entries' in item
}

export function ScheduleGrid({ mesocycleId, templates, schedule: initialSchedule, isCompleted, variant }: Props) {
  const router = useRouter()
  const [schedule, setSchedule] = useState(initialSchedule)
  const [form, setForm] = useState<FormState>(null)
  const [editForm, setEditForm] = useState<EditFormState>(null)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [rotationModal, setRotationModal] = useState<RotationModalState>(null)

  function getAssignments(day: number): Array<ScheduleEntry | RotationGroup> {
    const dayEntries = schedule
      .filter((s) => s.day_of_week === day)
      .sort((a, b) => a.time_slot.localeCompare(b.time_slot))
    return groupAssignments(dayEntries)
  }

  function handleAddClick(day: number) {
    setError(null)
    setFormError(null)
    setForm({ day, selectedTemplateId: null, timeSlot: DEFAULT_TIME_SLOT, duration: String(DEFAULT_DURATION), mode: null })
  }

  function handleModeSelect(mode: 'template' | 'rotation') {
    if (!form) return
    if (mode === 'rotation') {
      // Open rotation modal in create mode
      const duration = parseInt(form.duration, 10) || DEFAULT_DURATION
      setRotationModal({
        day: form.day,
        timeSlot: form.timeSlot,
        duration,
      })
      setForm(null)
      return
    }
    setForm({ ...form, mode })
  }

  function handleTemplateSelect(templateId: number) {
    if (!form) return
    const tmpl = templates.find((t) => t.id === templateId)
    const duration = tmpl ? getTemplateDuration(tmpl) : DEFAULT_DURATION
    setForm({ ...form, selectedTemplateId: templateId, duration: String(duration) })
  }

  function handleCancel() {
    setForm(null)
    setFormError(null)
  }

  function handleConfirm() {
    if (!form || !form.selectedTemplateId) return
    const { day, selectedTemplateId, timeSlot } = form

    const timeResult = timeSlotSchema.safeParse(timeSlot)
    if (!timeResult.success) {
      setFormError('Invalid time format. Use HH:MM (00:00-23:59)')
      return
    }

    const duration = parseInt(form.duration, 10)
    if (isNaN(duration) || duration <= 0) {
      setFormError('Duration must be a positive number')
      return
    }

    setFormError(null)
    setForm(null)

    startTransition(async () => {
      const result = await assignTemplate({
        mesocycle_id: mesocycleId,
        day_of_week: day,
        template_id: selectedTemplateId,
        week_type: variant,
        time_slot: timeSlot,
        duration,
      })

      if (result.success) {
        const tmpl = templates.find((t) => t.id === selectedTemplateId)
        setSchedule((prev) => [
          ...prev,
          {
            id: result.data.id,
            day_of_week: day,
            template_id: selectedTemplateId,
            template_name: tmpl?.name ?? 'Unknown',
            period: result.data.period,
            time_slot: result.data.time_slot,
            duration: result.data.duration,
            cycle_length: result.data.cycle_length,
            cycle_position: result.data.cycle_position,
          },
        ])
        setError(null)
      } else {
        setError(result.error)
      }
    })
  }

  function handleRemove(entry: ScheduleEntry) {
    setError(null)
    startTransition(async () => {
      const result = await removeAssignment({ id: entry.id })

      if (result.success) {
        if (entry.cycle_length > 1) {
          // Remove all entries in the rotation group
          setSchedule((prev) =>
            prev.filter((s) =>
              !(s.day_of_week === entry.day_of_week &&
                s.time_slot === entry.time_slot &&
                s.cycle_length > 1)
            )
          )
        } else {
          setSchedule((prev) =>
            prev.filter((s) => s.id !== entry.id)
          )
        }
      } else {
        setError(result.error)
      }
    })
  }

  function handleRemoveRotation(group: RotationGroup) {
    // Use first entry's ID to trigger removal of entire rotation
    const firstEntry = group.entries[0]
    handleRemove(firstEntry)
  }

  function handleEditRotation(group: RotationGroup) {
    const existing: ExistingRotationPosition[] = group.entries.map((e) => ({
      cycle_position: e.cycle_position,
      template_id: e.template_id,
    }))
    setRotationModal({
      day: group.day_of_week,
      timeSlot: group.time_slot,
      duration: group.duration,
      existingRotation: existing,
    })
  }

  const handleRotationModalClose = useCallback((open: boolean) => {
    if (!open) {
      setRotationModal(null)
      router.refresh()
    }
  }, [router])

  function handleEditClick(entry: ScheduleEntry) {
    setError(null)
    setEditError(null)
    setForm(null)
    setEditForm({
      entryId: entry.id,
      day: entry.day_of_week,
      timeSlot: entry.time_slot,
      duration: String(snapDuration(entry.duration)),
    })
  }

  function handleEditCancel() {
    setEditForm(null)
    setEditError(null)
  }

  function handleEditSave() {
    if (!editForm) return

    const timeResult = timeSlotSchema.safeParse(editForm.timeSlot)
    if (!timeResult.success) {
      setEditError('Invalid time format. Use HH:MM (00:00-23:59)')
      return
    }

    const duration = parseInt(editForm.duration, 10)
    if (isNaN(duration) || duration <= 0) {
      setEditError('Duration must be a positive number')
      return
    }

    setEditError(null)
    const entryId = editForm.entryId
    const timeSlot = editForm.timeSlot
    setEditForm(null)

    startTransition(async () => {
      const result = await updateScheduleEntry({
        id: entryId,
        time_slot: timeSlot,
        duration,
      })

      if (result.success) {
        setSchedule((prev) =>
          prev.map((s) =>
            s.id === entryId
              ? { ...s, time_slot: result.data.time_slot, duration: result.data.duration, period: result.data.period }
              : s
          )
        )
        setError(null)
      } else {
        setError(result.error)
      }
    })
  }

  function hasEditOverlap(): boolean {
    if (!editForm) return false
    const duration = parseInt(editForm.duration, 10)
    if (isNaN(duration) || duration <= 0) return false
    const existing = schedule
      .filter((s) => s.day_of_week === editForm.day && s.id !== editForm.entryId)
      .map((s) => ({ time_slot: s.time_slot, duration: s.duration }))
    return checkOverlap(existing, editForm.timeSlot, duration)
  }

  function hasOverlap(): boolean {
    if (!form || !form.selectedTemplateId || !form.timeSlot) return false
    const duration = parseInt(form.duration, 10)
    if (isNaN(duration) || duration <= 0) return false
    const existing = schedule
      .filter((s) => s.day_of_week === form.day)
      .map((s) => ({ time_slot: s.time_slot, duration: s.duration }))
    return checkOverlap(existing, form.timeSlot, duration)
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {DAY_NAMES.map((dayName, displayIdx) => {
          const internalDay = displayToInternal(displayIdx)
          const assignments = getAssignments(internalDay)
          const hasAssignments = assignments.length > 0

          return (
            <div
              key={displayIdx}
              data-testid={`day-cell-${internalDay}`}
              className={cn(
                'rounded-xl border p-3 transition-colors duration-150 flex flex-col min-h-[8rem] md:min-h-[10rem]',
                hasAssignments
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-dashed border-muted-foreground/30 bg-muted/20'
              )}
            >
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {dayName}
              </p>

              {/* Entries sorted chronologically */}
              {assignments.map((item) => {
                if (isRotationGroup(item)) {
                  return (
                    <RotationSlot
                      key={item.key}
                      group={item}
                      templates={templates}
                      isCompleted={isCompleted}
                      isPending={isPending}
                      onEdit={() => handleEditRotation(item)}
                      onRemove={() => handleRemoveRotation(item)}
                    />
                  )
                }

                const entry = item
                return (
                  <div
                    key={entry.id}
                    data-testid="schedule-entry"
                    className="mb-2 space-y-1"
                  >
                    {editForm?.entryId === entry.id ? (
                      <div className="rounded-md border bg-background p-2 shadow-md space-y-2" data-testid="edit-form">
                        <p className="text-xs font-semibold">{entry.template_name}</p>
                        <div>
                          <label className="text-xs text-muted-foreground">Time</label>
                          <Select
                            value={editForm.timeSlot}
                            onValueChange={(v) => setEditForm({ ...editForm, timeSlot: v })}
                          >
                            <SelectTrigger className="h-8 text-xs" aria-label="Time" data-testid={`edit-time-${entry.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map((t) => (
                                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Duration</label>
                          <Select
                            value={editForm.duration}
                            onValueChange={(v) => setEditForm({ ...editForm, duration: v })}
                          >
                            <SelectTrigger className="h-8 text-xs" aria-label="Duration" data-testid={`edit-duration-${entry.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DURATION_OPTIONS.map((d) => (
                                <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {editError && (
                          <p className="text-xs text-destructive">{editError}</p>
                        )}
                        {hasEditOverlap() && (
                          <p className="text-xs text-yellow-600 bg-yellow-50 rounded px-2 py-1">
                            This time overlaps with an existing workout
                          </p>
                        )}
                        <div className="flex gap-1">
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handleEditSave}
                            disabled={isPending}
                            aria-label="Save"
                          >
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handleEditCancel}
                            disabled={isPending}
                            aria-label="Cancel edit"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p
                          data-testid="period-label"
                          className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          {PERIOD_LABELS[derivePeriod(entry.time_slot)] ?? entry.period}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span
                            data-testid="time-display"
                            className="text-[10px] font-mono text-muted-foreground"
                          >
                            {entry.time_slot}
                          </span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span
                            data-testid="duration-display"
                            className="text-[10px] text-muted-foreground"
                          >
                            {formatDuration(entry.duration)}
                          </span>
                        </div>
                        <p className="text-sm font-semibold">{entry.template_name}</p>
                        {!isCompleted && (
                          <div className="flex gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleEditClick(entry)}
                              disabled={isPending}
                              aria-label="Edit assignment"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleRemove(entry)}
                              disabled={isPending}
                              aria-label="Remove assignment"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}

              {/* Rest label when no assignments */}
              {!hasAssignments && (
                <p className="text-sm italic text-muted-foreground" data-testid="rest-label">Rest</p>
              )}

              {/* Single add button (unlimited per day) */}
              {!isCompleted && (
                <div className="mt-auto pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-full text-xs"
                    onClick={() => handleAddClick(internalDay)}
                    disabled={isPending || form?.day === internalDay}
                    aria-label="Add workout"
                  >
                    + Add Workout
                  </Button>
                </div>
              )}

              {/* Inline add workout form */}
              {form?.day === internalDay && (
                <div className="mt-2 rounded-md border bg-background p-2 shadow-md" data-testid="add-workout-form">
                  {/* Mode picker: template vs rotation */}
                  {form.mode === null && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Assignment type</p>
                      <div
                        className="cursor-pointer rounded px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-accent"
                        onClick={() => handleModeSelect('template')}
                        data-testid="assign-template-option"
                      >
                        Assign template
                      </div>
                      <div
                        className="cursor-pointer rounded px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-accent"
                        onClick={() => handleModeSelect('rotation')}
                        data-testid="assign-rotation-option"
                      >
                        Assign rotation
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs mt-1"
                        onClick={handleCancel}
                        aria-label="Cancel"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}

                  {/* Template picker */}
                  {form.mode === 'template' && !form.selectedTemplateId && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Select template</p>
                      {templates.map((tmpl) => (
                        <div
                          key={tmpl.id}
                          className="cursor-pointer rounded px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-accent"
                          onClick={() => handleTemplateSelect(tmpl.id)}
                        >
                          {tmpl.name}
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs mt-1"
                        onClick={handleCancel}
                        aria-label="Cancel"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}

                  {/* Time + duration inputs (shown after template selected) */}
                  {form.mode === 'template' && form.selectedTemplateId && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold">
                        {templates.find((t) => t.id === form.selectedTemplateId)?.name}
                      </p>

                      <div>
                        <label className="text-xs text-muted-foreground">Time</label>
                        <Select
                          value={form.timeSlot}
                          onValueChange={(v) => setForm({ ...form, timeSlot: v })}
                        >
                          <SelectTrigger className="h-8 text-xs" aria-label="Time" data-testid={`time-${internalDay}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map((t) => (
                              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground">Duration</label>
                        <Select
                          value={form.duration}
                          onValueChange={(v) => setForm({ ...form, duration: v })}
                        >
                          <SelectTrigger className="h-8 text-xs" aria-label="Duration" data-testid={`duration-${internalDay}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DURATION_OPTIONS.map((d) => (
                              <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Form validation error */}
                      {formError && (
                        <p
                          data-testid="form-error"
                          className="text-xs text-destructive"
                        >
                          {formError}
                        </p>
                      )}

                      {/* Overlap warning */}
                      {hasOverlap() && (
                        <p
                          data-testid="overlap-warning"
                          className="text-xs text-yellow-600 bg-yellow-50 rounded px-2 py-1"
                        >
                          This time overlaps with an existing workout
                        </p>
                      )}

                      <div className="flex gap-1">
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleConfirm}
                          disabled={isPending}
                          aria-label="Confirm"
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleCancel}
                          disabled={isPending}
                          aria-label="Cancel"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Rotation editor modal */}
      {rotationModal && (
        <RotationEditorModal
          open={!!rotationModal}
          onOpenChange={handleRotationModalClose}
          mesocycleId={mesocycleId}
          dayOfWeek={rotationModal.day}
          weekType={variant}
          timeSlot={rotationModal.timeSlot}
          duration={rotationModal.duration}
          existingRotation={rotationModal.existingRotation}
          templates={templates.map((t) => ({ id: t.id, name: t.name }))}
        />
      )}
    </div>
  )
}

// Rotation slot display with badge and popover summary
function RotationSlot({
  group,
  templates,
  isCompleted,
  isPending,
  onEdit,
  onRemove,
}: {
  group: RotationGroup
  templates: TemplateOption[]
  isCompleted: boolean
  isPending: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <div data-testid="schedule-entry" className="mb-2 space-y-1">
      <p
        data-testid="period-label"
        className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
      >
        {PERIOD_LABELS[derivePeriod(group.time_slot)] ?? group.period}
      </p>
      <div className="flex items-center gap-1.5">
        <span
          data-testid="time-display"
          className="text-[10px] font-mono text-muted-foreground"
        >
          {group.time_slot}
        </span>
        <span className="text-[10px] text-muted-foreground">·</span>
        <span
          data-testid="duration-display"
          className="text-[10px] text-muted-foreground"
        >
          {formatDuration(group.duration)}
        </span>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 text-left"
            data-testid="rotation-badge-trigger"
          >
            <Badge variant="secondary" className="text-[10px] cursor-pointer">
              {group.cycle_length}-week cycle
            </Badge>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
          <div className="space-y-2">
            <p className="text-xs font-semibold">Rotation cycle</p>
            <div className="space-y-1">
              {group.entries.map((entry) => (
                <div key={entry.cycle_position} className="flex items-center gap-2 text-xs">
                  <span className="w-12 shrink-0 text-muted-foreground">
                    Week {entry.cycle_position}
                  </span>
                  <span className="font-medium truncate">{entry.template_name}</span>
                </div>
              ))}
            </div>
            {!isCompleted && (
              <div className="flex gap-0.5 pt-1 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={onEdit}
                  disabled={isPending}
                  aria-label="Edit rotation"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={onRemove}
                  disabled={isPending}
                  aria-label="Remove rotation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
