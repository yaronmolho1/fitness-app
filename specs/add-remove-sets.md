# Add/Remove Sets
**Status:** ready
**Epic:** Workout Logging
**Depends:** specs/pre-filled-resistance-logging.md

## Description
As an athlete, I can add extra sets or remove planned sets during logging so that the log matches what I actually did when it differed from the plan.

## Acceptance Criteria
- [ ] Each exercise section in the logging form has an "Add Set" action that appends a new set row below the existing rows
- [ ] A newly added set row is pre-filled with the same `actual_reps` and `actual_weight` values as the last existing set row for that exercise (copy-from-previous behavior)
- [ ] If no previous set exists for the exercise (all sets were removed), the new set row starts empty
- [ ] `actual_rpe` on a newly added set row is always empty (not copied from previous set)
- [ ] Each set row has a "Remove" action that deletes that row from the form
- [ ] At least one set row must remain per exercise — removing the last set row is blocked with a validation message
- [ ] The minimum of 1 set per exercise is enforced at the UI level before submission
- [ ] Added sets are included in the workout save and stored as `logged_sets` rows
- [ ] Removed sets are not included in the workout save — they produce no `logged_sets` rows
- [ ] The set row count at save time reflects the actual number of rows present in the form (planned count is irrelevant at save time)
- [ ] Added and removed sets are reflected in the `template_snapshot` JSON only as the planned state — the snapshot captures the original plan, not the athlete's modifications to set count
- [ ] The "Add Set" and "Remove" actions are accessible on mobile with large tap targets
- [ ] All mutations (save workout with modified set count) are performed via Server Actions — per ADR-004

## Edge Cases
- Athlete adds 3 extra sets beyond the planned count — all 3 are saved as `logged_sets` rows
- Athlete removes all but one planned set — the single remaining set is saved; minimum-1 constraint satisfied
- Athlete attempts to remove the last set row — blocked; "Remove" action is disabled or shows an error
- Athlete adds a set, then removes it before saving — no net change; form returns to previous state
- Exercise slot has `target_sets = 1` — the single pre-filled row cannot be removed; "Remove" is disabled from the start
- Newly added set row: `actual_reps` and `actual_weight` copied from previous row, `actual_rpe` blank — athlete must still enter `actual_reps` before saving (required field)

## Test Requirements
- Unit: add set → new row appended with `actual_reps` and `actual_weight` copied from last row, `actual_rpe` empty
- Unit: add set when no rows exist → new row starts fully empty
- Unit: remove set when only one row remains → blocked; error returned
- Integration: add 2 extra sets, save → `logged_sets` contains planned + 2 extra rows for that exercise
- Integration: remove 1 planned set, save → `logged_sets` contains planned count minus 1 for that exercise
- Integration: template_snapshot on saved workout reflects original planned set count, not the modified count
- E2E: add a set, fill actuals, remove a different set, save, verify stored set count matches form state
