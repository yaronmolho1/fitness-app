# routines/

Routine item CRUD, querying, and scope filtering for daily routine management.

## Files
- `actions.ts` — `createRoutineItem()`, `updateRoutineItem()`, `deleteRoutineItem()`, `markRoutineDone()`, `markRoutineSkipped()` Server Actions with Zod validation; mark actions insert immutable `routine_logs` rows with duplicate-date guard
- `queries.ts` — `getRoutineItems()` (with mesocycle join), `getRoutineLogsForDate()`, `getStreak()`/`getStreaks()` current completion streak, `getWeeklyCompletionCount()`/`getWeeklyCompletionCounts()` for weekly progress
- `format.ts` — display formatting helpers for routine items
- `scope-filter.ts` — `isDeloadWeek()`, `filterActiveRoutineItems()` — determines which routine items are active for a given date based on scope (global, mesocycle, date_range) and deload status
