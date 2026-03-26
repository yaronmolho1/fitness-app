# Schedule Week Overrides

## Description

Move a scheduled workout from one day/period to another for a specific week (or all remaining weeks) within a mesocycle. The source slot becomes empty; the target slot gains the workout. Supports undo.

## Acceptance Criteria

1. **Given** an active/planned mesocycle with a workout on Monday morning (week 3), **When** the user moves it to Wednesday evening for "this week only," **Then** week 3 Monday morning becomes rest and week 3 Wednesday evening shows the moved workout; all other weeks are unaffected.

2. **Given** the same setup, **When** the user moves with scope "remaining weeks," **Then** weeks 3 through the last week all reflect the move; weeks 1-2 are unaffected.

3. **Given** a day with two sessions (morning + evening), **When** the user moves only the morning workout, **Then** the evening workout remains on that day.

4. **Given** a target day that already has a morning workout, **When** the user moves a workout there and selects "afternoon," **Then** both workouts appear on the target day in their respective periods.

5. **Given** a completed mesocycle, **When** the user attempts to move a workout, **Then** the action is rejected with an error.

6. **Given** a workout that has already been logged for that date, **When** the user attempts to move it, **Then** the action is rejected ("Cannot move an already-logged workout").

7. **Given** a moved workout (override exists), **When** the user selects "Undo Move," **Then** the override rows are deleted and the base schedule reasserts for those slots.

8. **Given** a week with multiple moves, **When** the user selects "Reset Week," **Then** all overrides for that week are deleted, restoring the full base schedule.

9. **Given** a mesocycle with schedule overrides, **When** cloning it to a new phase, **Then** the overrides are NOT copied — the new mesocycle starts with the clean base schedule.

10. **Given** a moved workout on the today view, **When** `getTodayWorkout()` resolves the schedule, **Then** it returns the overridden template (not the base schedule template) for that day.

11. **Given** a moved workout, **When** the calendar projection renders the month, **Then** the moved workout appears on the target day and the source day shows as rest (or remaining sessions only).

12. **Given** a deload week with a workout, **When** the user moves it, **Then** the override resolves against the deload variant of the base schedule.

13. **Given** an override exists for a slot, **When** the day detail panel opens, **Then** an "Overridden" indicator is visible and an "Undo Move" action is available.

14. **Given** no available period on the target day (all three occupied), **When** the user tries to move there, **Then** the target day is disabled or an error is shown.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Move to same day, different period | Allowed — effectively changes the period for that week |
| Move to same day, same period | Rejected — no-op |
| Source slot already overridden by prior move | New move reads effective schedule (includes prior override), creates/updates override rows |
| `work_weeks` reduced after overrides exist | Overrides for weeks beyond new `work_weeks` are orphaned but harmless (no matching dates) |
| Target day is in a different week_type (normal day to deload day) | N/A — move is within same week, week_type is fixed per week_number |
| Multiple moves of same workout (A→B, then B→C) | Second move creates new override_group; undo of second restores B state, not original A |
| "Reset Week" after multiple moves | Deletes all overrides for that week; fully restores base schedule |
| Remaining weeks scope + some weeks already logged | Only creates overrides for weeks where this specific template is not yet logged; skips weeks with existing logs for the moved template |

## Test Requirements

- AC1-2: integration — moveWorkout action creates correct override rows for single/remaining scope
- AC3: integration — moving one period doesn't affect other periods on same day
- AC4: integration — target day can accumulate sessions across different periods
- AC5: integration — completed mesocycle guard rejects move
- AC6: integration — logged workout guard rejects move
- AC7-8: integration — undoScheduleMove / resetWeekSchedule delete correct rows
- AC9: integration — clone action does not copy schedule_week_overrides
- AC10: integration — getTodayWorkout returns overridden template
- AC11: integration — getCalendarProjection reflects overrides
- AC12: integration — deload week overrides resolve against deload base schedule
- AC13: component — day detail panel shows override indicator + undo action
- AC14: component — move modal disables fully-occupied target days

## Dependencies

- `specs/7-day-assignment-grid.md` — base schedule structure
- `specs/workout-time-slots.md` — period/time_slot on schedule entries
- `specs/normal-vs-deload-tabs.md` — week_type variants
- `specs/retroactive-workout-logging.md` — reserves "Move Workout" action slot
- `specs/view-todays-planned-workout.md` — getTodayWorkout lookup chain
- `specs/projected-calendar.md` — calendar projection logic
- `specs/day-detail-drill-in.md` — day detail panel UI

## Out of Scope

- Swap workouts between two days (move only, no swap)
- Cross-mesocycle moves
- Moving to a different week number (only within same week)
- Auto-suggesting reschedule based on conflicts
- Bulk schedule editor / drag-and-drop

## Open Questions

_(resolved)_

- **Remaining weeks + logged weeks**: Skip only if *this specific template* is already logged on the source day for that week. Other workouts on the source day are irrelevant.
- **Time slot on target**: Pre-fill with source time_slot, let user change in modal.
