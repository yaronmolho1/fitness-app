# Running Logging
**Status:** ready
**Epic:** Workout Logging
**Depends:** specs/view-todays-planned-workout.md, specs/running-templates.md

## Description
As an athlete, I can log actual distance, average pace, and average HR for all run types so that I have key performance data alongside Garmin's full metrics.

## Acceptance Criteria
- [ ] The running logging form is shown when today's workout modality is `running`; resistance and MMA/BJJ modalities use their own logging flows
- [ ] The logging form is accessible from the "View Today's Planned Workout" screen via a "Log Run" / "Start Workout" action
- [ ] The form displays the planned template details as read-only reference: run type, target pace, HR zone, coaching cues
- [ ] The form has an `actual_distance` field — a non-negative number (unit is display-only, no conversion in V1); optional
- [ ] The form has an `actual_avg_pace` field — a free-text field (e.g. "5:45/km"); optional; no format validation in V1
- [ ] The form has an `actual_avg_hr` field — a positive integer (beats per minute); optional
- [ ] The three fields (`actual_distance`, `actual_avg_pace`, `actual_avg_hr`) apply to all run types: `easy`, `tempo`, `long`, `race`, and `interval`
- [ ] For `run_type = interval`, the interval-specific logging section (per-rep data) is shown in addition to the overall fields — handled by the Interval Logging story
- [ ] For non-interval run types (`easy`, `tempo`, `long`, `race`), no per-interval section is shown
- [ ] The overall fields (`actual_distance`, `actual_avg_pace`, `actual_avg_hr`) are stored on the `logged_workouts` row at save time
- [ ] The `template_snapshot` JSON on `logged_workouts` captures the full running template state at log time, including `run_type`, `target_pace`, `hr_zone`, `interval_count`, `interval_rest`, `coaching_cues` — per ADR-005
- [ ] The `template_snapshot` JSON includes `version: 1` — per ADR-005
- [ ] `canonical_name` is copied from `workout_templates.canonical_name` to `logged_workouts.canonical_name` at log time — per ADR-006
- [ ] The save creates `logged_workouts` atomically; running workouts do not create `logged_exercises` or `logged_sets` rows (those are resistance-only normalized tables)
- [ ] After save, no UPDATE or DELETE is performed on the `logged_workouts` row — per immutability rules
- [ ] The logging form is not shown if today's run is already logged (handled by Already-Logged Summary story)
- [ ] All mutations are performed via Server Actions — per ADR-004

## Edge Cases
- `actual_distance` negative — rejected
- `actual_avg_hr` of 0 or negative — rejected; must be a positive integer when provided
- `actual_avg_pace` with arbitrary text (no format enforcement in V1) — stored as-is
- All three fields left blank — allowed; save succeeds with all actuals as null (athlete may just want to note the run happened)
- `run_type = interval` — overall fields are still present and saved; interval-specific data is handled by Interval Logging story
- Template has no `target_pace` or `hr_zone` set — planned reference section shows those fields as blank; form still renders correctly

## Test Requirements
- Unit: `actual_distance` must be non-negative when provided
- Unit: `actual_avg_hr` must be a positive integer when provided; null is valid
- Unit: `template_snapshot` for running workout includes `version: 1` and all running template fields
- Unit: `canonical_name` copied from template to `logged_workouts` at save time
- Integration: save easy run with all three actuals → `logged_workouts` row has correct values; no `logged_exercises` or `logged_sets` rows created
- Integration: save run with all actuals blank → save succeeds; actuals stored as null
- Integration: save interval run → overall fields saved on `logged_workouts`; interval data handled per Interval Logging spec
- E2E: open today's running workout, enter distance and pace, save, verify completion summary shown and values persisted
