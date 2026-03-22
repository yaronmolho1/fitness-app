# Template Copy from Existing

**Status:** done
**Epic:** Template UX
**Depends:** specs/create-resistance-templates.md, specs/template-add-picker.md

## Description

When adding a template to a mesocycle, the user can browse and copy an existing template from any other mesocycle instead of creating one from scratch. The copied template is fully independent — edits to the copy do not affect the source, and no cascade link is established unless canonical_names happen to match. This avoids rebuilding complex templates (with all their exercises and parameters) from scratch when starting a new phase.

## Acceptance Criteria

1. **Given** I select "From Existing" in the template add picker, **When** the browse view opens, **Then** I see a list of all templates from other mesocycles grouped by mesocycle name.
2. **Given** the browse view is open, **When** I view a template entry, **Then** I see: template name, modality badge, exercise count (resistance only), and source mesocycle name.
3. **Given** the browse view is open, **When** I search/filter by template name, **Then** the list filters to matching templates across all mesocycles.
4. **Given** I select a template, **When** I confirm the copy, **Then** a new template is created in the current mesocycle with all data copied: name, modality, notes, and all exercise slots (with their sets, reps, weight, RPE, rest, order, guidelines).
5. **Given** the copy completes, **When** I view the new template, **Then** it has a new auto-increment ID, new slot IDs, and belongs to the current mesocycle.
6. **Given** the source template has canonical_name "push-a", **When** copied, **Then** the new template also gets canonical_name "push-a" — preserving the cross-phase link.
7. **Given** the current mesocycle already has a template with canonical_name "push-a", **When** I try to copy another template with the same canonical_name, **Then** the copy is rejected with a message explaining the conflict.
8. **Given** the source is a running template, **When** copied, **Then** all running-specific fields (run_type, target_pace, hr_zone, intervals, coaching_cues, target_distance, target_duration) are copied.
9. **Given** the source is a mixed template, **When** copied, **Then** all sections and their modality-specific fields are copied with new IDs.
10. **Given** the source is an MMA/BJJ template, **When** copied, **Then** planned_duration is copied.
11. **Given** the copy operation, **When** executed, **Then** it runs in a single database transaction via a Server Action.
12. **Given** a mesocycle with status "completed", **When** viewing the browse list, **Then** its templates are available as copy sources (completed mesos are valid sources).

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Source template has superset groups | Groups are copied with new group IDs; slot group_id references updated |
| Only one mesocycle exists (no other sources) | Browse view shows empty state: "No other templates available" |
| Source template has no exercise slots (e.g. new running template) | Template metadata copied, no slots to copy |
| Current mesocycle is completed | "Add Template" button not shown; flow unreachable |
| Template name exceeds display width | Truncated with ellipsis in browse list |

## Test Requirements

- AC1: component — browse view lists templates grouped by mesocycle
- AC3: component — search filters templates by name
- AC4: integration — copy creates template + all slots with new IDs in current meso
- AC6: integration — canonical_name preserved on copy
- AC7: integration — duplicate canonical_name in same meso rejected
- AC8-10: integration — modality-specific fields copied correctly
- AC11: integration — transaction atomicity on copy

## Dependencies

- `specs/create-resistance-templates.md` — template schema and creation rules
- `specs/template-add-picker.md` — "From Existing" entry point in picker

## Out of Scope

- Editing the template during the copy flow (copy first, then edit)
- Copying schedule assignments (only template + slots copied, not weekly schedule)
- Global template library separate from mesocycles (templates always belong to a meso)
- Syncing changes back to source template
