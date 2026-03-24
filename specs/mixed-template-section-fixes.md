# Mixed Template Section Fixes

## Description

Fix three bugs in mixed-modality template editing: form field misalignment when adding sections, exercises losing their section association on add, and sections rendering as read-only summaries instead of editable content.

## Acceptance Criteria

1. **Given** a mixed template creation form with sections, **When** a section row displays the name input and modality dropdown, **Then** both fields are vertically aligned on the same baseline (matching labels or no labels on both).

2. **Given** a mixed template with a resistance section, **When** the user adds an exercise to that section via the exercise picker, **Then** the created exercise slot stores the correct `section_id` linking it to that section.

3. **Given** a mixed template with a resistance section, **When** the template is expanded in the mesocycle view, **Then** the resistance section renders the full exercise slot editor (add, edit, remove, reorder) — not a read-only summary.

4. **Given** a mixed template with a running section, **When** the template is expanded in the mesocycle view, **Then** the running section renders editable running-specific fields (run type, pace, HR zone, intervals, coaching cues).

5. **Given** a mixed template with an MMA section, **When** the template is expanded in the mesocycle view, **Then** the MMA section renders an editable duration field.

6. **Given** a mixed template's resistance section, **When** the exercise picker opens, **Then** it filters exercises to `modality = 'resistance'` (matching the section's modality, not a hardcoded value).

7. **Given** a mixed template's running section, **When** the exercise picker opens (if applicable), **Then** it filters exercises matching the section's modality.

8. **Given** a mixed template with multiple sections containing exercises, **When** the user edits an exercise slot in one section, **Then** only that section's slot is modified; other sections remain unchanged.

9. **Given** existing pure resistance templates (no sections), **When** exercises are added or edited, **Then** behavior is unchanged — `section_id` remains null and the exercise picker still defaults to resistance modality.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Adding exercise to a section that was just created (unsaved template) | Section must be persisted before slots can be added; prompt user to save template first |
| Removing the last exercise from a resistance section | Section remains; shows empty-state prompt to add first exercise |
| Mixed template with only resistance sections (no running/MMA) | Each section still renders its own slot editor independently |
| Exercise slot added without section context (legacy data) | Slot with null `section_id` renders at the template level, not inside any section |
| Expanding a mixed template with 5+ sections | All sections render with their modality-specific editors; vertical scrolling within the expanded area |

## Test Requirements

- AC1: Visual — verify section name and modality fields align in the creation form
- AC2: Integration — add exercise to resistance section → query DB → verify `section_id` is set correctly
- AC3: Integration — expand mixed template in mesocycle view → resistance section renders slot editor with add/edit/remove controls
- AC4: Integration — expand mixed template → running section renders editable running fields
- AC5: Integration — expand mixed template → MMA section renders editable duration
- AC6: Integration — exercise picker receives section modality → filters exercises accordingly
- AC8: Integration — edit slot in section A → section B slots unchanged
- AC9: Integration — add slot to pure resistance template → `section_id` is null

## Dependencies

- `specs/mixed-modality-templates.md` — parent spec; this fixes incomplete implementation of ACs 22–27
- `specs/exercise-slots.md` — slot add/edit/remove behavior reused within sections

## Out of Scope

- Drag-reorder of sections themselves (already specified in parent spec)
- Converting single-modality templates to mixed
- Mixed template logging form (separate spec)
- Cascade behavior for section-level edits

## Open Questions

- Should the exercise picker support multi-modality filtering for future section types beyond resistance/running/MMA?
