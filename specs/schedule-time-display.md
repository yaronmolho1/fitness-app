---
status: ready
epic: time-scheduling-gcal
depends: [specs/time-based-scheduling.md, specs/projected-calendar.md, specs/calendar-multi-workout-display.md, specs/view-todays-planned-workout.md]
---

# Schedule Time Display

## Description

Update all schedule-facing views (calendar grid, day detail panel, today view, assignment grid) to show specific start times and durations instead of period labels. Sort workouts chronologically instead of by period order.

## Acceptance Criteria

### Calendar Grid

1. **Given** a projected workout with a start time, **When** rendered as a pill in the calendar month grid, **Then** the pill shows "HH:MM Template Name" (e.g., "07:00 Push A").

2. **Given** multiple workouts on the same day, **When** rendered in the calendar grid, **Then** pills are sorted chronologically by start time (earliest first).

### Day Detail Panel

3. **Given** a day with scheduled workouts, **When** the day detail panel is opened, **Then** each workout card shows start time and duration (e.g., "07:00 — 90 min").

4. **Given** a day with multiple workouts, **When** the day detail panel is opened, **Then** cards are sorted chronologically by start time.

### Today View

5. **Given** today has scheduled workouts, **When** the today view loads, **Then** each session shows its start time and duration alongside the template name.

6. **Given** multiple sessions today, **When** the today view loads, **Then** sessions are sorted chronologically by start time (not by period order).

7. **Given** a single session today, **When** the today view loads, **Then** the start time and duration are still shown (no special case hiding).

### Assignment Grid (Mesocycle Detail)

8. **Given** the schedule grid for a mesocycle, **When** displaying assigned workouts in day cells, **Then** each entry shows "HH:MM Template Name (Xmin)" and entries are sorted chronologically.

9. **Given** a day with workouts in multiple periods, **When** displayed in the assignment grid, **Then** entries are visually grouped by derived period (morning/afternoon/evening section headers) with times shown within each group.

### API Responses

10. **Given** `GET /api/today`, **When** returning multiple sessions, **Then** results are sorted by `time_slot` ascending (chronological), not by period order.

11. **Given** `GET /api/calendar`, **When** returning projected days, **Then** each workout entry includes `time_slot` (HH:MM) and `duration` (minutes) fields.

12. **Given** `GET /api/calendar/day`, **When** returning day detail, **Then** each workout entry includes `time_slot` and `duration`.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Two workouts at the same start time | Both shown, sorted by template name as tiebreaker |
| Workout crosses midnight (23:30, 90min) | Duration displayed as-is; no special midnight handling in display |
| Legacy entry with no duration (pre-migration) | Should not occur after migration; if somehow present, display time without duration |

## Test Requirements

- AC1: E2E — calendar grid pill shows time prefix
- AC2: Integration — API returns calendar entries sorted by time_slot
- AC5-6: E2E — today view shows times, sorted chronologically
- AC8-9: E2E — schedule grid shows times with period grouping
- AC10: Integration — `/api/today` response sorted by time_slot ascending
- AC11-12: Integration — calendar APIs include time_slot and duration in response

## Dependencies

- `specs/time-based-scheduling.md` — defines the time_slot and duration fields
- `specs/projected-calendar.md` — base calendar projection spec
- `specs/calendar-multi-workout-display.md` — multi-workout day display
- `specs/view-todays-planned-workout.md` — today view base spec

## Out of Scope

- Assignment/editing UI (see `specs/time-based-scheduling.md`)
- Move modal changes (see `specs/move-workout-time-aware.md`)
- Google Calendar event display (see `specs/google-calendar-sync.md`)
