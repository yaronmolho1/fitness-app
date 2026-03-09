# DB Schema & Migrations
**Status:** ready
**Epic:** Foundation
**Depends:** none

## Description
As a developer, I can initialize the SQLite database with all 10 tables, WAL mode, and Drizzle ORM v2 relations so that every feature in the app has a stable, type-safe data layer to build on.

## Acceptance Criteria

### Connection & PRAGMAs (per ADR-001)
- [ ] Database connection applies all 4 PRAGMAs on every init: `journal_mode=WAL`, `busy_timeout=5000`, `synchronous=NORMAL`, `foreign_keys=ON`
- [ ] WAL mode is confirmed active after connection (`PRAGMA journal_mode` returns `wal`)
- [ ] Foreign key enforcement is active (`PRAGMA foreign_keys` returns `1`)
- [ ] Database file is stored at the path specified by `DATABASE_URL` env var (default: `/app/data/db.sqlite`)

### Migration workflow
- [ ] Initial migration is generated via `drizzle-kit generate` (never `drizzle-kit push`)
- [ ] Migration is applied via `drizzle-kit migrate`
- [ ] Migration files are committed to source control alongside schema
- [ ] Re-running migrate on an already-migrated database is a no-op (idempotent)

### Drizzle v2 relations (per ADR-007)
- [ ] All relations are defined using the `defineRelations` API — the old `relations()` function is not used anywhere in this project
- [ ] Relations config is passed to the `drizzle()` init so `with:` eager loading works
- [ ] Schema definitions and relation definitions live in separate files (`schema.ts` and `relations.ts`)

### Planning layer — all 6 tables present

**`exercises` table**
- [ ] Columns: `id` (auto-increment integer PK), `name` (text, not null), `modality` (text enum: `resistance` | `running` | `mma`, not null), `muscle_group` (text, nullable), `equipment` (text, nullable), `created_at` (integer timestamp)
- [ ] `name` has a unique constraint

**`exercise_slots` table**
- [ ] Columns: `id` (auto-increment integer PK), `template_id` (integer FK → `workout_templates.id`, not null), `exercise_id` (integer FK → `exercises.id`, not null), `sets` (integer, nullable), `reps` (text, nullable), `weight` (real, nullable), `rpe` (real, nullable), `rest_seconds` (integer, nullable), `guidelines` (text, nullable), `order` (integer, not null), `is_main` (integer boolean, not null, default 0), `created_at` (integer timestamp)
- [ ] FK `template_id` references `workout_templates.id` with cascade delete
- [ ] FK `exercise_id` references `exercises.id` (no cascade — deletion protection enforced at app layer)

**`workout_templates` table**
- [ ] Columns: `id` (auto-increment integer PK), `mesocycle_id` (integer FK → `mesocycles.id`, not null), `name` (text, not null), `canonical_name` (text, not null), `modality` (text enum: `resistance` | `running` | `mma`, not null), `notes` (text, nullable), `created_at` (integer timestamp)
- [ ] FK `mesocycle_id` references `mesocycles.id` with cascade delete

**`mesocycles` table**
- [ ] Columns: `id` (auto-increment integer PK), `name` (text, not null), `start_date` (text, not null — stored as `YYYY-MM-DD` calendar date string, not timestamp), `end_date` (text, not null — stored as `YYYY-MM-DD`), `work_weeks` (integer, not null), `has_deload` (integer boolean, not null, default 0), `status` (text enum: `planned` | `active` | `completed`, not null, default `planned`), `created_at` (integer timestamp)

**`weekly_schedule` table**
- [ ] Columns: `id` (auto-increment integer PK), `mesocycle_id` (integer FK → `mesocycles.id`, not null), `day_of_week` (integer 0–6, not null), `template_id` (integer FK → `workout_templates.id`, nullable — null = rest day), `week_type` (text enum: `normal` | `deload`, not null, default `normal`), `created_at` (integer timestamp)
- [ ] FK `mesocycle_id` references `mesocycles.id` with cascade delete
- [ ] Unique constraint on (`mesocycle_id`, `day_of_week`, `week_type`)

**`routine_items` table**
- [ ] Columns: `id` (auto-increment integer PK), `name` (text, not null), `category` (text, nullable), `has_weight` (integer boolean, not null, default 0), `has_length` (integer boolean, not null, default 0), `has_duration` (integer boolean, not null, default 0), `has_sets` (integer boolean, not null, default 0), `has_reps` (integer boolean, not null, default 0), `frequency_target` (integer, not null), `scope` (text enum: `global` | `mesocycle` | `date_range`, not null), `mesocycle_id` (integer FK → `mesocycles.id`, nullable), `start_date` (text, nullable — `YYYY-MM-DD`), `end_date` (text, nullable — `YYYY-MM-DD`), `skip_on_deload` (integer boolean, not null, default 0), `created_at` (integer timestamp)
- [ ] At least one of `has_weight`, `has_length`, `has_duration`, `has_sets`, `has_reps` must be 1 (enforced at application layer)

### Logging layer — all 4 tables present

**`logged_workouts` table**
- [ ] Columns: `id` (auto-increment integer PK), `template_id` (integer, nullable — soft reference, no FK), `canonical_name` (text, nullable), `logged_at` (integer timestamp, not null), `rating` (integer, nullable), `notes` (text, nullable), `template_snapshot` (text JSON, not null — stored as `text({ mode: 'json' })`), `created_at` (integer timestamp)
- [ ] `template_snapshot` JSON type includes a `version: number` field (per architecture conventions)
- [ ] No FK from `logged_workouts` to `workout_templates` — cross-layer link is string-based via `canonical_name` (per architecture doc)

**`logged_exercises` table**
- [ ] Columns: `id` (auto-increment integer PK), `logged_workout_id` (integer FK → `logged_workouts.id`, not null), `exercise_id` (integer, nullable — soft reference), `exercise_name` (text, not null — snapshotted at log time), `order` (integer, not null), `created_at` (integer timestamp)
- [ ] FK `logged_workout_id` references `logged_workouts.id` with cascade delete

**`logged_sets` table**
- [ ] Columns: `id` (auto-increment integer PK), `logged_exercise_id` (integer FK → `logged_exercises.id`, not null), `set_number` (integer, not null), `actual_reps` (integer, nullable), `actual_weight` (real, nullable), `actual_rpe` (real, nullable), `created_at` (integer timestamp)
- [ ] FK `logged_exercise_id` references `logged_exercises.id` with cascade delete

**`routine_logs` table**
- [ ] Columns: `id` (auto-increment integer PK), `routine_item_id` (integer FK → `routine_items.id`, not null), `log_date` (text, not null — `YYYY-MM-DD`), `status` (text enum: `done` | `skipped`, not null), `value_weight` (real, nullable — kg), `value_length` (real, nullable — cm), `value_duration` (real, nullable — minutes), `value_sets` (integer, nullable), `value_reps` (integer, nullable), `created_at` (integer timestamp)
- [ ] FK `routine_item_id` references `routine_items.id` with cascade delete
- [ ] Unique constraint on (`routine_item_id`, `log_date`) — one log per item per day

### ID and date conventions (per architecture conventions)
- [ ] All PKs are auto-increment integers — no UUIDs anywhere in the schema
- [ ] Calendar dates (`start_date`, `end_date`, `log_date`) are stored as `text` in `YYYY-MM-DD` format
- [ ] Event timestamps (`logged_at`, `created_at`) are stored as `integer` with `mode: 'timestamp'`
- [ ] JSON columns use `text({ mode: 'json' }).$type<T>()` — no `blob` type used anywhere

### Relation definitions
- [ ] `mesocycles` → `workout_templates` (one-to-many)
- [ ] `mesocycles` → `weekly_schedule` (one-to-many)
- [ ] `mesocycles` → `routine_items` (one-to-many, optional)
- [ ] `workout_templates` → `exercise_slots` (one-to-many)
- [ ] `exercises` → `exercise_slots` (one-to-many)
- [ ] `weekly_schedule` → `workout_templates` (many-to-one)
- [ ] `logged_workouts` → `logged_exercises` (one-to-many)
- [ ] `logged_exercises` → `logged_sets` (one-to-many)
- [ ] `routine_items` → `routine_logs` (one-to-many)

## Edge Cases

- Running `drizzle-kit migrate` on a fresh database creates all tables in the correct dependency order (no FK violation during creation)
- Running `drizzle-kit migrate` on an already-migrated database produces no error and makes no changes
- `DATABASE_URL` env var missing or pointing to an unwritable path causes a clear startup error, not a silent failure
- `foreign_keys=ON` PRAGMA means inserting an `exercise_slot` with a non-existent `exercise_id` raises a constraint error
- `foreign_keys=ON` PRAGMA means inserting a `weekly_schedule` row with a non-existent `mesocycle_id` raises a constraint error
- Cascade delete on `workout_templates` → `exercise_slots`: deleting a template removes its slots
- Cascade delete on `mesocycles` → `workout_templates`: deleting a mesocycle removes its templates (and transitively their slots)
- `logged_workouts.template_snapshot` must be valid JSON — malformed JSON at insert time is a schema-level type error caught by Drizzle's `.$type<T>()` annotation
- `weekly_schedule` unique constraint prevents duplicate day assignments (same mesocycle + day + week_type)
- `exercises.name` unique constraint prevents duplicate exercise names at the DB level

## Test Requirements

- **Integration — PRAGMA verification**: connect to a test database and assert all 4 PRAGMAs return expected values after init
- **Integration — WAL mode**: assert `PRAGMA journal_mode` returns `wal` after connection
- **Integration — FK enforcement**: attempt to insert an `exercise_slot` with a non-existent `exercise_id`; assert SQLite raises a foreign key constraint error
- **Integration — cascade delete**: insert a mesocycle with a template and slot; delete the mesocycle; assert template and slot rows are gone
- **Integration — unique constraint on exercises.name**: insert two exercises with the same name; assert the second insert fails
- **Integration — unique constraint on weekly_schedule**: insert two rows with the same `(mesocycle_id, day_of_week, week_type)`; assert the second insert fails
- **Integration — migration idempotency**: run migrate twice against the same database; assert no error and no duplicate tables
- **Integration — date storage**: insert a mesocycle with `start_date = '2026-03-15'`; read it back; assert the value is the string `'2026-03-15'`, not a numeric timestamp
- **Integration — timestamp storage**: insert a `logged_workout` with `logged_at = new Date()`; read it back; assert the value is a JavaScript `Date` object (integer mode round-trip)
- **Integration — JSON snapshot**: insert a `logged_workout` with a `template_snapshot` object including `version: 1`; read it back; assert the object is correctly deserialized with the `version` field intact
