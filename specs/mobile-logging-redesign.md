# Mobile Logging Redesign

**Status:** draft
**Epic:** UI Redesign
**Depends:** specs/actual-set-input.md, specs/pre-filled-resistance-logging.md, specs/add-remove-sets.md, specs/workout-rating-notes.md

## Description

Redesign the resistance workout logging form for comfortable post-gym mobile use. Reduce the set input grid from 5 columns to 3, move RPE from per-set to per-exercise, and ensure all interactive elements meet 44px minimum touch target guidelines.

## Acceptance Criteria

### Set input grid

1. **Given** the resistance logging form on a mobile viewport, **When** set rows render, **Then** each row displays exactly 3 interactive columns: weight input, reps input, and delete button.
2. **Given** a set row, **When** the weight input renders, **Then** it is wide enough for 5+ characters (e.g. "120.5") without truncation.
3. **Given** a set row, **When** the reps input renders, **Then** it is wide enough for 3+ characters without truncation.
4. **Given** a set row, **When** the set number renders, **Then** it is displayed as a non-interactive label to the left of the inputs.
5. **Given** a set row, **When** the planned values (target weight, target reps) are available, **Then** they are shown as placeholder text inside the input fields rather than as a separate reference row.

### RPE per exercise

6. **Given** an exercise section in the logging form, **When** all set rows are displayed, **Then** a single RPE input appears below the sets for the entire exercise.
7. **Given** the per-exercise RPE input, **When** it renders, **Then** it displays as a row of tappable buttons numbered 1 through 10.
8. **Given** the per-exercise RPE input, **When** the user taps a number, **Then** that number is selected and visually highlighted.
9. **Given** the per-exercise RPE input, **When** the user taps the already-selected number, **Then** the selection is cleared (RPE becomes unset).
10. **Given** the per-exercise RPE input, **When** no RPE is selected, **Then** it is stored as null (RPE is optional).
11. **Given** a workout is saved, **When** RPE data is stored, **Then** the RPE value is stored once per exercise (on the logged_exercise record), not per set.

### Touch targets

12. **Given** any interactive element in the logging form, **When** it renders on mobile, **Then** its tappable area is at least 44px × 44px.
13. **Given** the delete set button, **When** it renders, **Then** its tappable area is at least 44px × 44px (visual size may be smaller with padding extending the hit area).
14. **Given** the "Add Set" button, **When** it renders, **Then** its height is at least 44px.
15. **Given** the workout rating stars, **When** they render, **Then** each star's tappable area is at least 44px × 44px.

### Save button

16. **Given** the logging form, **When** the user scrolls, **Then** the save button remains fixed at the bottom of the viewport.
17. **Given** the fixed save button, **When** it renders, **Then** it accounts for the bottom navigation bar height (no overlap).
18. **Given** the fixed save button, **When** it renders on devices with a home indicator, **Then** safe area insets are respected.

### Input ergonomics

19. **Given** the weight input on mobile, **When** the user taps it, **Then** a decimal numeric keyboard appears.
20. **Given** the reps input on mobile, **When** the user taps it, **Then** a numeric keyboard appears.
21. **Given** any numeric input, **When** the user finishes entering a value, **Then** tapping the next input in sequence is reachable without scrolling (within the same exercise section).

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Exercise with 8+ sets | All sets render in the scrollable area; no horizontal overflow; RPE stays at the bottom of that exercise's section |
| Exercise with target_weight = null | Weight input placeholder shows "—" not "0" |
| RPE buttons on very narrow viewport (<340px) | Buttons wrap to 2 rows of 5 rather than overflowing horizontally |
| User taps save with RPE unset for some exercises | Save succeeds; null RPE stored for those exercises |
| Landscape orientation on mobile | Form remains usable; inputs do not overflow |
| Delete last remaining set | Prevented; at least 1 set must remain per exercise |

## Test Requirements

- AC1-4: E2E — verify 3-column grid layout on mobile viewport; measure column widths
- AC5: E2E — verify planned values appear as placeholders, not separate rows
- AC6-11: E2E — verify RPE renders per exercise, tap to select/deselect works, stored on logged_exercise
- AC12-15: E2E — verify all touch targets meet 44px minimum on mobile viewport
- AC16-18: E2E — verify sticky save button positioning and safe area handling
- AC19-20: Unit — verify inputMode attributes on weight and reps inputs

## Dependencies

- `specs/actual-set-input.md` — **supersedes** per-set RPE; RPE moves from `logged_sets` to `logged_exercises`
- `specs/pre-filled-resistance-logging.md` — retains pre-fill behavior; changes display from reference row to placeholder
- `specs/add-remove-sets.md` — retains add/remove behavior; changes button sizing
- `specs/workout-rating-notes.md` — rating stars get larger touch targets

## Out of Scope

- Running logging form redesign (separate effort if needed)
- MMA/BJJ logging form redesign (minimal — already simple)
- Swipeable set navigation (evaluated, deferred)
- Draft persistence / auto-save
- Per-set RPE (replaced by per-exercise RPE)

## Open Questions

- RPE migration: existing `logged_sets.actual_rpe` column needs a migration to move data to `logged_exercises`. Does any logged data exist yet that would need migration? If not, column can be dropped and re-added on `logged_exercises`.
