# progression/

Exercise progression data and intra-phase week override management.

## Files
- `queries.ts` — `getProgressionData()`: fetches logged workout history for a canonical name, computes top-set weight, actual/planned volume per session with mesocycle context; returns `Phase[]` boundaries for chart coloring
- `week-overrides.ts` — CRUD for per-week slot overrides (`upsertWeekOverride`, `deleteWeekOverride`, `getWeekOverrides`) + pure helpers (`mergeSlotWithOverride`, `computeDeloadDefaults`)
- `template-week-overrides.ts` — CRUD for per-week template-level overrides (`upsertTemplateWeekOverride`, `deleteTemplateWeekOverride`, `getTemplateWeekOverrides`) for running/MMA progression fields (distance, duration, pace, elevation_gain, planned_duration, interval_count/rest, is_deload) keyed by template + section + week
- `template-week-actions.ts` — Server action wrappers (`upsertTemplateWeekOverrideAction`, `deleteTemplateWeekOverrideAction`, `getTemplateWeekOverridesAction`) with cache revalidation for template-level week overrides
- `actions.ts` — Server action wrappers with `'use server'` directive and cache revalidation for slot-level week overrides
