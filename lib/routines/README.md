# routines/

Routine item CRUD, querying, and scope filtering for daily routine management.

## Files
- `actions.ts` — `createRoutineItem()`, `updateRoutineItem()`, `deleteRoutineItem()` Server Actions with Zod validation and automatic ordering
- `queries.ts` — routine item read queries (by template, by scope, etc.)
- `format.ts` — display formatting helpers for routine items
- `scope-filter.ts` — `isDeloadWeek()`, `filterActiveRoutineItems()` — determines which routine items are active for a given date based on scope (global, mesocycle, date_range) and deload status
