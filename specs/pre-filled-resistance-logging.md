# Pre-filled Resistance Logging
**Status:** ready
**Epic:** Workout Logging
**Depends:** specs/view-todays-planned-workout.md, specs/exercise-slots.md

## Description
As an athlete, I can open today's resistance workout and see every set pre-filled with the planned weight and reps from the template so that I only tap to change what differs from the plan.

## Acceptance Criteria
- [ ] The logging form is accessible from the "View Today's Planned Workout" screen via a "Start Workout" / "Log Workout" action
- [ ] The logging form is only shown when today's workout modality is `resistance`; running and MMA/BJJ modalities use their own logging flows
- [ ] The form is structured as a list of exercises in the same `sort_order` as the template's exercise slots
- [ ] Each exercise section displays the exercise name and, if marked, its main/complementary designation. Note: `is_main` field available on slots — use for visual distinction (T030 deferred UI here)
- [ ] Each exercise section contains one row per planned set, derived from `exercise_slots.target_sets`
- [ ] Each set row is pre-filled with `target_weight` from the corresponding `exercise_slot` (may be null/empty if not set on the slot)
- [ ] Each set row is pre-filled with `target_reps` from the corresponding `exercise_slot`
- [ ] Pre-filled values are editable — the athlete can change weight, reps, or RPE before saving
- [ ] The number of pre-filled set rows per exercise equals `exercise_slots.target_sets`
- [ ] The form is mobile-first: large tap targets, numeric keyboards for weight/reps/RPE inputs, minimal scrolling required
- [ ] The overall logging flow targets completion in under 2 minutes for a typical resistance session
- [ ] A "Save Workout" action is visible and accessible without excessive scrolling (e.g. sticky footer or prominent placement)
- [ ] The form does not auto-save; the athlete explicitly submits via "Save Workout"
- [ ] Before the form is submitted, no log records are created in the database
- [ ] The logging form is not shown if today's workout is already logged (handled by Already-Logged Summary story)
- [ ] All mutations (save workout) are performed via Server Actions — per ADR-004

## Edge Cases
- Exercise slot has `target_weight = null` — weight field renders empty/blank, not zero
- Exercise slot has `target_reps` set but `target_weight` not set — reps pre-filled, weight blank
- Template has no exercise slots — logging form shows empty state; athlete can still save with rating/notes only
- Today's workout template has been edited since the schedule was last viewed — the logging form reflects the current template state at the time the form is opened (snapshot is taken at save time, not at form-open time)
- Athlete navigates away from the logging form without saving — no partial log is created; form state is lost (no draft persistence in V1)
- Multiple exercise slots for the same exercise (e.g. two squat variations) — each slot renders as a separate exercise section with its own set rows

## Test Requirements
- Unit: pre-fill logic maps `exercise_slot.target_sets` → correct number of set rows, `target_weight` and `target_reps` → correct pre-filled values
- Unit: null `target_weight` on slot → weight field is empty, not zero
- Integration: open logging form for a resistance workout → all exercises appear in sort_order with correct pre-filled values
- Integration: template with 3 exercises × 4 sets each → form renders 3 sections with 4 rows each
- E2E: open today's resistance workout, verify pre-filled values match template targets, verify form is usable on mobile viewport
