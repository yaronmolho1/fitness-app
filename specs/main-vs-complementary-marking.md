# Main vs Complementary Marking
**Status:** ready
**Epic:** Workout Templates
**Depends:** specs/exercise-slots.md

## Description
As a coach, I can mark exercise slots as main or complementary so that primary lifts are visually distinct from accessory work in both the planning and logging UIs.

## Acceptance Criteria
- [ ] Each exercise slot has a `role` field with two valid values: `main` and `complementary`
- [ ] `role` defaults to `complementary` when a new slot is added
- [ ] The `role` of any slot can be toggled between `main` and `complementary` at any time
- [ ] Main slots are visually distinct from complementary slots in the template detail view (e.g. different label, badge, or styling)
- [ ] Main slots are visually distinct from complementary slots in the today's workout view (planning UI)
- [ ] Main slots are visually distinct from complementary slots in the workout logging UI
- [ ] Multiple slots in the same template can be marked as `main` (no limit on main count per template)
- [ ] A template can have zero main slots (all complementary) — valid state
- [ ] A template can have zero complementary slots (all main) — valid state
- [ ] The `role` value is included in the `template_snapshot` JSON written at log time, so logged history preserves the role as it was at the time of logging
- [ ] Toggling `role` is performed via a Server Action — per ADR-004
- [ ] After toggling, the UI reflects the new role without a full page reload

## Edge Cases
- Template with no slots — no role UI rendered
- Toggling role on a slot in a template belonging to a completed mesocycle — allowed (template editing in completed mesocycles is a separate concern; role toggle follows the same rules as other slot edits)
- Role value in snapshot: if a log was created before this feature existed (no `role` field in snapshot), the logging UI must handle missing `role` gracefully (treat as `complementary` or omit distinction)

## Test Requirements
- Unit: `role` defaults to `complementary` on slot creation
- Unit: `role` accepts only `main` or `complementary`; any other value is rejected
- Integration: toggle slot role via Server Action → role updated and reflected in template view
- Integration: template snapshot at log time includes `role` field on each slot
- E2E: mark a slot as main → verify visual distinction in template view; verify distinction carries through to today's workout view
