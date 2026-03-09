# Interval Logging
**Status:** ready
**Epic:** Workout Logging
**Depends:** specs/running-logging.md

## Description
As an athlete, I can log actual pace and average HR per interval rep so that I can see which reps I nailed vs struggled, with optional per-interval notes.

## Acceptance Criteria
- [ ] The interval logging section is shown only when `run_type = interval`; it is not shown for other run types
- [ ] The interval logging section appears within the running logging form, below the overall fields (`actual_distance`, `actual_avg_pace`, `actual_avg_hr`)
- [ ] The number of interval rep rows rendered equals `workout_templates.interval_count` from the planned template
- [ ] If `interval_count` is null or not set on the template, no interval rep rows are rendered; the section is hidden
- [ ] Each interval rep row has an `interval_pace` field — free-text (e.g. "4:55/km"); optional; no format validation in V1
- [ ] Each interval rep row has an `interval_avg_hr` field — a positive integer (beats per minute); optional
- [ ] Each interval rep row has an `interval_notes` field — free-text; optional; collapsed by default with a "tap to expand" affordance
- [ ] V1 supports uniform intervals only — all rep rows share the same structure; variable-distance ladders are out of scope
- [ ] Per-interval data (all rep rows) is stored as a JSON array on `logged_workouts` — not in `logged_sets` or `logged_exercises`
- [ ] The JSON array contains one object per interval rep, with fields: `rep_number` (1-indexed), `interval_pace`, `interval_avg_hr`, `interval_notes`
- [ ] Null/empty fields within each rep object are stored as null
- [ ] The JSON array is stored atomically as part of the same transaction that creates the `logged_workouts` row — per ADR-005
- [ ] The `template_snapshot` JSON on `logged_workouts` includes `interval_count` and `interval_rest` from the planned template — per ADR-005
- [ ] After save, the interval data JSON array is immutable — no UPDATE or DELETE on the `logged_workouts` row
- [ ] All mutations are performed via Server Actions — per ADR-004

## Edge Cases
- `interval_count = null` on template — no interval rows rendered; interval section hidden; JSON array stored as null or empty
- `interval_avg_hr` of 0 or negative — rejected; must be a positive integer when provided
- `interval_pace` with arbitrary text — stored as-is; no format enforcement in V1
- All per-interval fields left blank for a rep — that rep's object stored with all fields null; save succeeds
- All interval rows left blank — save succeeds; JSON array contains objects with all-null fields
- `interval_notes` field collapsed — athlete must tap to expand before typing; field is still submitted (as null) even if never expanded

## Test Requirements
- Unit: interval rep rows rendered = `interval_count` from template; 0 or null count → no rows
- Unit: per-interval JSON array structure — each element has `rep_number`, `interval_pace`, `interval_avg_hr`, `interval_notes`
- Unit: `interval_avg_hr` must be a positive integer when provided; null is valid
- Integration: save interval run with 6 reps, some with pace/HR filled → `logged_workouts` JSON array has 6 objects with correct values
- Integration: save interval run with all per-interval fields blank → JSON array has 6 objects with all-null fields; save succeeds
- Integration: `template_snapshot` includes `interval_count` and `interval_rest` from the template
- E2E: open interval run, fill pace and HR for 3 of 6 reps, expand notes on one rep, save, verify JSON array stored correctly
