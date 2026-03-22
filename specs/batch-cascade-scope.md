# Batch Cascade Scope

**Status:** implemented
**Epic:** Template Cascade
**Depends:** specs/cascade-scope-selection.md, specs/cascade-slot-edits.md

## Description

When editing multiple exercises in a template, allow the user to set the cascade scope once for all pending changes instead of triggering the cascade scope selector per-exercise. The per-exercise cascade remains available, but a template-level "Apply All" action batches all uncommitted edits into a single cascade operation.

## Acceptance Criteria

1. **Given** I edit one exercise slot's parameters and save, **When** the cascade selector appears, **Then** the existing per-slot behavior is unchanged (backwards compatible).
2. **Given** I edit multiple exercise slots in a template without triggering cascade for each, **When** I click a template-level "Apply Changes" button, **Then** a single cascade scope selector appears for all pending changes.
3. **Given** the template-level cascade selector is open, **When** I select a scope (this only / this + future / all phases), **Then** all pending slot edits are applied with that scope in a single batch operation.
4. **Given** I have pending edits on 5 exercises, **When** I choose "This + future" at the template level, **Then** all 5 edits cascade to sibling templates in one transaction.
5. **Given** some pending edits succeed and one would fail (e.g. target slot not found in sibling), **When** the batch runs, **Then** the entire batch is atomic — all succeed or all roll back.
6. **Given** I have pending edits, **When** I view the template, **Then** edited slots are visually marked as having unsaved changes (e.g. subtle highlight or dot indicator).
7. **Given** I have pending edits, **When** I navigate away from the template, **Then** I am warned about unsaved changes.
8. **Given** I have pending edits, **When** I click "Discard Changes" on the template, **Then** all pending edits are reverted.
9. **Given** the batch cascade completes, **When** the results return, **Then** a Sonner toast shows the aggregate summary (e.g. "5 exercises updated across 3 mesocycles, 1 skipped").
10. **Given** I edit a single exercise and want per-exercise cascade, **When** I save that slot individually, **Then** the per-slot cascade selector appears as before — the batch mode is opt-in, not forced.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Mix of slot parameter edits, slot additions, and slot removals in one batch | All operation types included in the batch cascade |
| Edit a slot, then edit it again before applying | Latest edit wins; only one change per slot in the batch |
| Pending edits on a template that another user edits (race condition) | N/A — single-user app |
| Batch cascade with "This only" scope | All edits applied locally, no cascade — equivalent to saving each individually |
| Template has no siblings (single meso) | Batch applies locally; toast shows simple success |

## Test Requirements

- AC1: component — single-slot edit still triggers per-slot cascade
- AC2-3: component — "Apply Changes" button triggers single cascade selector for batch
- AC4: integration — batch cascade applies all edits to sibling templates
- AC5: integration — batch is atomic (transaction rollback on partial failure)
- AC6: component — pending edit indicators shown on modified slots
- AC8: component — discard reverts all pending edits
- AC9: component — toast shows aggregate summary
- AC10: component — per-slot and batch modes coexist

## Dependencies

- `specs/cascade-scope-selection.md` — scope selection UI and logic
- `specs/cascade-slot-edits.md` — slot-level cascade operations
- `specs/cascade-toast-notification.md` — toast for batch result

## Out of Scope

- Batch cascade for template metadata (name, canonical_name) — only slot edits
- Undo/redo for batch operations
- Partial scope selection (different scopes per exercise in the same batch)
