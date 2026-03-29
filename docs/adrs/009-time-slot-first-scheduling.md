# ADR-009: Time-Slot-First Scheduling (Replacing Period-Based Keying)

## Status
Accepted

## Context
The schedule model uses a 3-value `period` enum (morning/afternoon/evening) as the structural key in `weekly_schedule` and `schedule_week_overrides`. The unique constraint `(mesocycle_id, day_of_week, week_type, period)` limits workouts to 3 per day. All actions, overrides, and queries identify schedule entries by period. This prevents specific-hour scheduling and limits daily capacity. The app needs to support arbitrary start times, explicit durations, and unlimited workouts per day — prerequisites for Google Calendar integration.

## Options Considered
- **Option A — Promote `time_slot` to structural key, keep `period` as derived**: `time_slot` becomes NOT NULL and part of the unique constraint. `period` stays in the table as a computed grouping column (morning/afternoon/evening derived from hour). Actions switch from composite key `(mesocycle, day, weekType, period)` to row ID.
- **Option B — Drop `period` entirely, use `time_slot` only**: Remove the `period` column. Sort and group purely by time. Cleaner schema but requires updating every query and component that references period.
- **Option C — Keep period as primary, make `time_slot` required**: Period stays structural, time_slot becomes required alongside it. Still limited to 3 per day.

## Decision
Option A — `time_slot` becomes the structural field; `period` becomes derived.

## Rationale
Keeps backward compatibility with UI grouping (calendar pills, today view sections can still group by morning/afternoon/evening) while removing the 3-per-day structural constraint. Row-ID-based actions are simpler and unambiguous — no composite key matching needed. The `derivePeriod` function is trivial (hour < 12 = morning, 12-16 = afternoon, 17+ = evening) and already exists in the frontend as `derivePeriodFromTime()` in `components/schedule/period-selector.tsx`.

SQLite cannot `ALTER COLUMN` to add NOT NULL — the migration requires table recreation via Drizzle Kit's generated migrations, with a backfill step between phases.

## Consequences
- (+) Unlimited workouts per day at arbitrary times
- (+) Direct 1:1 mapping to calendar events (start time + duration)
- (+) Simpler action signatures (row ID instead of composite key)
- (+) Period grouping preserved for display without schema changes to downstream consumers
- (-) Two-phase migration needed (add nullable → backfill → enforce NOT NULL + new unique index)
- (-) All schedule actions, override actions, and queries need signature updates
- (-) Unique constraint now includes `template_id` to allow overlapping times for different templates — slightly weaker uniqueness guarantee
- (-) The derived `period` column is denormalized — must be kept in sync on every write

## Implementation Notes
- `derivePeriod(timeSlot: string): Period` — shared utility in `lib/schedule/time-utils.ts`, called on every insert/update
- New unique index: `(mesocycle_id, day_of_week, week_type, time_slot, template_id)`
- Backfill defaults: morning→07:00, afternoon→13:00, evening→18:00; duration by modality (resistance/MMA/mixed=90min, running=60min)
- `duration` column added to both schedule tables (integer, minutes, NOT NULL after backfill)
- `estimated_duration` added to `workout_templates` for resistance modality (running/MMA already have duration fields)
