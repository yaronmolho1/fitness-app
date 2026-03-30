# today/

Query module for the "today" workout lookup — resolves the active mesocycle, effective schedule, and exercise slots for a given date. Supports multi-session days, slot/template week overrides, routine tracking on rest days, and already-logged detection.

## Files
- `queries.ts` — `getTodayWorkout` returns `TodayResult[]` (array of sessions per day, sorted by `time_slot`). Lookup chain: active/completed meso covering date → day_of_week → effective schedule via `getEffectiveScheduleForDay` (base + `schedule_week_overrides`) → template + slots per session. Merges `slot_week_overrides` and `template_week_overrides` into returned data for per-week progression. For mixed templates, loads `template_sections` with per-section modality-specific fields and resistance slots. Each result carries `time_slot` (HH:MM string), `duration` (minutes), and `period`. Rest days include active routine items with weekly counts and streaks. Exports `TodayResult` union type (`workout | rest_day | no_active_mesocycle | already_logged`), `SlotData`, `SectionData`, `TemplateInfo`, `MesocycleInfo`, `Period`, `RoutineItemInfo`, `RoutineLogInfo`, `RestDayRoutines`, `LoggedWorkoutSummary`, `LoggedExerciseData`, `LoggedSetData`, `isDeloadWeek` helper.
- `queries.test.ts` — unit tests covering no active meso, rest day, workout with slots, deload week detection
- `queries.multi-session.test.ts` — multi-session day scenarios
- `queries.mixed.test.ts` — mixed-modality template tests
- `queries.t184.test.ts` — schedule week override integration tests
- `queries.t200.test.ts` — template week override integration tests
- `queries.characterize.test.ts` — characterization tests for core query behavior
- `queries.multisession.characterize.test.ts` — characterization tests for multi-session paths
- `queries.t153-characterize.test.ts` — characterization tests for T153 features
- `queries.t184-characterize.test.ts` — characterization tests for T184 features
