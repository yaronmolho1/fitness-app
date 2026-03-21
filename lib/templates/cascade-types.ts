// Shared types for cascade operations — safe to import from client components

export type CascadeScope = 'this-only' | 'this-and-future' | 'all-phases'

export type CascadeUpdates = {
  name?: string
  notes?: string
  // Running-specific fields
  run_type?: 'easy' | 'tempo' | 'interval' | 'long' | 'race'
  target_pace?: string | null
  hr_zone?: number | null
  interval_count?: number | null
  interval_rest?: number | null
  coaching_cues?: string | null
  target_distance?: number | null
  target_duration?: number | null
  // MMA-specific
  planned_duration?: number | null
}

export type CascadeSummary = {
  updated: number
  skipped: number
  skippedCompleted: number
  skippedNoMatch: number
}

export type CascadePreviewTarget = {
  id: number
  mesocycleId: number
  mesocycleName: string
  hasLoggedWorkouts: boolean
}

export type CascadePreviewData = {
  totalTargets: number
  skippedCount: number
  targets: CascadePreviewTarget[]
}

export type CascadePreviewResult =
  | { success: true; data: CascadePreviewData }
  | { success: false; error: string }

export type CascadeUpdateResult =
  | { success: true; data: CascadeSummary }
  | { success: false; error: string }
