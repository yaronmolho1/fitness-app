---
status: ready
epic: time-scheduling-gcal
depends: [specs/time-based-scheduling.md, specs/db-schema-migrations.md]
---

# Time Scheduling — Data Migration

## Description

Migrate existing schedule entries from the period-based model (optional time_slot, no duration) to the time-first model (required time_slot, required duration). Backfill defaults from period and template modality. Enforce NOT NULL constraints after backfill. Create new tables for Google Calendar integration.

## Acceptance Criteria

### Backfill — Time Slots

1. **Given** existing `weekly_schedule` entries with period = 'morning' and null time_slot, **When** the migration runs, **Then** time_slot is set to '07:00'.

2. **Given** existing entries with period = 'afternoon' and null time_slot, **When** the migration runs, **Then** time_slot is set to '13:00'.

3. **Given** existing entries with period = 'evening' and null time_slot, **When** the migration runs, **Then** time_slot is set to '18:00'.

4. **Given** existing entries that already have a non-null time_slot, **When** the migration runs, **Then** the existing time_slot value is preserved.

5. **Given** existing `schedule_week_overrides` entries, **When** the migration runs, **Then** the same time_slot backfill rules (AC1-4) apply.

### Backfill — Duration

6. **Given** a schedule entry linked to a resistance template (or null template), **When** the migration runs, **Then** duration is set to 90 minutes.

7. **Given** a schedule entry linked to a running template, **When** the migration runs, **Then** duration is set to the template's target_duration, or 60 minutes if target_duration is null.

8. **Given** a schedule entry linked to an MMA template, **When** the migration runs, **Then** duration is set to the template's planned_duration, or 90 minutes if planned_duration is null.

9. **Given** a schedule entry linked to a mixed template, **When** the migration runs, **Then** duration is set to 90 minutes.

10. **Given** existing `schedule_week_overrides` entries, **When** the migration runs, **Then** the same duration backfill rules (AC6-9) apply.

### Constraint Enforcement

11. **Given** all entries have been backfilled, **When** the constraint phase runs, **Then** `time_slot` becomes NOT NULL on both `weekly_schedule` and `schedule_week_overrides`.

12. **Given** all entries have been backfilled, **When** the constraint phase runs, **Then** `duration` becomes NOT NULL on both tables.

13. **Given** constraint enforcement, **When** the old unique index is dropped, **Then** the new unique index `(mesocycle_id, day_of_week, week_type, time_slot, template_id)` is created on `weekly_schedule`.

14. **Given** constraint enforcement, **When** the old unique index is dropped, **Then** the new unique index `(mesocycle_id, week_number, day_of_week, time_slot, template_id)` is created on `schedule_week_overrides`.

### New Schema

15. **Given** the migration runs, **When** the new tables phase executes, **Then** the `google_credentials` table is created.

16. **Given** the migration runs, **When** the new tables phase executes, **Then** the `google_calendar_events` table is created with proper foreign keys and unique indexes.

17. **Given** the migration runs, **When** the new columns phase executes, **Then** `workout_templates` gains an `estimated_duration` (integer, nullable) column.

18. **Given** the migration runs, **When** the new columns phase executes, **Then** `athlete_profile` gains a `timezone` (text, default 'UTC') column.

### Migration Integrity

19. **Given** the migration runs, **When** it completes, **Then** no existing schedule data is lost — row count before and after matches.

20. **Given** the migration runs, **When** it completes, **Then** no existing schedule entry has a null time_slot or null duration.

21. **Given** the migration is generated, **When** it is applied, **Then** it uses `drizzle-kit generate` + `drizzle-kit migrate` (not `push`).

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Schedule entry with null template_id (rest day placeholder) | Backfill duration to 60 minutes (default); time_slot backfilled from period as usual |
| Multiple entries on same day with same period (shouldn't exist under old constraint but defensive) | Each gets the same default time; new unique constraint may conflict — migration should handle or warn |
| Entry with time_slot already set but no matching period (data inconsistency) | Keep existing time_slot; re-derive period from time_slot value |
| Empty database (no schedule entries) | Migration succeeds — only schema changes, no data to backfill |
| Database with only override entries, no base schedule | Override backfill runs independently — same rules apply |

## Test Requirements

- AC1-5: Integration — backfill produces correct time_slots for each period
- AC6-10: Integration — backfill produces correct durations by modality
- AC11-14: Integration — NOT NULL constraints and new indexes enforced after backfill
- AC15-18: Integration — new tables and columns created
- AC19-20: Integration — row count preserved; no nulls remain

## Dependencies

- `specs/time-based-scheduling.md` — defines the target schema
- `specs/db-schema-migrations.md` — migration conventions (drizzle-kit generate + migrate)

## Out of Scope

- Backfilling Google Calendar events for existing mesocycles (only new/modified schedules sync)
- UI changes (see `specs/time-based-scheduling.md`, `specs/schedule-time-display.md`)
- Rollback migration (one-way — period data is preserved in the column)
