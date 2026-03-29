---
status: ready
epic: time-scheduling-gcal
depends: [specs/time-based-scheduling.md, specs/schedule-week-overrides.md]
---

# Move Workout — Time-Aware

## Description

Update the move workout flow to work with specific start times and durations instead of period-based source/target identification. The move modal collects a target time and duration instead of a target period radio.

## Acceptance Criteria

1. **Given** a scheduled workout, **When** the user initiates a move, **Then** the source workout is identified by its row ID (not by day + period composite key).

2. **Given** the move modal is opened, **When** it renders, **Then** it shows a target day selector, a time input (HH:MM), and a duration input (minutes).

3. **Given** the move modal is opened, **When** the target time input renders, **Then** it is pre-filled with the source workout's start time.

4. **Given** the move modal is opened, **When** the target duration input renders, **Then** it is pre-filled with the source workout's duration.

5. **Given** a target day and time are selected, **When** the move is submitted, **Then** a schedule override is created: source entry nulled out, target entry placed with the specified time and duration.

6. **Given** a "this week" scoped move, **When** the override is created, **Then** the override row stores the target time_slot and duration.

7. **Given** a "remaining weeks" scoped move, **When** the overrides are created, **Then** each affected week gets override rows with the target time_slot and duration.

8. **Given** the target time overlaps an existing workout's time range on the target day, **When** the move is submitted, **Then** a non-blocking warning is shown but the move proceeds.

9. **Given** a move is undone, **When** the override group is deleted, **Then** the base schedule reasserts with its original time_slot and duration.

10. **Given** "Reset Week" is triggered, **When** all overrides for the week are deleted, **Then** the base schedule reasserts for all entries with their original times and durations.

11. **Given** the target day already has workouts, **When** the move modal renders, **Then** there is no "periods full" restriction — any number of workouts can coexist.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Move to same day, different time | Allowed — creates override with new time on same day |
| Move to same day, same time | Allowed but shows overlap warning (same template at same time would violate unique constraint) |
| Source workout already logged | Rejected for "this week" scope; skipped for "remaining weeks" scope (existing behavior) |
| Target time is empty/invalid | Validation rejects — time is required |
| Move workout that was itself an override | The override is replaced (upsert on unique index) |

## Test Requirements

- AC1: Integration — move action accepts schedule entry ID, not composite key
- AC2-4: E2E — modal renders with time/duration inputs pre-filled from source
- AC5: Integration — move creates override rows with time_slot and duration
- AC7: Integration — remaining_weeks scope creates overrides for each future week
- AC8: E2E — overlap warning shown but move proceeds
- AC9: Integration — undo restores original times
- AC11: E2E — no "periods full" restriction on target day

## Dependencies

- `specs/time-based-scheduling.md` — defines time-first model
- `specs/schedule-week-overrides.md` — base override spec; this extends source/target identification

## Out of Scope

- Drag-and-drop moves between days
- Google Calendar event updates on move (see `specs/google-calendar-sync.md`)
