# db/

SQLite database via Drizzle ORM. WAL mode, foreign keys enforced.

## Files
- `index.ts` — DB connection with PRAGMAs (WAL, busy_timeout, foreign_keys), exports `db`, `AppDb` type, and `sqlite`
- `schema.ts` — 16 tables: 7 planning (mutable) + 2 progression (slot_week_overrides, schedule_week_overrides) + 1 profile (athlete_profile) + 4 logging (immutable) + 2 Google Calendar (google_credentials, google_calendar_events). Uses `defineRelations`-era column types
- `athlete-profile-schema.test.ts` — Integration tests for athlete_profile table (insert, single-row constraint, nullable fields)
- `time-scheduling-migration.test.ts` — Integration tests for T197 3-phase migration (backfill, NOT NULL enforcement, unique indexes, Google Calendar tables)
- `relations.ts` — Drizzle `relations()` definitions for all table relationships

## Subdirectories
- `migrations/` — Drizzle-kit generated SQL migrations

## Key Concepts
- Planning tables (exercises, mesocycles, workout_templates, template_sections, exercise_slots, weekly_schedule, routine_items) are mutable
- Profile tables (athlete_profile) store single-row athlete metadata (age, weight, height, training history, goals, timezone)
- Progression tables (slot_week_overrides, schedule_week_overrides) store per-week parameter overrides
- Logging tables (logged_workouts, logged_exercises, logged_sets, routine_logs) are immutable snapshots — no UPDATE/DELETE
- Google Calendar tables (google_credentials, google_calendar_events) store OAuth tokens and event sync mappings
- Schedule entries keyed by time_slot (HH:MM) + template_id; period derived from time_slot
- Dates stored as `text` YYYY-MM-DD, timestamps as `integer({ mode: 'timestamp' })`
- JSON columns use `text({ mode: 'json' })` with `version` field
