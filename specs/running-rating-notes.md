# Running Rating & Notes
**Status:** ready
**Epic:** Workout Logging
**Depends:** specs/running-logging.md

## Description
As an athlete, I can rate the run (1–5) and add overall notes so that subjective feel is captured alongside the objective run data.

## Acceptance Criteria
- [ ] The running logging form includes a rating field and a notes field, displayed once per run (not per interval)
- [ ] The rating field accepts integer values 1 through 5 inclusive
- [ ] The rating field is optional — the athlete can save without selecting a rating
- [ ] The notes field is a free-text input with no enforced length limit in V1
- [ ] The notes field is optional — the athlete can save without entering notes
- [ ] Both fields are positioned at the bottom of the running logging form, after the overall run fields and any interval section, near the "Save Run" action
- [ ] The rating and notes values are stored on the `logged_workouts` row at save time
- [ ] A rating of null (not selected) is stored as null on `logged_workouts`; it is not treated as a rating of 0
- [ ] Empty notes are stored as null (not an empty string) on `logged_workouts`
- [ ] Rating and notes are part of the same atomic transaction that creates the `logged_workouts` row — per ADR-005
- [ ] After save, rating and notes are immutable — no edit path exists
- [ ] All mutations are performed via Server Actions — per ADR-004

## Edge Cases
- Rating value outside 1–5 (e.g. 0, 6, or non-integer) — rejected with validation error
- Notes field with only whitespace — treated as empty; stored as null
- Athlete saves without touching rating or notes — both stored as null; save succeeds
- Rating and notes apply to all run types including interval runs — they are workout-level fields, not interval-level

## Test Requirements
- Unit: rating must be integer 1–5 when provided; null is valid; 0 and 6 are rejected
- Unit: whitespace-only notes normalized to null before save
- Integration: save run with rating=5 and notes text → `logged_workouts` row has correct rating and notes values
- Integration: save run with no rating and no notes → both stored as null, save succeeds
- E2E: complete running logging form, set rating to 2, enter notes, save, verify values persisted on the logged workout record
