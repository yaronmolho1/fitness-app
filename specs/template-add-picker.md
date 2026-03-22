# Template Add Picker

**Status:** done
**Epic:** Template UX
**Depends:** specs/create-resistance-templates.md, specs/mixed-modality-templates.md, specs/template-copy-from-existing.md

## Description

Replace the inline row of 4 template-type buttons (+ Resistance, + Running, + MMA/BJJ, + Mixed) with a single "Add" button that opens a picker. On mobile this saves vertical space and provides a cleaner entry point; on desktop it keeps the same streamlined flow. The picker also includes a "From Existing" option that triggers the template copy flow.

## Acceptance Criteria

1. **Given** a mesocycle detail page with a non-completed mesocycle, **When** I view the templates section, **Then** I see a single "Add Template" button instead of 4 separate type buttons.
2. **Given** I tap "Add Template", **When** the picker opens, **Then** I see options: Resistance, Running, MMA/BJJ, Mixed Workout, and "From Existing".
3. **Given** I select a template type (Resistance/Running/MMA/Mixed), **When** the picker closes, **Then** the corresponding creation form appears inline (existing behavior preserved).
4. **Given** I select "From Existing", **When** the picker closes, **Then** the template copy flow is triggered (see `specs/template-copy-from-existing.md`).
5. **Given** a completed mesocycle, **When** I view the templates section, **Then** the "Add Template" button is not shown.
6. **Given** I open the picker and tap outside or press escape, **When** the picker dismisses, **Then** no form appears and no state changes.
7. **Given** I am on mobile (viewport < 640px), **When** the picker opens, **Then** it renders as a bottom sheet or action sheet (touch-friendly, items ≥ 44px height).
8. **Given** I am on desktop (viewport ≥ 640px), **When** the picker opens, **Then** it renders as a dropdown popover anchored to the button.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Mesocycle has no templates yet | "Add Template" button shown alongside empty-state prompt |
| Picker opened then page navigated away | Picker dismissed, no side effects |
| Rapid double-tap on "Add Template" | Picker opens once, no duplicate renders |

## Test Requirements

- AC1: component — "Add Template" button renders instead of 4 type buttons
- AC2: component — picker shows all 5 options
- AC3: component — selecting a type renders the correct form
- AC5: component — button hidden on completed mesocycles
- AC7-8: component — responsive rendering (bottom sheet vs popover)

## Dependencies

- `specs/create-resistance-templates.md` — creation forms remain unchanged
- `specs/mixed-modality-templates.md` — mixed creation form unchanged
- `specs/template-copy-from-existing.md` — "From Existing" triggers copy flow

## Out of Scope

- Changing the template creation forms themselves
- Reordering or filtering template types
- Desktop sidebar or separate templates page
