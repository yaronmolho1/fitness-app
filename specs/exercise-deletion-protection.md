# Exercise Deletion Protection
**Status:** ready
**Epic:** Exercise Library
**Depends:** specs/exercise-crud.md

## Description
As a coach, I want deletion blocked if an exercise is used in a template so that I don't break existing workout plans.

## Acceptance Criteria

### Block deletion when exercise is in use
- [ ] Before deleting an exercise, the delete Server Action checks whether any `exercise_slot` row references that exercise's ID
- [ ] If one or more `exercise_slot` rows reference the exercise, the delete is rejected — no row is removed from the database
- [ ] The rejection returns a clear error message indicating the exercise is in use and cannot be deleted
- [ ] The error message is surfaced to the user in the UI (not silently swallowed)
- [ ] The error message does not expose raw SQL or internal error details

### Allow deletion when exercise is not in use
- [ ] If no `exercise_slot` rows reference the exercise, deletion proceeds normally
- [ ] The exercise is removed from the database
- [ ] The exercise list is revalidated and the deleted exercise no longer appears

### Protection scope
- [ ] The check covers `exercise_slot` rows across all mesocycles and all workout templates — not just the active mesocycle
- [ ] An exercise referenced in a completed mesocycle's template is still protected from deletion
- [ ] An exercise referenced in a planned (not yet active) mesocycle's template is still protected from deletion

### Enforcement layer
- [ ] Protection is enforced at the application layer in the delete Server Action (per ADR-004)
- [ ] The `exercise_slots.exercise_id` FK does not have a cascade delete — the DB will also raise a FK constraint error if the app-layer check is bypassed (defense in depth, per ADR-001 `foreign_keys=ON`)
- [ ] The application-layer check runs before the DELETE statement — the FK constraint is a safety net, not the primary enforcement

### UI behavior
- [ ] The delete confirmation step (from specs/exercise-crud.md) is shown before the protection check runs — the check happens on confirmed delete, not on opening the confirmation
- [ ] After a blocked deletion, the exercise remains in the list and the user can dismiss the error and continue

## Edge Cases

- Attempting to delete an exercise that has been added to a template in a completed mesocycle is blocked (completed mesocycles still have `exercise_slot` rows)
- Attempting to delete an exercise that was previously in a template but whose slot was later removed is allowed (no remaining `exercise_slot` rows)
- Attempting to delete an exercise that no longer exists (already deleted in another tab) returns a not-found error, not a protection error
- Rapid double-submission of the delete action does not cause a race condition — the check and delete are atomic within the Server Action
- An exercise referenced in multiple templates across multiple mesocycles shows a single clear error (not one error per slot)
- The error message does not enumerate which templates use the exercise (just that it is in use) — no scope creep into template detail

## Test Requirements

- **Unit — in-use check**: call the delete Server Action with an exercise ID that has associated `exercise_slot` rows; assert the action returns a protection error and does not delete the exercise.
- **Unit — not-in-use check**: call the delete Server Action with an exercise ID that has no associated `exercise_slot` rows; assert the action succeeds and the exercise is deleted.
- **Unit — cross-mesocycle scope**: create exercise slots in two different mesocycles referencing the same exercise; call delete; assert the exercise is protected.
- **Unit — completed mesocycle protection**: create an exercise slot in a completed mesocycle; call delete on the exercise; assert the exercise is protected.
- **Integration — FK safety net**: attempt to delete an exercise directly via Drizzle (bypassing app-layer check) when `exercise_slot` rows exist; assert SQLite raises a FK constraint error (because `foreign_keys=ON` per ADR-001).
- **Integration — delete after slot removal**: create an exercise slot, then delete the slot, then delete the exercise; assert the exercise is successfully deleted.
- **E2E — blocked deletion**: add an exercise to a template, then attempt to delete the exercise from the library; assert the error message is shown and the exercise remains in the list.
- **E2E — allowed deletion**: create an exercise not used in any template; delete it; assert it is removed from the list with no error.
