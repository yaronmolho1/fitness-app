# Exercise Progression Chart
**Status:** ready
**Epic:** Calendar & Progression
**Depends:** specs/log-immutability.md

## Description
As a coach, I can select an exercise and see a chart of planned vs actual weight and volume across mesocycles so that I can make informed programming decisions.

## Acceptance Criteria
- [ ] `GET /api/progression` Route Handler returns progression data for a given exercise — per ADR-004
- [ ] The endpoint accepts a `canonical_name` query parameter identifying which exercise template to chart
- [ ] The endpoint accepts an optional `exercise_id` query parameter to filter by a specific exercise within the template (for resistance templates with multiple slots)
- [ ] The response includes a time-ordered series of data points, one per logged workout session that contains the specified exercise
- [ ] Each data point includes: date (`YYYY-MM-DD`), mesocycle id, mesocycle name, planned weight (from `exercise_slots` targets at log time), actual weight (from `logged_sets`), planned volume (sets × reps × weight from targets), actual volume (sets × reps × weight from actuals)
- [ ] Cross-phase linking uses `canonical_name` to match `logged_workouts.canonical_name` across all mesocycles — per ADR-006
- [ ] Actual data is queried from `logged_exercises` and `logged_sets` (normalized tables) — per ADR-005
- [ ] Planned data is read from the `template_snapshot` stored on `logged_workouts` (not the live template) so planned targets reflect what was planned at log time
- [ ] Volume is calculated as: total sets × average reps × average weight for that session
- [ ] The chart renders two data series: "Planned" and "Actual"
- [ ] The time axis is the workout date, ordered chronologically
- [ ] The weight axis shows the top-set weight (heaviest set) for both planned and actual series
- [ ] A secondary or toggle view shows volume (sets × reps × weight) for both planned and actual series
- [ ] The exercise selector allows the coach to choose any exercise from the library
- [ ] After selecting an exercise, the chart updates to show that exercise's progression data
- [ ] If no logged data exists for the selected exercise, the chart shows an empty state message
- [ ] Data points from different mesocycles are visually distinguishable on the chart (e.g. color segments or phase labels)

## Edge Cases
- Exercise with no logged history: chart shows empty state, no error
- Exercise logged in only one mesocycle: chart shows single-phase data without phase boundary markers (those are a separate story)
- Exercise where `canonical_name` matches templates in multiple mesocycles: all matching logged sessions are included in the time series
- Session where planned weight is null (no target set): planned data point is null/omitted for that session; actual data point still shown
- Session where actual weight differs significantly from planned: both data points plotted; no clamping or filtering
- Exercise with sets of varying weights in one session: top-set weight used for the weight series; total volume used for the volume series
- `canonical_name` that matches no templates or logs: empty state returned

## Test Requirements
- Unit: volume calculation — sets × reps × weight aggregated correctly per session
- Unit: top-set weight extraction — heaviest set selected from a session's `logged_sets`
- Unit: cross-phase linking — `canonical_name` query returns data from all matching mesocycles
- Unit: planned data read from `template_snapshot`, not live `exercise_slots`
- Integration: `GET /api/progression?canonical_name=push-a` returns time-ordered data points with planned and actual fields
- Integration: exercise with no logs returns empty data array (not an error)
- Integration: data points span multiple mesocycles when `canonical_name` matches across phases
- E2E: select exercise → chart renders with planned and actual series
- E2E: exercise with no history → empty state message shown
