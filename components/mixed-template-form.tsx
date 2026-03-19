'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createMixedTemplate } from '@/lib/templates/section-actions'
import type { CreateMixedTemplateInput } from '@/lib/templates/section-actions'

const RUN_TYPES = [
  { value: 'easy', label: 'Easy' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'interval', label: 'Interval' },
  { value: 'long', label: 'Long Run' },
  { value: 'race', label: 'Race' },
] as const

const HR_ZONES = [1, 2, 3, 4, 5] as const

type Modality = 'resistance' | 'running' | 'mma'
type RunType = (typeof RUN_TYPES)[number]['value']

type SectionDraft = {
  id: string
  section_name: string
  modality: Modality
  // Running fields
  run_type: RunType | ''
  target_pace: string
  hr_zone: string
  interval_count: string
  interval_rest: string
  coaching_cues: string
  // MMA fields
  planned_duration: string
}

function createEmptySection(): SectionDraft {
  return {
    id: crypto.randomUUID(),
    section_name: '',
    modality: 'resistance',
    run_type: '',
    target_pace: '',
    hr_zone: '',
    interval_count: '',
    interval_rest: '',
    coaching_cues: '',
    planned_duration: '',
  }
}

type Props = {
  mesocycleId: number
  onSuccess?: () => void
  onCancel?: () => void
}

export function MixedTemplateForm({ mesocycleId, onSuccess, onCancel }: Props) {
  const [name, setName] = useState('')
  const [sections, setSections] = useState<SectionDraft[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function addSection() {
    setSections((prev) => [...prev, createEmptySection()])
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id))
  }

  function updateSection(id: string, updates: Partial<SectionDraft>) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    )
  }

  function moveSectionUp(index: number) {
    if (index <= 0) return
    setSections((prev) => {
      const next = [...prev]
      const temp = next[index - 1]
      next[index - 1] = next[index]
      next[index] = temp
      return next
    })
  }

  function moveSectionDown(index: number) {
    setSections((prev) => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      const temp = next[index + 1]
      next[index + 1] = next[index]
      next[index] = temp
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    if (sections.length < 2) {
      setError('Mixed templates require at least 2 sections')
      return
    }

    // Validate section names
    const emptySectionName = sections.find((s) => !s.section_name.trim())
    if (emptySectionName) {
      setError('All section names are required')
      return
    }

    // Validate different modalities
    const uniqueModalities = new Set(sections.map((s) => s.modality))
    if (uniqueModalities.size < 2) {
      setError('Mixed templates must contain at least 2 different modalities')
      return
    }

    const input: CreateMixedTemplateInput = {
      name,
      mesocycle_id: mesocycleId,
      sections: sections.map((s, i) => ({
        section_name: s.section_name,
        modality: s.modality,
        order: i + 1,
        ...(s.modality === 'running'
          ? {
              run_type: s.run_type || undefined,
              target_pace: s.target_pace || undefined,
              hr_zone: s.hr_zone ? Number(s.hr_zone) : null,
              interval_count: s.interval_count ? Number(s.interval_count) : null,
              interval_rest: s.interval_rest ? Number(s.interval_rest) : null,
              coaching_cues: s.coaching_cues || undefined,
            }
          : {}),
        ...(s.modality === 'mma'
          ? {
              planned_duration: s.planned_duration ? Number(s.planned_duration) : null,
            }
          : {}),
      })),
    }

    setSubmitting(true)
    try {
      const result = await createMixedTemplate(input)
      if (result.success) {
        onSuccess?.()
      } else {
        setError(result.error)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="mixed-template-name">Template Name</Label>
        <Input
          id="mixed-template-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Strength + Cardio"
        />
      </div>

      {/* Section list */}
      <div className="space-y-3">
        {sections.map((section, index) => (
          <SectionEditor
            key={section.id}
            section={section}
            index={index}
            total={sections.length}
            onChange={(updates) => updateSection(section.id, updates)}
            onRemove={() => removeSection(section.id)}
            onMoveUp={() => moveSectionUp(index)}
            onMoveDown={() => moveSectionDown(index)}
          />
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addSection}>
        Add Section
      </Button>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Mixed Template'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

// ============================================================================
// Section editor for each section in the mixed template
// ============================================================================

type SectionEditorProps = {
  section: SectionDraft
  index: number
  total: number
  onChange: (updates: Partial<SectionDraft>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

function SectionEditor({
  section,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: SectionEditorProps) {
  const isInterval = section.run_type === 'interval'

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Section {index + 1}
        </span>
        <div className="flex gap-1">
          {index > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onMoveUp}
            >
              Move Up
            </Button>
          )}
          {index < total - 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onMoveDown}
            >
              Move Down
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Input
            value={section.section_name}
            onChange={(e) => onChange({ section_name: e.target.value })}
            placeholder="Section name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`modality-${section.id}`}>Modality</Label>
          <select
            id={`modality-${section.id}`}
            value={section.modality}
            onChange={(e) => onChange({ modality: e.target.value as Modality })}
            aria-label="Modality"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="resistance">Resistance</option>
            <option value="running">Running</option>
            <option value="mma">MMA/BJJ</option>
          </select>
        </div>
      </div>

      {/* Running-specific fields */}
      {section.modality === 'running' && (
        <div className="space-y-3 border-t pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`run-type-${section.id}`}>Run Type</Label>
              <select
                id={`run-type-${section.id}`}
                value={section.run_type}
                onChange={(e) => onChange({ run_type: e.target.value as RunType | '' })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select run type</option>
                {RUN_TYPES.map((rt) => (
                  <option key={rt.value} value={rt.value}>
                    {rt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`target-pace-${section.id}`}>Target Pace</Label>
              <Input
                id={`target-pace-${section.id}`}
                value={section.target_pace}
                onChange={(e) => onChange({ target_pace: e.target.value })}
                placeholder="5:30/km"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`hr-zone-${section.id}`}>HR Zone</Label>
              <select
                id={`hr-zone-${section.id}`}
                value={section.hr_zone}
                onChange={(e) => onChange({ hr_zone: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">---</option>
                {HR_ZONES.map((z) => (
                  <option key={z} value={z}>
                    Zone {z}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isInterval && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`interval-count-${section.id}`}>Intervals</Label>
                <Input
                  id={`interval-count-${section.id}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={section.interval_count}
                  onChange={(e) => onChange({ interval_count: e.target.value })}
                  placeholder="e.g. 6"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`interval-rest-${section.id}`}>Rest (seconds)</Label>
                <Input
                  id={`interval-rest-${section.id}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={section.interval_rest}
                  onChange={(e) => onChange({ interval_rest: e.target.value })}
                  placeholder="e.g. 90"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`coaching-cues-${section.id}`}>Coaching Cues</Label>
            <textarea
              id={`coaching-cues-${section.id}`}
              value={section.coaching_cues}
              onChange={(e) => onChange({ coaching_cues: e.target.value })}
              placeholder="Notes visible to athlete..."
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>
      )}

      {/* MMA-specific fields */}
      {section.modality === 'mma' && (
        <div className="space-y-3 border-t pt-3">
          <div className="space-y-1.5">
            <Label htmlFor={`planned-duration-${section.id}`}>Planned Duration (minutes)</Label>
            <Input
              id={`planned-duration-${section.id}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={section.planned_duration}
              onChange={(e) => onChange({ planned_duration: e.target.value })}
              placeholder="e.g. 90"
            />
          </div>
        </div>
      )}

      {/* Resistance note */}
      {section.modality === 'resistance' && (
        <p className="text-xs text-muted-foreground border-t pt-3">
          Exercise slots can be added after creating the template.
        </p>
      )}
    </div>
  )
}
