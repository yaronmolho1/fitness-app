# MMA/BJJ Logging
**Status:** ready
**Epic:** Workout Logging
**Depends:** specs/view-todays-planned-workout.md, specs/mma-bjj-template-support.md

## Description
As an athlete, I can log duration, feeling, and notes for combat sessions so that I track training load without technique detail.

## Acceptance Criteria
- [ ] The MMA/BJJ logging form is shown when today's workout modality is `mma`; resistance and running modalities use their own logging flows
- [ ] The logging form is accessible from the "View Today's Planned Workout" screen via a "Log Session" / "Start Workout" action
- [ ] The form displays the planned template details as read-only reference: template name and any planned duration
- [ ] The form has an `actual_duration_minutes` field — a positive integer (minutes); optional
- [ ] The form has a `feeling` field — an integer rating 1 through 5 inclusive; optional
- [ ] The form has a `notes` field — free-text; optional; no enforced length limit in V1
- [ ] All three fields are optional — the athlete can save with all fields blank (records that the session occurred)
- [ ] `actual_duration_minutes` is stored on the `logged_workouts` row at save time
- [ ] `feeling` is stored on the `logged_workouts` row at save time (null if not entered)
- [ ] `notes` is stored on the `logged_workouts` row at save time (null if not entered)
- [ ] The `template_snapshot` JSON on `logged_workouts` captures the full MMA/BJJ template state at log time — per ADR-005
- [ ] The `template_snapshot` JSON includes `version: 1` — per ADR-005
- [ ] `canonical_name` is copied from `workout_templates.canonical_name` to `logged_workouts.canonical_name` at log time — per ADR-006
- [ ] The save creates one `logged_workouts` row atomically; MMA/BJJ sessions do not create `logged_exercises` or `logged_sets` rows
- [ ] After save, the `logged_workouts` row is immutable — no UPDATE or DELETE is performed
- [ ] The logging form is not shown if today's session is already logged (handled by Already-Logged Summary story)
- [ ] All mutations are performed via Server Actions — per ADR-004

## Edge Cases
- `actual_duration_minutes` of 0 or negative — rejected; must be a positive integer when provided
- `feeling` outside 1–5 range — rejected with validation error
- `feeling` of null (not selected) — stored as null; not treated as 0
- Notes with only whitespace — stored as null
- All fields left blank — save succeeds; records that the session occurred with no detail
- Template has no planned duration set — form renders without a planned duration reference; `actual_duration_minutes` field still available

## Test Requirements
- Unit: `actual_duration_minutes` must be a positive integer when provided; null is valid; 0 and negative rejected
- Unit: `feeling` must be integer 1–5 when provided; null is valid; 0 and 6 rejected
- Unit: whitespace-only notes normalized to null before save
- Unit: `template_snapshot` includes `version: 1` and MMA/BJJ template fields
- Unit: `canonical_name` copied from template to `logged_workouts` at save time
- Integration: save MMA session with duration=90, feeling=4, notes text → `logged_workouts` row has correct values; no `logged_exercises` or `logged_sets` rows created
- Integration: save MMA session with all fields blank → save succeeds; actuals stored as null
- E2E: open today's MMA session, enter duration and feeling, save, verify completion summary shown and values persisted
