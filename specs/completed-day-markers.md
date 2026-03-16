# Completed Day Markers
**Status:** done
**Epic:** Calendar & Progression
**Depends:** specs/projected-calendar.md, specs/log-immutability.md

## Description
As a coach, I can see logged days marked as completed versus still-projected on the calendar so that I can see adherence at a glance.

## Acceptance Criteria
- [ ] The `GET /api/calendar` response includes a `status` field on each day entry with one of three values: `'completed'`, `'projected'`, or `'rest'`
- [ ] A day is `'completed'` when a `logged_workouts` row exists with a `logged_at` date matching that calendar date
- [ ] A day is `'projected'` when a template is assigned for that day via `weekly_schedule` but no matching `logged_workouts` row exists
- [ ] A day is `'rest'` when no template is assigned for that day (no `weekly_schedule` row for that `day_of_week`)
- [ ] The calendar query checks `logged_workouts` by date (using the `text` calendar date stored on `logged_workouts`, not timestamp comparison) to determine completion status
- [ ] Completed days are rendered with a distinct visual marker (e.g. checkmark, filled indicator, or distinct background) that differs from projected days
- [ ] Projected days are rendered in their normal modality color without the completed marker
- [ ] Rest days are rendered without a completed marker
- [ ] The completed marker is visible alongside the modality color coding — both pieces of information are shown simultaneously
- [ ] Past days with no log entry (missed workouts) are rendered as projected (not completed), making missed days visible
- [ ] Future days are always projected (cannot be completed before they occur)

## Edge Cases
- A day in the past with a template assigned but no log entry: rendered as `'projected'` (missed workout — adherence gap visible)
- A rest day with no template: rendered as `'rest'` regardless of whether any log exists for that date
- Today's date: if logged, `'completed'`; if not yet logged, `'projected'` (if a workout is scheduled) or `'rest'`
- Multiple `logged_workouts` rows for the same date (should not occur given immutability, but if present): day is still `'completed'`
- A logged workout date that falls outside any mesocycle range: does not affect the calendar projection for that date (rest day stays rest)

## Test Requirements
- Unit: day with matching `logged_workouts` row → status `'completed'`
- Unit: day with template assigned but no log → status `'projected'`
- Unit: day with no template assigned → status `'rest'`
- Unit: past day with template but no log → status `'projected'` (not `'rest'`)
- Integration: `GET /api/calendar` response includes correct `status` values after logging a workout
- Integration: logging a workout for a date changes that date's status from `'projected'` to `'completed'` in subsequent calendar responses
- E2E: completed days display the completed marker; projected days do not
