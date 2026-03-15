# db/

SQLite database via Drizzle ORM. WAL mode, foreign keys enforced.

## Files
- `index.ts` — DB connection with PRAGMAs (WAL, busy_timeout, foreign_keys), exports `db`, `AppDb` type, and `sqlite`
- `schema.ts` — 10 tables: 6 planning (mutable) + 4 logging (immutable). Uses `defineRelations`-era column types
- `relations.ts` — Drizzle `relations()` definitions for all table relationships

## Subdirectories
- `migrations/` — Drizzle-kit generated SQL migrations

## Key Concepts
- Planning tables (exercises, mesocycles, workout_templates, exercise_slots, weekly_schedule, routine_items) are mutable
- Logging tables (logged_workouts, logged_exercises, logged_sets, routine_logs) are immutable snapshots — no UPDATE/DELETE
- Dates stored as `text` YYYY-MM-DD, timestamps as `integer({ mode: 'timestamp' })`
- JSON columns use `text({ mode: 'json' })` with `version` field
