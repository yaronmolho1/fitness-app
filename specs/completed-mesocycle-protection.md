# Completed Mesocycle Protection
**Status:** ready
**Epic:** Template Cascade
**Depends:** specs/cascade-scope-selection.md, specs/mesocycle-status-management.md

## Description
As a coach, cascade never modifies templates in completed mesocycles so that past programming is always preserved.

## Acceptance Criteria
- [ ] Cascade operations never update, insert into, or delete from templates belonging to a mesocycle with `status='completed'` — per ADR-002
- [ ] This protection applies to all three cascade scopes: "this mesocycle only", "this + all future", and "all phases" — even "all phases" skips completed mesocycles
- [ ] The cascade query filters out completed mesocycles at the query level: `WHERE mesocycle_status != 'completed'` — per ADR-006
- [ ] If a cascade scope would have included completed mesocycles, those are silently skipped; the cascade proceeds for all eligible (non-completed) targets
- [ ] After a cascade that skipped completed mesocycles, the user is informed in the result summary that some mesocycles were not updated because they are completed
- [ ] The summary message identifies how many completed mesocycles were skipped (count), not which specific ones, to keep the UI concise
- [ ] Templates in completed mesocycles remain readable — protection is write-only (no modification), not access restriction
- [ ] Logged workouts in completed mesocycles are unaffected by cascade — they reference immutable snapshots regardless
- [ ] Attempting to directly edit a template in a completed mesocycle (outside of cascade) is also blocked with a clear error message
- [ ] All protection is enforced at the Server Action layer — per ADR-004

## Edge Cases
- "All phases" scope with all sibling mesocycles completed: only the current (non-completed) template is updated; all others skipped; summary shows skipped count
- "This + all future" scope where future mesocycles are all completed: only current template updated; skipped count shown
- The current mesocycle being edited is itself completed: the edit is blocked entirely (cannot edit templates in a completed mesocycle)
- A mesocycle transitions from `active` to `completed` mid-cascade (race condition in single-user SQLite context): the transaction reads status at query time; if status changed before the transaction commits, the completed mesocycle is excluded
- Cascade skips a completed mesocycle but the user expected it to be updated: the summary message makes the skip explicit so the user understands why

## Test Requirements
- Unit: cascade query with `status='completed'` mesocycles present → completed mesocycles excluded from results
- Unit: all three scopes ("this only", "this + future", "all phases") exclude completed mesocycles
- Unit: direct edit of template in completed mesocycle → rejected
- Integration: cascade "all phases" with mix of active, planned, and completed mesocycles → only active/planned templates updated; completed skipped
- Integration: result summary after cascade with skipped completed mesocycles → shows correct skipped count
- Integration: templates in completed mesocycles are unchanged after cascade — verify by reading template rows before and after
- Integration: direct template edit on completed mesocycle → Server Action returns error
- E2E: cascade edit across multiple mesocycles including a completed one → verify completed mesocycle template is unchanged and summary reports the skip
