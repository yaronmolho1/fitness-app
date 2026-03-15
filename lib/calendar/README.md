# calendar/

Monthly calendar projection: maps each date to its scheduled template or rest, marking completed vs projected.

## Files
- `queries.ts` — `getCalendarProjection(db, month)` builds day-by-day view from overlapping mesocycles, weekly schedules, and logged workouts. Exports `CalendarDay`, `CalendarProjection` types.
- `queries.test.ts` — integration tests for calendar projection query
