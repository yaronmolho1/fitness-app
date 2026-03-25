# db/

SQLite database via Drizzle ORM. WAL mode, foreign keys enforced.

## Files
- `index.ts` — DB connection with PRAGMAs (WAL, busy_timeout, foreign_keys), exports `db`, `AppDb` type, and `sqlite`
- `schema.ts` — 13 tables: 7 planning (mutable) + 1 progression (slot_week_overrides) + 1 profile (athlete_profile) + 4 logging (immutable). Uses `defineRelations`-era column types
- `athlete-profile-schema.test.ts` — Integration tests for athlete_profile table (insert, single-row constraint, nullable fields)
- `relations.ts` — Drizzle `relations()` definitions for all table relationships

## Subdirectories
- `migrations/` — Drizzle-kit generated SQL migrations

## Key Concepts
- Planning tables (exercises, mesocycles, workout_templates, template_sections, exercise_slots, weekly_schedule, routine_items) are mutable
- Profile tables (athlete_profile) store single-row athlete metadata (age, weight, height, training history, goals)
- Progression tables (slot_week_overrides) store per-week parameter overrides for intra-phase periodization
- Logging tables (logged_workouts, logged_exercises, logged_sets, routine_logs) are immutable snapshots — no UPDATE/DELETE
- Dates stored as `text` YYYY-MM-DD, timestamps as `integer({ mode: 'timestamp' })`
- JSON columns use `text({ mode: 'json' })` with `version` field
