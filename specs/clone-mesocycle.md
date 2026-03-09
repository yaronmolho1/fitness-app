# Clone Mesocycle
**Status:** ready
**Epic:** Mesocycle Cloning
**Depends:** specs/exercise-slots.md, specs/7-day-assignment-grid.md

## Description
As a coach, I can clone all workout templates, exercise slots, and weekly schedules from a previous mesocycle into a new one so that I don't have to rebuild my training structure from scratch.

## Acceptance Criteria
- [ ] Clone is a single one-step operation: the new mesocycle is created and all source data is copied in one action — there is no separate "clone into existing" step (per ADR-002)
- [ ] The clone form collects the new mesocycle's `name` (required) and `start_date` (required); `work_weeks` and `has_deload` are copied from the source mesocycle by default but may be overridden by the user
- [ ] The clone operation is performed via a Server Action (per ADR-004)
- [ ] The entire clone — new mesocycle row, all template rows, all exercise slot rows, all weekly schedule rows — is created atomically in a single database transaction; if any part fails, nothing is persisted
- [ ] All `workout_templates` rows from the source mesocycle are copied to the new mesocycle with new auto-increment IDs
- [ ] All `exercise_slots` rows belonging to each copied template are copied with new auto-increment IDs, referencing the new template IDs
- [ ] All `weekly_schedule` rows from the source mesocycle are copied with new auto-increment IDs, referencing the new template IDs
- [ ] Both normal (`variant = 'normal'`) and deload (`variant = 'deload'`) schedule rows are cloned (per ADR-003)
- [ ] If the source mesocycle has `has_deload = false`, no deload schedule rows exist to clone; the new mesocycle also has no deload schedule rows unless `has_deload` is overridden to true in the clone form
- [ ] The new mesocycle's `status` is set to `"planned"` regardless of the source mesocycle's status
- [ ] The new mesocycle's `end_date` is computed from its own `start_date`, `work_weeks`, and `has_deload` (same formula as create)
- [ ] `canonical_name` on each cloned template is copied verbatim from the source template — no transformation (per ADR-002, ADR-006)
- [ ] If the source mesocycle has no `workout_templates`, the clone operation is rejected with a clear error message
- [ ] The source mesocycle may be in any status (`planned`, `active`, or `completed`) — all are valid clone sources
- [ ] On success, the user is navigated to the new mesocycle's detail view
- [ ] The new mesocycle appears in the mesocycle list

## Edge Cases
- Source mesocycle has no templates — rejected with error; cannot clone an empty mesocycle
- Source mesocycle has templates but no exercise slots (e.g. running/MMA templates only) — allowed; templates are cloned, no exercise slot rows to copy
- Source mesocycle has templates but no weekly schedule rows — allowed; templates are cloned, schedule is empty in the new mesocycle
- Source is a `"completed"` mesocycle — allowed as a clone source
- New mesocycle `name` is empty or whitespace-only — rejected with validation error
- New mesocycle `start_date` is missing or invalid — rejected with validation error
- Transaction failure mid-clone (e.g. DB error after templates inserted but before slots) — entire transaction rolls back; no partial data persisted
- `has_deload` overridden to true in clone form when source had `has_deload = false` — new mesocycle has `has_deload = true` but no deload schedule rows (user must configure deload schedule separately)
- `has_deload` overridden to false in clone form when source had `has_deload = true` — deload schedule rows from source are not cloned into the new mesocycle

## Test Requirements
- Unit: Server Action rejects clone when source mesocycle has no templates
- Unit: Server Action rejects clone with missing `name` or invalid `start_date`
- Integration: successful clone creates new mesocycle row, all template rows, all exercise slot rows, and all schedule rows (normal + deload) with new IDs
- Integration: cloned rows reference new mesocycle ID and new template IDs correctly (no dangling references to source IDs)
- Integration: transaction atomicity — simulated failure mid-clone leaves no partial rows
- Integration: new mesocycle `status = "planned"` regardless of source status
- Integration: `end_date` on new mesocycle computed from new `start_date` and copied/overridden `work_weeks`/`has_deload`
