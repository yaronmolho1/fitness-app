// Shared types for cascade operations — safe to import from client components

export type CascadeScope = 'this-only' | 'this-and-future' | 'all-phases'

export type CascadeUpdates = {
  name?: string
  notes?: string
}

export type CascadeSummary = {
  updated: number
  skipped: number
  skippedCompleted: number
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
