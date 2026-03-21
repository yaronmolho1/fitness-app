'use client'

import { useState } from 'react'
import { createRunningTemplate } from '@/lib/templates/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const RUN_TYPES = [
  { value: 'easy', label: 'Easy' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'interval', label: 'Interval' },
  { value: 'long', label: 'Long Run' },
  { value: 'race', label: 'Race' },
] as const

const HR_ZONES = [1, 2, 3, 4, 5] as const

type RunType = (typeof RUN_TYPES)[number]['value']

type Props = {
  mesocycleId: number
  onSuccess?: () => void
}

export function RunningTemplateForm({ mesocycleId, onSuccess }: Props) {
  const [name, setName] = useState('')
  const [runType, setRunType] = useState<RunType | ''>('')
  const [targetPace, setTargetPace] = useState('')
  const [hrZone, setHrZone] = useState('')
  const [intervalCount, setIntervalCount] = useState('')
  const [intervalRest, setIntervalRest] = useState('')
  const [targetDistance, setTargetDistance] = useState('')
  const [targetDuration, setTargetDuration] = useState('')
  const [coachingCues, setCoachingCues] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isInterval = runType === 'interval'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!runType) {
      setError('Run type is required')
      return
    }

    const hrZoneNum = hrZone ? Number(hrZone) : null
    if (hrZoneNum !== null && (hrZoneNum < 1 || hrZoneNum > 5)) {
      setError('HR zone must be between 1 and 5')
      return
    }

    const intervalCountNum = intervalCount ? Number(intervalCount) : null
    if (isInterval && intervalCountNum !== null && intervalCountNum < 1) {
      setError('Interval count must be positive')
      return
    }

    const intervalRestNum = intervalRest ? Number(intervalRest) : null
    if (isInterval && intervalRestNum !== null && intervalRestNum < 0) {
      setError('Interval rest cannot be negative')
      return
    }

    const distanceNum = targetDistance ? Number(targetDistance) : null
    if (distanceNum !== null && distanceNum <= 0) {
      setError('Distance must be positive')
      return
    }

    const durationNum = targetDuration ? Number(targetDuration) : null
    if (durationNum !== null && durationNum <= 0) {
      setError('Duration must be positive')
      return
    }

    setSubmitting(true)
    try {
      const result = await createRunningTemplate({
        name,
        mesocycle_id: mesocycleId,
        run_type: runType,
        target_pace: targetPace || undefined,
        hr_zone: hrZoneNum,
        interval_count: isInterval ? intervalCountNum : null,
        interval_rest: isInterval ? intervalRestNum : null,
        coaching_cues: coachingCues || undefined,
        target_distance: distanceNum,
        target_duration: durationNum,
      })

      if (result.success) {
        setName('')
        setRunType('')
        setTargetPace('')
        setHrZone('')
        setIntervalCount('')
        setIntervalRest('')
        setTargetDistance('')
        setTargetDuration('')
        setCoachingCues('')
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
        <Label htmlFor="running-name">Template Name</Label>
        <Input
          id="running-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tuesday Tempo"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="running-run-type">Run Type</Label>
        <select
          id="running-run-type"
          value={runType}
          onChange={(e) => setRunType(e.target.value as RunType | '')}
          className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-10 md:text-sm"
        >
          <option value="">Select run type</option>
          {RUN_TYPES.map((rt) => (
            <option key={rt.value} value={rt.value}>
              {rt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="running-target-pace">Target Pace</Label>
          <Input
            id="running-target-pace"
            value={targetPace}
            onChange={(e) => setTargetPace(e.target.value)}
            placeholder="5:30/km"
            className="h-12 md:h-10"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="running-hr-zone">HR Zone</Label>
          <select
            id="running-hr-zone"
            value={hrZone}
            onChange={(e) => setHrZone(e.target.value)}
            className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-10 md:text-sm"
          >
            <option value="">—</option>
            {HR_ZONES.map((z) => (
              <option key={z} value={z}>
                Zone {z}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="running-target-distance">
            {isInterval ? 'Target Distance (km, per rep)' : 'Target Distance (km)'}
          </Label>
          <Input
            id="running-target-distance"
            type="text"
            inputMode="decimal"
            value={targetDistance}
            onChange={(e) => setTargetDistance(e.target.value)}
            placeholder="e.g. 5"
            className="h-12 md:h-10"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="running-target-duration">
            {isInterval ? 'Target Duration (min, per rep)' : 'Target Duration (min)'}
          </Label>
          <Input
            id="running-target-duration"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={targetDuration}
            onChange={(e) => setTargetDuration(e.target.value)}
            placeholder="e.g. 30"
            className="h-12 md:h-10"
          />
        </div>
      </div>

      <div
        className="grid overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          gridTemplateRows: isInterval ? '1fr' : '0fr',
          opacity: isInterval ? 1 : 0,
        }}
      >
        <div className="min-h-0">
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="running-interval-count">Intervals</Label>
              <Input
                id="running-interval-count"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={intervalCount}
                onChange={(e) => setIntervalCount(e.target.value)}
                placeholder="e.g. 6"
                className="h-12 md:h-10"
                tabIndex={isInterval ? 0 : -1}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="running-interval-rest">Rest (seconds)</Label>
              <Input
                id="running-interval-rest"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={intervalRest}
                onChange={(e) => setIntervalRest(e.target.value)}
                placeholder="e.g. 90"
                className="h-12 md:h-10"
                tabIndex={isInterval ? 0 : -1}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="running-coaching-cues">Coaching Cues</Label>
        <textarea
          id="running-coaching-cues"
          value={coachingCues}
          onChange={(e) => setCoachingCues(e.target.value)}
          placeholder="Notes visible to athlete..."
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
        />
      </div>

      <Button type="submit" className="h-12 w-full md:h-10" disabled={submitting}>
        {submitting ? 'Creating...' : 'Create Running Template'}
      </Button>
    </form>
  )
}
