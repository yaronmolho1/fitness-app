# Log Immutability
**Status:** ready
**Epic:** Workout Logging
**Depends:** specs/pre-filled-resistance-logging.md

## Description
As an athlete, I want the saved workout to be immutable (no edits after save) so that my history is trustworthy and reflects exactly what happened.

## Acceptance Criteria
- [ ] Saving a workout creates records atomically in a single database transaction — per ADR-005
- [ ] The transaction creates, in order: one `logged_workouts` row, one `logged_exercises` row per exercise, one `logged_sets` row per set
- [ ] If any part of the transaction fails, the entire transaction is rolled back — no partial log records are created
- [ ] The `logged_workouts` row stores a `template_snapshot` JSON column containing the full planned template state at the time of logging
- [ ] The `template_snapshot` JSON includes a `version` field set to `1` — per ADR-005 implementation notes
- [ ] The `template_snapshot` JSON includes: template name, modality, all exercise slots (exercise name, target_sets, target_reps, target_weight, target_rpe, rest_seconds, guidelines, sort_order), and any template-level fields (coaching cues, etc.)
- [ ] The `logged_workouts` row stores `canonical_name` copied from `workout_templates.canonical_name` at log time — per ADR-006
- [ ] `canonical_name` on `logged_workouts` is a plain string copy, not a foreign key — per ADR-006
- [ ] The `logged_exercises` rows store normalized per-exercise data enabling SQL analytics (exercise name, exercise_id reference, sort_order)
- [ ] The `logged_sets` rows store normalized per-set data: `actual_reps`, `actual_weight`, `actual_rpe`, set number/order
- [ ] After the transaction commits, no UPDATE or DELETE operations are performed on `logged_workouts`, `logged_exercises`, or `logged_sets` rows — enforced at the application layer
- [ ] The application layer has no edit or delete UI for logged workouts — there is no "edit log" action anywhere in the UI
- [ ] The application layer has no Server Action that issues UPDATE or DELETE against log tables
- [ ] Future template edits do not affect the `template_snapshot` stored on existing `logged_workouts` rows — the snapshot is frozen at log time
- [ ] The `logged_at` timestamp on `logged_workouts` is set to the current time at transaction commit, stored as an integer timestamp — per architecture date storage conventions
- [ ] All log creation is performed via a single Server Action — per ADR-004

## Edge Cases
- Transaction fails mid-way (e.g. DB error after `logged_workouts` insert but before `logged_sets`) — full rollback; no orphaned rows
- Template is edited or deleted after a workout is logged — the `template_snapshot` on the existing log is unaffected; it retains the state from log time
- `canonical_name` on the source template is changed after logging — the `logged_workouts.canonical_name` retains the value copied at log time; cross-phase queries using the old slug still find this record
- Attempting to call an update or delete Server Action on a log table — no such Server Action exists; any attempt is a programming error, not a user-facing scenario
- Two rapid save attempts (double-tap) — the second attempt should be a no-op or return an error; the Already-Logged Summary story prevents re-logging the same day's workout

## Test Requirements
- Unit: log write transaction creates `logged_workouts` + `logged_exercises` + `logged_sets` in correct order
- Unit: `template_snapshot` JSON contains `version: 1` field
- Unit: `template_snapshot` JSON contains all exercise slot fields from the template at log time
- Unit: `canonical_name` on `logged_workouts` matches `workout_templates.canonical_name` at log time
- Unit: transaction rollback on simulated DB error — no partial rows remain
- Integration: save workout → query `logged_workouts`, `logged_exercises`, `logged_sets` — all rows present with correct data
- Integration: edit template after logging → re-query `logged_workouts.template_snapshot` — snapshot unchanged
- Integration: no UPDATE or DELETE Server Actions exist targeting log tables — verified by code review / static analysis
- E2E: save a resistance workout, verify the completion summary is shown (not the log form), verify no edit action is available on the logged workout
