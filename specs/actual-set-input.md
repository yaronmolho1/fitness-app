# Actual Set Input
**Status:** ready
**Epic:** Workout Logging
**Depends:** specs/pre-filled-resistance-logging.md

## Description
As an athlete, I can input actual reps, weight, and RPE per set so that my history reflects what I actually did rather than what was planned.

## Acceptance Criteria
- [ ] Each set row in the logging form has three editable fields: `actual_reps`, `actual_weight`, and `actual_rpe`
- [ ] `actual_reps` is a positive integer input; required before saving
- [ ] `actual_weight` is a non-negative number input (same unit convention as planning — no conversion in V1); optional
- [ ] `actual_rpe` is a number between 1 and 10 inclusive; optional
- [ ] `actual_reps` is pre-filled from `exercise_slot.target_reps` (editable by the athlete)
- [ ] `actual_weight` is pre-filled from `exercise_slot.target_weight` (editable by the athlete; blank if slot has no target weight)
- [ ] `actual_rpe` is not pre-filled — it starts empty; the athlete enters it after the set
- [ ] The planned values (`target_reps`, `target_weight`) are visually distinguishable from the actual input fields — the athlete can see what was planned while entering actuals
- [ ] Planned values are displayed as read-only reference; they are not editable from the logging form
- [ ] Each set row is independently editable — changing one set's values does not affect other sets
- [ ] Numeric keyboard is triggered for `actual_reps`, `actual_weight`, and `actual_rpe` inputs on mobile
- [ ] `actual_reps` and `actual_weight` values are stored on `logged_sets` rows at save time
- [ ] `actual_rpe` value is stored on `logged_sets` rows at save time (null if not entered)
- [ ] All set data is saved atomically as part of the workout save — per ADR-005 (snapshot + normalized rows in one transaction)
- [ ] All mutations are performed via Server Actions — per ADR-004

## Edge Cases
- `actual_reps = 0` or negative — rejected; must be a positive integer
- `actual_weight` negative — rejected
- `actual_rpe` outside 1–10 range — rejected
- `actual_rpe` left blank — stored as null; not an error
- `actual_weight` left blank — stored as null; not an error (athlete may do bodyweight sets)
- Athlete changes `actual_reps` to a value different from `target_reps` — allowed; the discrepancy is preserved in the log
- Athlete changes `actual_weight` to a value different from `target_weight` — allowed; the discrepancy is preserved in the log
- Set row with `actual_reps` missing at save time — save is blocked with a validation error indicating which set is incomplete

## Test Requirements
- Unit: `actual_reps` must be a positive integer; zero and negative values rejected
- Unit: `actual_weight` must be non-negative when provided
- Unit: `actual_rpe` must be between 1 and 10 inclusive when provided; null is valid
- Unit: `actual_rpe` is not pre-filled (starts empty/null)
- Integration: save workout with all actuals filled → `logged_sets` rows contain correct `actual_reps`, `actual_weight`, `actual_rpe` values
- Integration: save workout with `actual_weight` and `actual_rpe` blank → stored as null, save succeeds
- Integration: save with a set missing `actual_reps` → save blocked, error returned
- E2E: open logging form, modify actuals on two sets to differ from plan, save, verify stored values match entered actuals not planned targets
