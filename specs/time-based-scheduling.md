---
status: in-progress
epic: time-scheduling-gcal
depends: [specs/7-day-assignment-grid.md, specs/workout-time-slots.md]
supersedes: specs/workout-time-slots.md (partially — replaces period-first model with time-first)
---

# Time-Based Workout Scheduling

## Description

Replace the period-based scheduling model (morning/afternoon/evening, max 3 per day) with time-based scheduling. Every schedule entry requires a specific start time (HH:MM) and duration (minutes). The period becomes a derived display value. Unlimited workouts per day. Actions switch from composite key identification to row ID.

## Acceptance Criteria

1. **Given** a user assigning a template to a day, **When** they submit the assignment, **Then** a start time (HH:MM, 24h format) and duration (minutes) are required fields.

2. **Given** a start time is entered, **When** the assignment is saved, **Then** the period column is auto-derived: hour < 12 = morning, 12-16 = afternoon, 17+ = evening.

3. **Given** a template with an existing duration field (running: target_duration, MMA: planned_duration), **When** the user opens the assignment form, **Then** the duration input is pre-filled from the template's duration.

4. **Given** a resistance template with no duration field, **When** the user opens the assignment form, **Then** the duration input defaults to 90 minutes.

5. **Given** a day already has N workouts assigned, **When** the user adds another workout at any time, **Then** the assignment succeeds regardless of how many workouts exist on that day.

6. **Given** two different templates, **When** assigned to the same day and same start time, **Then** both assignments are saved (overlapping times allowed).

7. **Given** the same template already assigned to the same day and time, **When** the user tries to assign it again, **Then** the existing entry is updated (upsert on unique constraint).

8. **Given** a new assignment overlaps an existing entry's time range (start to start+duration), **When** the form is submitted, **Then** a non-blocking warning is shown but the assignment proceeds.

9. **Given** any schedule entry, **When** it is removed, **Then** the action accepts the entry's row ID (not a composite key of mesocycle/day/period).

10. **Given** a mesocycle is cloned, **When** schedule entries are copied, **Then** the time_slot and duration values are preserved on all cloned entries.

11. **Given** a resistance template, **When** it is created or edited, **Then** an optional estimated_duration field (minutes) is available.

12. **Given** time_slot validation, **When** a value is submitted, **Then** it must match HH:MM format (00:00-23:59) or be rejected.

13. **Given** duration validation, **When** a value is submitted, **Then** it must be a positive integer (minutes) or be rejected.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Assignment at 23:30 with 90min duration (crosses midnight) | Allowed — duration can extend past midnight. End time wraps to next day conceptually. |
| Two workouts at same time with same template on same day | Blocked by unique constraint (mesocycle_id, day_of_week, week_type, time_slot, template_id) |
| Time entered as "7:00" instead of "07:00" | Rejected — strict HH:MM validation requires zero-padded hours |
| Duration of 0 minutes | Rejected — must be positive integer |
| Completed mesocycle | All assignment mutations rejected (existing guard) |
| Deload week assignment when has_deload is false | Rejected (existing guard) |

## Test Requirements

- AC1: Integration — assignment without time_slot or duration returns validation error
- AC2: Unit — `derivePeriod("06:30")` = morning, `derivePeriod("14:00")` = afternoon, `derivePeriod("19:00")` = evening
- AC5: Integration — assign 5+ workouts to the same day, all succeed
- AC6: Integration — two different templates at same time on same day, both saved
- AC7: Integration — same template at same time upserts, not duplicates
- AC8: Unit — overlap detection: `checkOverlap([{time_slot:"07:00",duration:90}], "08:00", 60)` = true
- AC9: Integration — removeAssignment by row ID succeeds
- AC10: Integration — clone preserves time_slot and duration on all entries
- AC12-13: Unit — validation rejects invalid time/duration formats

## Dependencies

- `specs/7-day-assignment-grid.md` — base grid spec; this extends the assignment model
- `specs/workout-time-slots.md` — superseded partially; period concept retained as derived only

## Out of Scope

- Drag-and-drop time adjustment in the grid
- Google Calendar sync (see `specs/google-calendar-sync.md`)
- Migration of existing data (see `specs/time-scheduling-migration.md`)
- Display changes to calendar/today views (see `specs/schedule-time-display.md`)

## Open Questions

- None
