# coaching/

Athlete profile data access and recent session history for coaching context.

## Files
- `queries.ts` — `getAthleteProfile()` fetches the singleton athlete profile (returns row or null). `getRecentSessions(db, weeks)` fetches logged workouts from the last N weeks with nested exercises and sets in chronological order. `getCurrentPlan(db)` fetches active mesocycle with templates (including running/MMA fields like `target_elevation_gain`, `target_duration`, `planned_duration`), exercise slots, and weekly schedule with `time_slot`. `getRunningProgressionData(db, canonicalName)` fetches distance/pace/HR/elevation trend data from logged running workouts. Exports `RecentSession`, `RecentSessionExercise`, `RecentSessionSet`, `CurrentPlan`, `CurrentPlanTemplate`, `CurrentPlanScheduleEntry`, `CurrentPlanSlot`, `RunningTrendPoint` types.
- `summary.ts` — `generateCoachingSummary(input)` builds a structured markdown summary for LLM coaching context. Assembles sections: athlete profile, current plan (schedule + templates with all modalities), recent sessions (resistance last 2 weeks, all running), weekly volume/elevation table, resistance progression trends, running progression trends, subjective state, upcoming plan. Exports `SummaryInput`, `SubjectiveState`, `ProgressionTrend`, `ProgressionTrendPoint`, `RunningProgressionTrend`, `RunningTrendPoint` types.
- `actions.ts` — `saveAthleteProfile()` server action with zod validation, upserts profile row, revalidates `/coaching`
- `queries.test.ts` — unit + integration tests for profile and recent sessions queries
- `actions.test.ts` — unit tests for `saveAthleteProfile` (insert, update, validation, nullable fields)

## Key Concepts
- Single-row pattern: profile always uses `id=1`, no multi-user support
- Partial updates: only provided fields are written on update
- Zod schema validates age (positive int), weight/height (positive), training_age (non-negative)
