# Deload Week Distinction
**Status:** done
**Epic:** Calendar & Progression
**Depends:** specs/projected-calendar.md, specs/normal-vs-deload-tabs.md

## Description
As a coach, I can see deload weeks visually distinct from work weeks on the calendar so that the phase structure is obvious at a glance.

## Acceptance Criteria
- [ ] The calendar projection identifies which week(s) within a mesocycle are deload weeks — per ADR-003
- [ ] A week is a deload week when: the mesocycle has `has_deload=true` AND the week is the last week of the mesocycle (computed from `start_date` + `work_weeks`)
- [ ] Deload week identification is computed by week offset from mesocycle `start_date`: week N = deload when N equals `work_weeks + 1` (the final week)
- [ ] The `GET /api/calendar` response includes an `is_deload` boolean field on each day entry
- [ ] Days within a deload week have `is_deload=true`; all other days have `is_deload=false`
- [ ] Deload week days are rendered with a visually distinct background or border treatment compared to normal work week days
- [ ] The deload visual treatment applies to the entire week row (all 7 days of the deload week), not just days with assigned workouts
- [ ] The deload visual treatment is distinct from the rest-day state and from the modality color coding
- [ ] A legend or label identifies the deload visual treatment so the distinction is unambiguous
- [ ] Mesocycles with `has_deload=false` have no deload week; no days in those mesocycles are marked `is_deload=true`
- [ ] When a deload week spans a month boundary, days in the deload week are correctly marked in both months

## Edge Cases
- Mesocycle with `has_deload=false`: no days marked as deload; deload visual treatment never appears for that mesocycle
- Mesocycle with `has_deload=true` and `work_weeks=1`: the single work week is week 1 (normal); week 2 is the deload week
- Deload week that spans two calendar months: days in each month are correctly marked `is_deload=true`
- Month view showing only the deload week of a mesocycle (start of month falls in deload week): all visible days of that mesocycle are deload
- Month view showing only normal weeks of a mesocycle: no deload days visible

## Test Requirements
- Unit: deload week offset calculation — given `start_date` and `work_weeks`, correctly identifies which dates fall in the deload week
- Unit: `has_deload=false` → no days marked `is_deload=true`
- Unit: `has_deload=true`, `work_weeks=4` → week 5 dates are `is_deload=true`, weeks 1–4 are `is_deload=false`
- Unit: deload week spanning month boundary → days in both months correctly flagged
- Integration: `GET /api/calendar` response includes `is_deload` field on each day entry with correct values
- E2E: deload week days render with distinct visual treatment; normal week days do not
