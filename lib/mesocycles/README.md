# mesocycles/

Mesocycle lifecycle management — creation, status transitions, date calculation.

## Files
- `actions.ts` — `createMesocycle()` from FormData, `updateMesocycle()` blocks overlapping dates for planned/active mesocycles and fire-and-forget re-syncs GCal on date change (skips drafts), `planMesocycle()` validates no date overlap before transitioning draft→planned, `activateMesocycle()` with one-active constraint, `completeMesocycle()` status gate
- `queries.ts` — `getMesocycles()` list all desc by ID, `getMesocycleById(id)` single fetch, `getNonCompletedMesocycles()` planned+active ordered by start_date, `getAllNonCompletedMesocycles()` draft+planned+active ordered by start_date
- `clone-actions.ts` — `cloneMesocycle(id)` deep-copies a mesocycle with all schedules (period/time_slot), slots, template sections, template assignments, and `display_order` in a single transaction; clones always start as draft so no GCal sync
- `delete-actions.ts` — `deleteMesocycle(id)` deletes a non-active mesocycle (promotes scoped routine items to global first); collects Google event IDs before cascade delete, then fire-and-forget cleanup via `deleteEventsByIds`
- `utils.ts` — `calculateEndDate()` computes end date from start + work weeks + optional deload week; `checkDateOverlap()` detects date range conflicts against a list of mesocycles, returns conflicting name; exports `MesocycleDateRange` type
