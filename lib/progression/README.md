# progression/

Exercise progression data and intra-phase week override management.

## Files
- `queries.ts` — `getProgressionData()`: fetches logged workout history for a canonical name, computes top-set weight, actual/planned volume per session with mesocycle context; returns `Phase[]` boundaries for chart coloring
- `week-overrides.ts` — CRUD for per-week slot overrides (`upsertWeekOverride`, `deleteWeekOverride`, `getWeekOverrides`) + pure helpers (`mergeSlotWithOverride`, `computeDeloadDefaults`)
- `actions.ts` — Server action wrappers with `'use server'` directive and cache revalidation
