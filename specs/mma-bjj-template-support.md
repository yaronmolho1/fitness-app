# MMA/BJJ Template Support
**Status:** ready
**Epic:** Workout Templates
**Depends:** specs/create-mesocycle.md

## Description
As an athlete, I can create MMA/BJJ workout templates with a planned duration so that I can track combat training load without technique detail.

## Acceptance Criteria
- [ ] An MMA/BJJ template can be created with a name and a mesocycle association (required fields)
- [ ] Template `modality` is set to `mma_bjj` at creation and is not changeable after creation
- [ ] MMA/BJJ templates are stored in the `workout_templates` table — not a separate table; modality field determines which fields render
- [ ] MMA/BJJ templates have no exercise slots; the exercise slot UI is not shown for MMA/BJJ templates
- [ ] `planned_duration` is an optional positive integer field (minutes) representing the expected session length
- [ ] No other modality-specific fields exist on MMA/BJJ templates in V1 — the template is an occurrence marker with an optional duration
- [ ] `canonical_name` is auto-generated from the template name at creation using the same slug rules as other modalities (lowercase, hyphens, no special chars) — per ADR-002 and ADR-006
- [ ] `canonical_name` is editable after creation with the same cross-phase link warning as other template types
- [ ] Template name (display name) is independently editable without affecting `canonical_name`
- [ ] All MMA/BJJ templates for a mesocycle are listed alongside other templates in the mesocycle template list, with modality indicated
- [ ] A MMA/BJJ template can be deleted; deletion requires a confirmation prompt; no exercise slots to check
- [ ] All mutations (create, update, delete) are performed via Server Actions — per ADR-004
- [ ] Template IDs are auto-increment integers — per architecture conventions
- [ ] After a successful create or update, the UI reflects the new state without a full page reload

## Edge Cases
- `planned_duration = 0` or negative — rejected
- Creating an MMA/BJJ template on a completed mesocycle — blocked with error message
- Duplicate `canonical_name` within same mesocycle — rejected
- Template with no `planned_duration` set — valid; duration is optional

## Test Requirements
- Unit: `planned_duration` must be a positive integer when provided; zero and negative values rejected
- Integration: create MMA/BJJ template via Server Action → template appears in mesocycle list with `modality = mma_bjj`
- Integration: create template without `planned_duration` → template created successfully
- Integration: create template with `planned_duration` → value stored and displayed
- E2E: create MMA/BJJ template, verify no exercise slot UI is shown, verify modality label displayed
