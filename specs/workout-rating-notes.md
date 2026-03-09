# Workout Rating & Notes
**Status:** ready
**Epic:** Workout Logging
**Depends:** specs/pre-filled-resistance-logging.md

## Description
As an athlete, I can rate the workout (1–5) and add free-text notes so that subjective feel is captured alongside objective set data.

## Acceptance Criteria
- [ ] The resistance workout logging form includes a rating field and a notes field, displayed once per workout (not per exercise or per set)
- [ ] The rating field accepts integer values 1 through 5 inclusive
- [ ] The rating field is optional — the athlete can save without selecting a rating
- [ ] The notes field is a free-text input with no enforced length limit in V1
- [ ] The notes field is optional — the athlete can save without entering notes
- [ ] Both fields are positioned at the bottom of the logging form, after all exercise/set rows, near the "Save Workout" action
- [ ] The rating and notes values are stored on the `logged_workouts` row at save time
- [ ] A rating of null (not selected) is stored as null on `logged_workouts`; it is not treated as a rating of 0
- [ ] Empty notes are stored as null (not an empty string) on `logged_workouts`
- [ ] Rating and notes are included in the `template_snapshot` JSON — per ADR-005 (they are part of the logged workout record)
- [ ] All mutations are performed via Server Actions — per ADR-004

## Edge Cases
- Rating value outside 1–5 (e.g. 0, 6, or non-integer) — rejected with validation error
- Notes field with only whitespace — treated as empty; stored as null
- Athlete saves without touching rating or notes — both stored as null; save succeeds
- Rating and notes are immutable after save — no edit path exists (enforced by Log Immutability story)

## Test Requirements
- Unit: rating must be integer 1–5 when provided; null is valid; 0 and 6 are rejected
- Unit: whitespace-only notes normalized to null before save
- Integration: save workout with rating=4 and notes text → `logged_workouts` row has correct rating and notes values
- Integration: save workout with no rating and no notes → both stored as null, save succeeds
- E2E: complete logging form, set rating to 3, enter notes, save, verify values persisted on the logged workout record
