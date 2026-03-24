# Exercise Slot Transfer Between Templates

## Description

Allow coaches to copy or move individual exercise slots (with all configuration: sets, reps, weight, RPE, rest, guidelines, superset grouping) between templates via a context menu action and target picker modal, eliminating manual re-entry when reorganizing workouts across templates.

## Acceptance Criteria

### Copy operation

1. **Given** an exercise slot in a template, **When** the coach selects "Copy to..." from the slot's action menu, **Then** a target picker modal opens showing available mesocycles, templates, and sections.

2. **Given** the target picker modal, **When** the coach selects a target mesocycle, **Then** only that mesocycle's templates are shown (filtered to compatible modalities: resistance or mixed with resistance sections).

3. **Given** the target picker with a mixed template selected, **When** the target template has multiple resistance sections, **Then** the coach must select which section to place the copied slot into.

4. **Given** a completed copy operation, **When** the slot is copied to the target template, **Then** the copied slot retains the same exercise reference, sets, reps, weight, RPE, rest seconds, guidelines, and is_main flag.

5. **Given** a completed copy operation, **When** viewing the source template, **Then** the original slot remains unchanged.

6. **Given** a copied slot, **When** it is placed in the target template, **Then** it is appended at the end of the existing slot order (after the last current slot).

### Move operation

7. **Given** an exercise slot in a template, **When** the coach selects "Move to..." from the slot's action menu, **Then** the same target picker modal opens as for copy.

8. **Given** a completed move operation, **When** viewing the source template, **Then** the moved slot is removed and remaining slots retain their relative order.

9. **Given** a completed move operation, **When** viewing the target template, **Then** the slot appears with all its original configuration preserved.

### Superset handling

10. **Given** an exercise slot that belongs to a superset group, **When** the coach selects "Copy to..." or "Move to...", **Then** a prompt asks whether to transfer this exercise only or the entire superset group.

11. **Given** "entire superset group" selected, **When** the transfer completes, **Then** all slots from the superset are transferred together and share a new group_id in the target template (preserving superset structure).

12. **Given** "this exercise only" selected for a superset member, **When** the transfer completes, **Then** only the selected slot is transferred without any group_id (it becomes a standalone exercise in the target).

### Validation and protection

13. **Given** a target template in a completed mesocycle, **When** the coach attempts to copy or move a slot to it, **Then** the operation is rejected with an error message.

14. **Given** a source slot in a completed mesocycle, **When** the coach attempts to move it, **Then** the operation is rejected (completed mesocycles are immutable). Copy is still allowed.

15. **Given** a target template that already contains the same exercise, **When** the coach copies a slot with that exercise, **Then** the copy proceeds — duplicate exercises in a template are allowed per existing slot spec.

### Cross-mesocycle transfer

16. **Given** a slot in mesocycle A, **When** the coach copies it to a template in mesocycle B, **Then** the copy succeeds with the slot referencing the same global exercise (exercises are mesocycle-independent).

### Section handling

17. **Given** a slot being copied to a pure resistance template (no sections), **When** the copy completes, **Then** the slot's section_id is set to null.

18. **Given** a slot being copied to a mixed template's resistance section, **When** the copy completes, **Then** the slot's section_id is set to the target section's ID.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Copying to the same template | Allowed — creates a duplicate slot in the same template |
| Moving the last slot from a template | Allowed — template becomes an empty container with add-exercise prompt |
| Moving all members of a superset individually (one by one) | Each becomes standalone in target; source superset dissolves as members are removed |
| Target template has slots with group_ids that conflict | New group_ids are generated sequentially after the target's max group_id — no conflict |
| Source slot has section_id but target is pure resistance | section_id set to null in target |
| Source slot has null section_id but target is mixed | Coach must select a section; slot gets target section's ID |
| Copy/move while another user is editing (single-user app, but tab concurrency) | Transaction ensures atomic insert+delete; page revalidation reflects final state |
| Moving a slot with per-week overrides (from intra-phase progression feature) | Per-week overrides are NOT transferred — they are specific to the source mesocycle's week structure. Slot is copied with base values only. |

## Test Requirements

- AC1: Integration — "Copy to..." action opens target picker with mesocycles/templates
- AC2: Integration — target picker filters templates to compatible modalities
- AC4: Integration — copied slot in target has identical field values to source
- AC5: Integration — source slot unchanged after copy
- AC6: Integration — copied slot order = max existing order + 1 in target
- AC8: Integration — source slot removed after move; remaining slots have correct order
- AC10: Integration — superset member shows group transfer prompt
- AC11: Integration — entire superset transferred with new shared group_id
- AC12: Integration — single slot from superset transferred without group_id
- AC13: Integration — copy to completed mesocycle rejected
- AC14: Integration — move from completed mesocycle rejected; copy allowed
- AC16: Integration — cross-mesocycle copy references same global exercise
- AC17: Integration — slot copied to non-sectioned template has null section_id
- AC18: Integration — slot copied to mixed template section gets correct section_id

## Dependencies

- `specs/exercise-slots.md` — base slot CRUD behavior (add/edit/remove/reorder)
- `specs/mixed-modality-templates.md` — section structure for mixed template targets
- `specs/template-copy-from-existing.md` — full-template copy; slot transfer reuses the same copy pattern
- `docs/adrs/009-exercise-slot-transfer.md` — architectural decision for context menu + modal approach

## Out of Scope

- Drag & drop between templates (Phase 2 desktop enhancement)
- Multi-select batch transfer (Phase 2)
- Transferring running/MMA section configuration (only resistance exercise slots)
- Transferring per-week overrides (intra-phase progression data is mesocycle-specific)

## Open Questions

- Should the target picker remember the last-used target mesocycle/template for faster repeated transfers?
- When copying a superset group, should group_rest_seconds also transfer?
