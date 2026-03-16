# Rest Day Display
**Status:** done
**Epic:** Today's Workout
**Depends:** specs/view-todays-planned-workout.md, specs/daily-routine-check-off.md

## Description
As an athlete, on rest days I can see a "Rest Day" message alongside today's active daily routines, so the app is useful every day even when no workout is planned.

## Acceptance Criteria

### Rest Day Detection
- [ ] A rest day is determined by `GET /api/today` returning `type: rest_day` — i.e. an active mesocycle exists but no `weekly_schedule` row is assigned for today's `day_of_week` + resolved variant (`normal` | `deload`)
- [ ] The no-active-mesocycle state is distinct from a rest day: if there is no active mesocycle, the app shows the no-active-mesocycle state (not "Rest Day")
- [ ] Deload week rest days are detected using the same variant logic as the main workout lookup (ADR-003): if today is in the deload week, the deload schedule is checked; if no deload schedule row exists for today, it is a rest day

### Rest Day UI
- [ ] The page displays a clear "Rest Day" heading or label
- [ ] No workout targets, exercise lists, or logging prompts are shown
- [ ] Today's active daily routines are displayed below the "Rest Day" indicator, using the same scope-filtering logic as the Daily Routine Check-off (specs/daily-routine-check-off.md)
- [ ] The daily routines section on a rest day is fully functional: athlete can fill in configured input fields (= done) or explicitly skip each routine
- [ ] If no routines are active today, the routines section shows an empty state (not hidden entirely)
- [ ] The view is optimized for mobile

### API
- [ ] `GET /api/today` returns `type: rest_day` for this state (no additional workout payload)
- [ ] Daily routine data for the rest day view is fetched using the same active-routine filtering logic (not a separate endpoint)

## Edge Cases
- Active mesocycle with `has_deload = false` and today has no schedule row: rest day (no deload variant to check)
- Active mesocycle in deload week and today has no deload schedule row: rest day (deload schedule is checked first per ADR-003)
- Rest day with no active routines: page shows "Rest Day" + empty routines state — not a blank page
- No active mesocycle: this is the no-active-mesocycle state, not a rest day — different message shown
- Athlete opens the app on a rest day after already completing all routines: routines show as completed (immutable), "Rest Day" still shown

## Test Requirements
- Unit: `GET /api/today` returns `type: rest_day` when active mesocycle has no schedule row for today + variant
- Unit: `GET /api/today` returns `type: no_active_mesocycle` (not `rest_day`) when no mesocycle is active
- Integration: rest day with active routines → routines are returned and check-off works
- Integration: rest day with no active routines → empty state returned, no error
- E2E (mobile viewport): rest day page shows "Rest Day" label and routine check-off section
- E2E: marking a routine done on a rest day → routine shows as completed
