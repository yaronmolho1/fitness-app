# Exercise CRUD
**Status:** ready
**Epic:** Exercise Library
**Depends:** specs/app-shell-navigation.md

## Description
As a coach, I can create, view, edit, and delete exercises with name, modality, muscle group, and equipment fields so that I can build workout templates from a consistent, reusable library.

## Acceptance Criteria

### Exercise list view
- [ ] The exercise library is accessible from the app navigation
- [ ] The list displays all exercises in the database
- [ ] Each exercise row shows: name, modality, muscle group, and equipment
- [ ] The list is accessible while authenticated (protected route)
- [ ] When no exercises exist, an empty state is shown with a prompt to create the first exercise

### Create exercise
- [ ] A form is available to create a new exercise
- [ ] The form includes: name (text, required), modality (select: `resistance` | `running` | `mma`, required), muscle group (text, optional), equipment (text, optional)
- [ ] Submitting a valid form creates the exercise and it appears in the list
- [ ] Create is implemented as a Server Action (per ADR-004)
- [ ] After successful creation, the exercise list is revalidated and reflects the new entry
- [ ] Submitting with an empty name shows a validation error and does not create the exercise
- [ ] Submitting without selecting a modality shows a validation error and does not create the exercise
- [ ] Submitting a name that already exists (case-insensitive match) shows an error: the name is already taken
- [ ] The form can be submitted without filling in muscle group or equipment (both optional)

### Read / view exercise
- [ ] Each exercise in the list is viewable with all its fields
- [ ] All four fields (name, modality, muscle group, equipment) are displayed for each exercise

### Edit exercise
- [ ] Each exercise has an edit action
- [ ] The edit form is pre-populated with the exercise's current values
- [ ] Submitting a valid edit updates the exercise and the list reflects the change
- [ ] Edit is implemented as a Server Action (per ADR-004)
- [ ] After successful edit, the exercise list is revalidated
- [ ] Editing to an empty name shows a validation error and does not save
- [ ] Editing to a name already used by a different exercise shows a duplicate name error
- [ ] Editing to the same name as the current exercise (no name change) is valid and saves successfully
- [ ] Modality can be changed on an existing exercise
- [ ] Muscle group and equipment can be cleared (set to empty/null) on an existing exercise

### Delete exercise
- [ ] Each exercise has a delete action
- [ ] Deleting an exercise removes it from the database and from the list
- [ ] Delete is implemented as a Server Action (per ADR-004)
- [ ] After successful deletion, the exercise list is revalidated
- [ ] Deleting an exercise that is referenced by any `exercise_slot` is blocked with a clear error message (per specs/exercise-deletion-protection.md)
- [ ] A confirmation step is required before deletion (user must confirm intent)

### Data integrity
- [ ] Exercise IDs are auto-increment integers (per architecture conventions — no UUIDs)
- [ ] `created_at` is set automatically at insert time as an integer timestamp
- [ ] The `exercises.name` unique constraint at the DB level prevents duplicate names even if app-layer validation is bypassed

## Edge Cases

- Creating an exercise with only whitespace in the name field is rejected (name must be non-empty after trimming)
- Creating an exercise with a name that differs only in case from an existing exercise is rejected (e.g., "Squat" vs "squat")
- Editing an exercise that no longer exists (deleted in another tab) returns a not-found error
- Deleting an exercise that no longer exists (already deleted) returns a not-found error gracefully (no crash)
- Submitting the create form multiple times rapidly (double-click) does not create duplicate exercises
- Very long name inputs (>255 chars) are handled — either truncated or rejected with a clear error
- Muscle group and equipment fields accept free text — no predefined enum constraint at the DB level
- Modality field only accepts the three valid values (`resistance`, `running`, `mma`) — arbitrary strings are rejected

## Test Requirements

- **Unit — create validation**: call the create Server Action with missing name; assert validation error returned. Call with missing modality; assert validation error. Call with valid data; assert exercise is created.
- **Unit — duplicate name**: call create with a name matching an existing exercise; assert duplicate error returned.
- **Unit — edit validation**: call the edit Server Action with empty name; assert validation error. Call with a name belonging to a different exercise; assert duplicate error.
- **Unit — edit same name**: call edit with the same name as the current exercise; assert success.
- **Integration — create persists**: call create Server Action; query the database; assert the new row exists with correct field values.
- **Integration — edit persists**: call edit Server Action; query the database; assert the row is updated.
- **Integration — delete persists**: call delete Server Action on an exercise with no slots; query the database; assert the row is gone.
- **Integration — delete blocked**: call delete Server Action on an exercise referenced by an exercise slot; assert error is returned and the row still exists.
- **Integration — DB unique constraint**: attempt to insert two exercises with the same name directly via Drizzle; assert constraint error.
- **E2E — create flow**: navigate to exercise library, open create form, fill valid data, submit; assert new exercise appears in list.
- **E2E — edit flow**: click edit on an exercise, change the name, submit; assert updated name appears in list.
- **E2E — delete flow**: click delete on an unused exercise, confirm; assert exercise is removed from list.
- **E2E — empty state**: load exercise library with no exercises; assert empty state message is shown.
