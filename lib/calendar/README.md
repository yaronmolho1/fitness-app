# calendar/

Monthly calendar projection: maps each date to its scheduled template or rest, marking completed vs projected.

## Files
- `queries.ts` — `getCalendarProjection(db, month)` builds day-by-day view from overlapping mesocycles, weekly schedules, schedule week overrides, and logged workouts. Exports `CalendarDay`, `CalendarProjection` types.
- `queries.test.ts` — integration tests for calendar projection query
- `day-detail.ts` — `getDayDetail(db, date)` returns an array of rest/projected/completed details for a single date: one entry per scheduled workout with period field, or a single rest entry. Exports `DayDetailResult`, `Period`, `SlotDetail`, `LoggedExerciseDetail`, `TemplateSnapshot` types.
- `day-detail.test.ts` — integration tests for day detail query
- `__tests__/queries.characterize.test.ts` — characterization tests pinning getCalendarProjection behavior
- `__tests__/queries.projection-overrides.test.ts` — tests for schedule week override integration in projection
