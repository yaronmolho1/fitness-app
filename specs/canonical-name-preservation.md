# Canonical Name Preservation
**Status:** ready
**Epic:** Mesocycle Cloning
**Depends:** specs/clone-mesocycle.md

## Description
As a coach, I can rely on cloned templates keeping the same canonical name slugs with new IDs so that cross-phase linking works correctly for progression tracking and cascade edits.

## Acceptance Criteria
- [ ] When a mesocycle is cloned, each new `workout_templates` row receives a new auto-increment integer ID
- [ ] The `canonical_name` value from each source template row is copied verbatim to the corresponding new template row — no transformation, no re-derivation from the display name (per ADR-002, ADR-006)
- [ ] `canonical_name` slug format is lowercase, hyphens only, no special characters (e.g. `"Push A"` → `"push-a"`, `"Push A (Main)"` → `"push-a-main"`) — this format is enforced at template creation time, not at clone time
- [ ] After cloning, a cross-phase query filtering `WHERE canonical_name = :slug` returns matching templates from both the source mesocycle and the new cloned mesocycle
- [ ] After cloning, a cascade edit targeting a `canonical_name` in `active` or `planned` mesocycles correctly includes the cloned template as a target (per ADR-002 cascade query pattern)
- [ ] After cloning, a progression query for an exercise can retrieve logged workout history linked via `canonical_name` across the source and cloned mesocycles
- [ ] The `canonical_name` on a cloned template is identical (byte-for-byte) to the source template's `canonical_name`
- [ ] Cloning does not modify the `canonical_name` on the source mesocycle's templates

## Edge Cases
- Source template has a `canonical_name` that was manually edited to a non-standard format — the value is still copied verbatim; no normalization is applied at clone time
- Two source templates in the same mesocycle have the same `canonical_name` — both are cloned with the same `canonical_name` value; this is an existing data integrity issue, not introduced by cloning
- Source template `canonical_name` is null or empty — copied as-is; cross-phase linking will not work for that template (pre-existing data issue)
- Cloned mesocycle is later completed — cascade edits no longer target its templates (completed mesocycles are excluded from cascade queries per ADR-002), but progression queries still work via `canonical_name` on `logged_workouts`

## Test Requirements
- Unit: clone operation copies `canonical_name` verbatim from each source template to each new template row
- Unit: clone operation does not modify `canonical_name` on source template rows
- Integration: after clone, `SELECT canonical_name FROM workout_templates WHERE mesocycle_id = :newId` returns the same slugs as the source mesocycle
- Integration: cross-phase query `WHERE canonical_name = :slug AND mesocycle_id IN (...)` returns templates from both source and cloned mesocycle
- Integration: cascade query pattern (`WHERE canonical_name = :slug AND mesocycle_status IN ('active', 'planned')`) includes the cloned template when its mesocycle is active or planned
