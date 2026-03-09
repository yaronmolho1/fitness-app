# Running Templates
**Status:** ready
**Epic:** Workout Templates
**Depends:** specs/create-mesocycle.md

## Description
As a coach, I can create running workout templates with run type, target pace, HR zone, interval count/rest, and coaching cues so that run plans are first-class alongside resistance templates.

## Acceptance Criteria
- [ ] A running template can be created with a name and a mesocycle association (required fields)
- [ ] Template `modality` is set to `running` at creation and is not changeable after creation
- [ ] Running templates are stored in the `workout_templates` table — not a separate table; modality field determines which fields render
- [ ] Running templates have no exercise slots; the exercise slot UI is not shown for running templates
- [ ] `run_type` is a required field with valid values: `easy`, `tempo`, `interval`, `long`, `race` (enumerated set)
- [ ] `target_pace` is an optional text field (e.g. "5:30/km") — stored as text, no parsing or validation of pace format in V1
- [ ] `hr_zone` is an optional integer field representing the target heart rate zone (e.g. 1–5)
- [ ] `interval_count` is an optional positive integer representing the number of uniform intervals; only relevant when `run_type = interval`
- [ ] `interval_rest` is an optional non-negative integer (seconds) representing rest between intervals; only relevant when `run_type = interval`
- [ ] `coaching_cues` is an optional free-text field for notes and instructions visible to the athlete
- [ ] When `run_type` is not `interval`, `interval_count` and `interval_rest` fields are hidden in the UI (not rendered)
- [ ] When `run_type` is `interval`, `interval_count` and `interval_rest` fields are shown
- [ ] V1 supports uniform intervals only — all intervals in a session share the same target pace and distance; variable-distance ladders are out of scope
- [ ] `canonical_name` is auto-generated from the template name at creation using the same slug rules as resistance templates (lowercase, hyphens, no special chars) — per ADR-002 and ADR-006
- [ ] `canonical_name` is editable after creation with the same cross-phase link warning as resistance templates
- [ ] Template name (display name) is independently editable without affecting `canonical_name`
- [ ] All running templates for a mesocycle are listed alongside resistance templates in the mesocycle template list, with modality indicated
- [ ] A running template can be deleted; deletion requires a confirmation prompt; no exercise slots to check
- [ ] All mutations (create, update, delete) are performed via Server Actions — per ADR-004
- [ ] Template IDs are auto-increment integers — per architecture conventions
- [ ] After a successful create or update, the UI reflects the new state without a full page reload

## Edge Cases
- `hr_zone` outside 1–5 range — rejected (or warn; V1 should at minimum validate positive integer)
- `interval_count = 0` or negative — rejected
- `interval_rest` negative — rejected
- `run_type = interval` with no `interval_count` set — allowed (fields are optional); UI may show a hint that count is unset
- `run_type` changed from `interval` to non-interval after `interval_count`/`interval_rest` are set — those fields are hidden in UI but values may be retained in DB; they are ignored in non-interval context
- Creating a running template on a completed mesocycle — blocked with error message
- Duplicate `canonical_name` within same mesocycle — rejected
- `target_pace` with arbitrary text (no format enforcement in V1) — stored as-is

## Test Requirements
- Unit: `run_type` accepts only valid enum values; invalid values rejected
- Unit: `interval_count` must be positive integer when provided
- Unit: `interval_rest` must be non-negative integer when provided
- Unit: `hr_zone` must be a positive integer when provided
- Integration: create running template via Server Action → template appears in mesocycle list with `modality = running`
- Integration: create interval template → `interval_count` and `interval_rest` stored and displayed
- Integration: create non-interval template → `interval_count`/`interval_rest` fields not shown in UI
- Integration: update `run_type` from interval to easy → interval fields hidden
- E2E: create running template of each `run_type`, verify correct fields shown/hidden per type
