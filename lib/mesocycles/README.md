# mesocycles/

Mesocycle lifecycle management — creation, status transitions, date calculation.

## Files
- `actions.ts` — `createMesocycle()` from FormData, `updateMesocycle()` for editing planned/active mesocycles (fire-and-forget re-sync on date range change), `activateMesocycle()` with one-active constraint, `completeMesocycle()` status gate
- `queries.ts` — `getMesocycles()` list all desc by ID, `getMesocycleById(id)` single fetch
- `clone-actions.ts` — `cloneMesocycle(id)` deep-copies a mesocycle with all schedules (period/time_slot), slots, template sections, and template assignments in a single transaction; fire-and-forget sync to Google Calendar
- `delete-actions.ts` — `deleteMesocycle(id)` deletes a non-active mesocycle (promotes scoped routine items to global first); fire-and-forget Google Calendar event cleanup via `deleteEventsForMesocycle`
- `utils.ts` — `calculateEndDate()` computes end date from start + work weeks + optional deload week
