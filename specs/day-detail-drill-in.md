# Day Detail Drill-in
**Status:** ready
**Epic:** Calendar & Progression
**Depends:** specs/projected-calendar.md

## Description
As a coach, I can click any calendar day to see the full workout detail (exercises, targets, and logged actuals if completed) inline so that I can drill in without navigating away.

## Acceptance Criteria
- [ ] Clicking any calendar day opens a detail panel or modal inline — no full-page navigation
- [ ] The detail view is dismissible (close button or click-outside) and returns to the calendar without a page reload
- [ ] For a **projected** day with a resistance template: the detail shows the template name, modality, and all exercise slots with their targets (exercise name, sets, reps, weight, RPE, rest period, guidelines)
- [ ] For a **projected** day with a running template: the detail shows the template name, modality, and run-specific fields (run type, target pace, HR zone, interval count/rest, coaching cues)
- [ ] For a **projected** day with an MMA/BJJ template: the detail shows the template name, modality, and session fields (duration, occurrence)
- [ ] For a **completed** day: the detail shows both the planned targets (from `template_snapshot` on `logged_workouts`) and the logged actuals (from `logged_exercises` and `logged_sets`)
- [ ] For a **completed** resistance day: logged actuals include actual reps, weight, and RPE per set alongside the planned targets
- [ ] For a **completed** day: the workout rating (1–5) and notes are displayed if present
- [ ] For a **rest** day: the detail shows a "Rest Day" message with no workout content
- [ ] The planned data for a projected day is read from the live `workout_templates` and `exercise_slots` tables
- [ ] The planned data for a completed day is read from `template_snapshot` on `logged_workouts` (immutable, per ADR-005) — not from the live template
- [ ] Exercise slots in the detail are displayed in their defined order
- [ ] Main vs complementary marking is visible in the detail view for resistance exercises

## Edge Cases
- Clicking a rest day: detail shows "Rest Day" with no workout content
- Clicking a completed day whose template has since been edited: planned data shown is the snapshot at log time (not the current template state)
- Clicking a projected day in a mesocycle whose template has been deleted: detail shows an error or empty state gracefully
- Clicking a day outside any mesocycle range: treated as rest day
- Detail opened for a day with a deload schedule: shows the deload template's content, not the normal template

## Test Requirements
- Unit: projected resistance day → detail includes exercise slots with targets from live template
- Unit: completed day → detail reads planned data from `template_snapshot`, not live template
- Unit: rest day → detail returns rest day state
- Integration: completed day detail shows both planned targets and logged actuals
- Integration: completed day with edited template → snapshot data shown, not current template
- E2E: click projected day → inline detail opens with exercise targets; dismiss → calendar still visible
- E2E: click completed day → inline detail shows planned + actual data side by side
- E2E: click rest day → inline detail shows rest day message
