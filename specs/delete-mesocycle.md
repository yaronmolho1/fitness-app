# Delete Mesocycle

**Status:** ready
**Epic:** Mesocycle Lifecycle
**Depends:** specs/mesocycle-status-management.md, specs/completed-mesocycle-protection.md

## Description

Allow users to permanently delete a mesocycle from its detail page. Cascade-deletes all associated templates, exercise slots, template sections, and schedule entries. Promotes mesocycle-scoped routine items to global scope. Blocks deletion of the active mesocycle.

## Acceptance Criteria

1. **Given** a mesocycle with status `planned` or `completed`, **When** I click "Delete" on the detail page, **Then** a confirmation dialog appears showing cascade summary (template count, schedule entry count, routine item count).
2. **Given** the confirmation dialog is open, **When** I confirm deletion, **Then** the mesocycle and all associated workout templates, exercise slots, template sections, and weekly schedule entries are deleted in a single transaction.
3. **Given** mesocycle-scoped routine items exist for this mesocycle, **When** I confirm deletion, **Then** those routine items have their `mesocycle_id` set to null and `scope` changed to `global` (promoted, not deleted).
4. **Given** a mesocycle with status `active`, **When** I attempt to delete it, **Then** the delete button is disabled with a message explaining the mesocycle must be completed first.
5. **Given** deletion succeeds, **When** the transaction commits, **Then** I am redirected to the mesocycle list page with a success toast.
6. **Given** deletion fails (DB error), **When** the server action returns an error, **Then** the confirmation dialog shows the error message and does not close.
7. **Given** the confirmation dialog is open, **When** I click "Cancel", **Then** the dialog closes with no side effects.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Mesocycle has zero templates | Deletion allowed; cascade summary shows "0 templates" |
| Mesocycle has routine items with logged routine_logs | Routine items promoted to global (routine_logs reference routine_item_id, not mesocycle — unaffected) |
| Mesocycle is the only one in the system | Deletion allowed; list page shows empty state |
| Two browser tabs open on same mesocycle detail | Second tab's delete attempt fails gracefully (mesocycle already gone) |
| Mesocycle has templates referenced by logged_workouts via canonical_name | Deletion allowed; logged_workouts are independent (no FK to mesocycle or templates) |

## Test Requirements

- AC1: component — confirmation dialog renders with correct cascade counts
- AC2: integration — server action deletes mesocycle + all cascade targets in single transaction
- AC2: integration — verify exercise_slots, template_sections, weekly_schedule rows are gone after delete
- AC3: integration — routine items promoted to global scope after mesocycle deletion
- AC4: component — delete button disabled for active mesocycle
- AC5: component — redirect + toast on success
- AC6: component — error display on failure

## Dependencies

- `specs/mesocycle-status-management.md` — status values and transitions
- `specs/completed-mesocycle-protection.md` — write protection rules (delete is allowed on completed, unlike edits)

## Out of Scope

- Deleting from the mesocycle list page (detail page only)
- Undo/soft-delete
- Global/standalone templates (templates always belong to a mesocycle; reuse via cloning)
- Archiving as an alternative to deletion
