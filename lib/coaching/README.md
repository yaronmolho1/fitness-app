# coaching/

Athlete profile data access and recent session history for coaching context.

## Files
- `queries.ts` — `getAthleteProfile()` fetches the singleton athlete profile (returns row or null). `getRecentSessions(db, weeks)` fetches logged workouts from the last N weeks with nested exercises and sets in chronological order. Exports `RecentSession`, `RecentSessionExercise`, `RecentSessionSet` types.
- `actions.ts` — `saveAthleteProfile()` server action with zod validation, upserts profile row, revalidates `/coaching`
- `queries.test.ts` — unit + integration tests for profile and recent sessions queries
- `actions.test.ts` — unit tests for `saveAthleteProfile` (insert, update, validation, nullable fields)

## Key Concepts
- Single-row pattern: profile always uses `id=1`, no multi-user support
- Partial updates: only provided fields are written on update
- Zod schema validates age (positive int), weight/height (positive), training_age (non-negative)
