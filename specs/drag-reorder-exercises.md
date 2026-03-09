# Drag-Reorder Exercises
**Status:** ready
**Epic:** Workout Templates
**Depends:** specs/exercise-slots.md

## Description
As a coach, I can drag-and-drop exercise slots within a resistance template to reorder them so that I can sequence the workout logically.

## Acceptance Criteria
- [ ] Exercise slots within a template can be reordered via drag-and-drop
- [ ] Drag-and-drop works on desktop (mouse drag)
- [ ] Drag-and-drop works on mobile (touch drag)
- [ ] The visual order of slots during and after drag reflects the new sequence immediately (optimistic UI)
- [ ] After a successful reorder, the new `sort_order` values are persisted via a Server Action — per ADR-004
- [ ] The persisted `sort_order` values correctly reflect the new sequence so that a page reload shows the same order
- [ ] Reordering does not affect any other slot fields (targets, guidelines, role, exercise reference)
- [ ] A template with only one slot shows no drag affordance (or drag is a no-op)
- [ ] A template with zero slots shows no drag affordance
- [ ] The drag handle or draggable area is clearly indicated in the UI
- [ ] Dropping a slot back to its original position is a no-op (no Server Action called if order unchanged)

## Edge Cases
- Concurrent reorder: user drags while a previous reorder Server Action is still in flight — UI should prevent or queue; V1 may disable drag during pending save
- Reorder on a template in a completed mesocycle — allowed (same rules as other slot edits)
- `sort_order` values after reorder may not be contiguous (gaps are acceptable); display order is determined by `sort_order` ascending
- Touch drag on mobile: must not conflict with page scroll; drag should require a deliberate hold gesture before initiating

## Test Requirements
- Unit: reorder Server Action accepts a new ordered list of slot IDs and updates `sort_order` values accordingly
- Unit: reorder with unchanged order → no DB writes (or idempotent)
- Integration: reorder slots via Server Action → `sort_order` values updated in DB; subsequent read returns slots in new order
- E2E (desktop): drag slot from position 3 to position 1 → verify new order persisted after reload
- E2E (mobile/touch): touch-drag slot to new position → verify new order persisted after reload
