'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, BarChart3 } from 'lucide-react'

type Exercise = {
  id: number
  name: string
  modality: string
  muscle_group: string | null
  equipment: string | null
  created_at: Date | null
}

type ProgressionDataPoint = {
  date: string
  mesocycleId: number | null
  mesocycleName: string | null
  plannedWeight: number | null
  actualWeight: number | null
  plannedVolume: number | null
  actualVolume: number | null
}

// Phase colors for distinguishing mesocycles
const PHASE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

function toCanonicalName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

type PhaseColorMap = Record<number, string>

function buildPhaseColorMap(data: ProgressionDataPoint[]): PhaseColorMap {
  const seen = new Map<number, string>()
  let idx = 0
  for (const d of data) {
    if (d.mesocycleId !== null && !seen.has(d.mesocycleId)) {
      seen.set(d.mesocycleId, PHASE_COLORS[idx % PHASE_COLORS.length])
      idx++
    }
  }
  return Object.fromEntries(seen)
}

// Custom dot renderer for phase-colored data points
function PhaseColoredDot(props: {
  cx?: number
  cy?: number
  payload?: ProgressionDataPoint
  phaseColors: PhaseColorMap
  isActual?: boolean
}) {
  const { cx, cy, payload, phaseColors, isActual } = props
  if (!cx || !cy || !payload) return null

  const color = payload.mesocycleId !== null
    ? phaseColors[payload.mesocycleId] ?? 'var(--muted-foreground)'
    : 'var(--muted-foreground)'

  return (
    <circle
      cx={cx}
      cy={cy}
      r={isActual ? 5 : 4}
      fill={color}
      stroke={isActual ? 'var(--foreground)' : 'var(--muted-foreground)'}
      strokeWidth={isActual ? 2 : 1}
      opacity={isActual ? 1 : 0.7}
    />
  )
}

type ProgressionChartProps = {
  exercises: Exercise[]
}

export function ProgressionChart({ exercises }: ProgressionChartProps) {
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [data, setData] = useState<ProgressionDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)
  const [view, setView] = useState<'weight' | 'volume'>('weight')

  const fetchData = useCallback(async (canonicalName: string) => {
    setLoading(true)
    setFetched(false)
    try {
      const res = await fetch(`/api/progression?canonical_name=${encodeURIComponent(canonicalName)}`)
      const json = await res.json()
      setData(json.data ?? [])
    } catch {
      setData([])
    } finally {
      setLoading(false)
      setFetched(true)
    }
  }, [])

  useEffect(() => {
    if (selectedExercise) {
      const exercise = exercises.find((e) => String(e.id) === selectedExercise)
      if (exercise) {
        fetchData(toCanonicalName(exercise.name))
      }
    }
  }, [selectedExercise, exercises, fetchData])

  const phaseColors = buildPhaseColorMap(data)

  // Build legend items from mesocycle phases
  const phases = Array.from(
    new Map(
      data
        .filter((d) => d.mesocycleId !== null)
        .map((d) => [d.mesocycleId!, d.mesocycleName ?? `Phase ${d.mesocycleId}`])
    )
  )

  const plannedKey = view === 'weight' ? 'plannedWeight' : 'plannedVolume'
  const actualKey = view === 'weight' ? 'actualWeight' : 'actualVolume'
  const yLabel = view === 'weight' ? 'Weight (kg)' : 'Volume (kg)'

  return (
    <div className="space-y-6">
      {/* Controls row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Select value={selectedExercise} onValueChange={setSelectedExercise}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Select exercise" />
          </SelectTrigger>
          <SelectContent>
            {exercises.map((ex) => (
              <SelectItem key={ex.id} value={String(ex.id)}>
                {ex.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tabs value={view} onValueChange={(v) => setView(v as 'weight' | 'volume')}>
          <TabsList>
            <TabsTrigger value="weight" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Weight
            </TabsTrigger>
            <TabsTrigger value="volume" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Volume
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Chart area */}
      <div className="rounded-lg border bg-card p-4 sm:p-6">
        {!selectedExercise && (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <p>Select an exercise to view progression data</p>
          </div>
        )}

        {selectedExercise && loading && (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <p>Loading progression data...</p>
          </div>
        )}

        {selectedExercise && fetched && !loading && data.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
            <TrendingUp className="h-10 w-10 opacity-30" />
            <p>No progression data for this exercise</p>
            <p className="text-sm">Log some workouts to see your progression here</p>
          </div>
        )}

        {selectedExercise && !loading && data.length > 0 && (
          <div className="space-y-4">
            {/* Phase legend */}
            {phases.length > 1 && (
              <div className="flex flex-wrap gap-3 text-xs">
                {phases.map(([id, name]) => (
                  <div key={id} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: phaseColors[id] }}
                    />
                    <span className="text-muted-foreground">{name}</span>
                  </div>
                ))}
              </div>
            )}

            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  tickFormatter={(d: string) => {
                    const parts = d.split('-')
                    return `${parts[1]}/${parts[2]}`
                  }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  label={{
                    value: yLabel,
                    angle: -90,
                    position: 'insideLeft',
                    style: { fill: 'var(--muted-foreground)', fontSize: 12 },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--popover)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.5rem',
                    color: 'var(--popover-foreground)',
                  }}
                  labelFormatter={(d) => {
                    const label = String(d)
                    const point = data.find((p) => p.date === label)
                    const phase = point?.mesocycleName ? ` — ${point.mesocycleName}` : ''
                    return `${label}${phase}`
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={plannedKey}
                  name="Planned"
                  stroke="var(--muted-foreground)"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  dot={(dotProps) => (
                    <PhaseColoredDot
                      key={`planned-${dotProps.index}`}
                      {...dotProps}
                      phaseColors={phaseColors}
                    />
                  )}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey={actualKey}
                  name="Actual"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  dot={(dotProps) => (
                    <PhaseColoredDot
                      key={`actual-${dotProps.index}`}
                      {...dotProps}
                      phaseColors={phaseColors}
                      isActual
                    />
                  )}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
