# today/

Query module for the "today" workout lookup — resolves the active mesocycle, schedule slot, and exercise slots for a given date.

## Files
- `queries.ts` — `getTodayWorkout` returns `TodayResult[]` (array of sessions per day, sorted by period). Lookup chain: active meso → day_of_week → all schedule entries → template + slots per session. For mixed templates, loads `template_sections` with per-section modality-specific fields and resistance slots. Exports `TodayResult` union type, `SectionData` type, `Period` type, `isDeloadWeek` helper.
- `queries.test.ts` — unit tests covering no active meso, rest day, workout with slots, deload week detection, and multi-session scenarios
