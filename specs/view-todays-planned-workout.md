# View Today's Planned Workout
**Status:** ready
**Epic:** Today's Workout
**Depends:** specs/7-day-assignment-grid.md, specs/mesocycle-status-management.md

## Description
As an athlete, I can open the app on my phone and immediately see today's planned workout with all targets, so I know exactly what I'm doing before I start training.

## Acceptance Criteria

### Lookup Chain
- [ ] The view is powered by `GET /api/today` (Route Handler per ADR-004)
- [ ] Lookup step 1: find the active mesocycle (status = `active`); if none exists, show the no-active-mesocycle state (see Edge Cases)
- [ ] Lookup step 2: determine today's `day_of_week` (e.g. `monday`)
- [ ] Lookup step 3: determine whether the current week is a deload week — compute week offset from mesocycle `start_date`; if the mesocycle has `has_deload = true` and the current week is the last week of the mesocycle, use the `deload` variant; otherwise use the `normal` variant (per ADR-003)
- [ ] Lookup step 4: query `weekly_schedule` for rows matching the active mesocycle, today's `day_of_week`, and the resolved variant (`normal` | `deload`)
- [ ] Lookup step 5: if no `weekly_schedule` row exists for today → rest day (see specs/rest-day-display.md)
- [ ] Lookup step 6: load the `workout_template` referenced by the matching `weekly_schedule` row, including all associated `exercise_slots` (for resistance) or modality-specific fields

### Resistance Workout Display
- [ ] Template name is shown prominently
- [ ] Each exercise slot is listed with: exercise name, sets target, reps target, weight target, RPE target (if set), rest period (if set), and text guidelines (if set)
- [ ] Main vs complementary marking is visually distinct (per the Main vs Complementary Marking story). Note: `is_main` field is available on exercise slots via `getTodayWorkout()` query — use it for badge/styling (T030 deferred UI here)
- [ ] Exercise slots are displayed in their defined order

### Running Workout Display
- [ ] Template name is shown
- [ ] Run type, target pace, HR zone, and coaching cues are displayed
- [ ] For interval sessions: interval count, interval distance/duration, and rest period are displayed
- [ ] For continuous sessions: total distance/duration target is displayed

### MMA/BJJ Workout Display
- [ ] Template name is shown
- [ ] Session duration target and any coaching notes are displayed

### Mobile-First Design
- [ ] The view is optimized for mobile viewports (primary use case per PRD)
- [ ] All workout targets are visible without horizontal scrolling
- [ ] Tap targets are large enough for post-exertion use
- [ ] The page loads and displays content without requiring additional navigation

### API Response
- [x] `GET /api/today` returns an array of resolved session data as JSON (supports multi-session days via T114)
- [x] Each element includes a `type` field: `workout` | `rest_day` | `no_active_mesocycle` | `already_logged`
- [x] Each element includes today's date in the payload
- [x] Workout and already_logged elements include `period` (morning/afternoon/evening) and optional `time_slot`
- [x] Results are sorted by period order (morning → afternoon → evening)

## Edge Cases
- No active mesocycle: `GET /api/today` returns `type: no_active_mesocycle`; UI shows a message indicating no active training phase (not an error state)
- Active mesocycle exists but today has no `weekly_schedule` row: returns `type: rest_day`
- Active mesocycle with `has_deload = false` and current week is the last week: treated as a normal week (no deload schedule exists)
- Mesocycle start date is in the future (status = `planned`): not treated as active; no-active-mesocycle state shown
- Multiple mesocycles with status = `active` should not be possible (enforced by Mesocycle Status Management story); if it occurs, behavior is undefined — document at implementation
- Today's workout is already logged: show the already-logged summary instead (see specs/already-logged-summary.md)

## Test Requirements
- Unit: deload week detection — given mesocycle start date and `has_deload`, correctly identify whether current week is deload
- Unit: `GET /api/today` returns `no_active_mesocycle` when no mesocycle has status = `active`
- Unit: `GET /api/today` returns `rest_day` when active mesocycle has no schedule row for today's day_of_week + variant
- Unit: `GET /api/today` returns `workout` with full template data when schedule row exists
- Unit: correct variant selected (normal vs deload) based on week offset
- Integration: full lookup chain — active mesocycle → day → variant → schedule → template → slots → JSON response
- Integration: resistance template response includes all exercise slot fields
- Integration: running template response includes modality-specific fields
- Integration: MMA/BJJ template response includes duration and notes fields
- E2E (mobile viewport): page loads and displays today's workout targets without horizontal scroll
