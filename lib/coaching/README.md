# coaching/

Athlete profile data access — single-row profile for coaching context.

## Files
- `queries.ts` — `getAthleteProfile()` fetches the singleton athlete profile (returns row or null)
- `actions.ts` — `saveAthleteProfile()` server action with zod validation, upserts profile row, revalidates `/coaching`
- `queries.test.ts` — unit tests for `getAthleteProfile`
- `actions.test.ts` — unit tests for `saveAthleteProfile` (insert, update, validation, nullable fields)

## Key Concepts
- Single-row pattern: profile always uses `id=1`, no multi-user support
- Partial updates: only provided fields are written on update
- Zod schema validates age (positive int), weight/height (positive), training_age (non-negative)
