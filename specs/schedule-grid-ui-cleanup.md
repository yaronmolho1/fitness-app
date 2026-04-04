# Schedule Grid UI Cleanup

## Description

Polish the weekly schedule grid in mesocycle detail view: replace text action buttons with compact icons, pin "Add Workout" to the bottom of each day column, and ensure consistent spacing across cells.

## Acceptance Criteria

1. **Given** a mesocycle weekly schedule is displayed, **When** the user views workout entries, **Then** each entry shows pencil and trash icon buttons instead of text "Edit" and "Remove" buttons.
2. **Given** day columns have different numbers of workout entries, **When** the schedule grid renders, **Then** all "Add Workout" buttons are vertically aligned at the bottom of their respective columns.
3. **Given** a day column with zero workout entries (rest day), **When** the schedule grid renders, **Then** the "Add Workout" button is pinned to the bottom of a cell with consistent minimum height.
4. **Given** a rotation entry with a popover, **When** the user opens the popover, **Then** the "Edit Rotation" and "Remove" actions display as icon buttons matching the regular entry style.
5. **Given** the mesocycle is completed, **When** the schedule grid renders, **Then** no action buttons (icons or Add) are visible.
6. **Given** the user clicks a pencil icon, **When** the edit form opens inline, **Then** the form renders correctly within the flex-column layout.
7. **Given** a mobile viewport (< md breakpoint), **When** the schedule grid renders as single column, **Then** cells maintain consistent internal spacing and icon button sizing.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Day with 5+ workout entries | Cell grows taller, Add button stays pinned at bottom below all entries |
| Add form open on one day | Other days' Add buttons remain aligned at their respective bottoms |
| Edit form open on an entry | Other entries' icon buttons remain visible and functional |
| Rapid click on trash icon | Button disables during pending transition, prevents double-removal |

## Test Requirements

- AC1: Visual verification — icon buttons render with correct aria-labels ("Edit assignment", "Remove assignment")
- AC2: Visual verification — Add buttons aligned across columns with different entry counts
- AC3: Visual verification — empty day cell has min-height and bottom-pinned Add button
- AC4: Visual verification — rotation popover shows icon buttons
- AC5: Existing tests — completed mesocycle hides action buttons (no changes needed)
- AC6: Manual test — edit form opens and saves correctly within new layout
- AC7: Responsive test — mobile layout maintains proper spacing

## Dependencies

- None — self-contained change to `components/schedule-grid.tsx`

## Out of Scope

- Changing the add/edit form layout or fields
- Modifying rotation editor modal internals
- Changing the schedule grid column structure (7-day layout)
- Mobile-specific layout redesign

## Open Questions

- None
