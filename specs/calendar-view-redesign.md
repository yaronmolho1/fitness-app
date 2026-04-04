# Calendar View Redesign

## Description

Redesign the monthly calendar grid for visual coherence: replace full-cell modality background coloring with a left-border accent per workout row, unify single/multi-workout rendering, update the modality color palette, and improve text sizing and spacing.

## Acceptance Criteria

1. **Given** a calendar day with a single workout, **When** the cell renders, **Then** the cell background is neutral (no modality color fill) and the workout displays as a row with a colored left-border accent.
2. **Given** a calendar day with multiple workouts, **When** the cell renders, **Then** each workout displays as a separate row with its own modality-colored left-border accent, stacked vertically.
3. **Given** single-workout and multi-workout days in the same month, **When** the calendar renders, **Then** both use the identical row + left-border rendering style — no visual divergence.
4. **Given** workouts of different modalities (resistance, running, mma, mixed), **When** rendered on the calendar, **Then** each modality has a distinct, cohesive accent color from a unified palette.
5. **Given** a completed workout day, **When** the cell renders, **Then** the green completion checkmark appears regardless of single or multi-workout status.
6. **Given** a deload week day, **When** the cell renders, **Then** the purple ring indicator still displays correctly over the neutral cell background.
7. **Given** the calendar in dark mode, **When** the user views the calendar, **Then** accent colors, backgrounds, and text remain readable with appropriate dark-mode variants.
8. **Given** any calendar cell with workouts, **When** the user reads workout names, **Then** text is at least 0.65rem (up from 0.55rem) for improved readability.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Day with 3+ workouts | Rows stack with left-border accents, cell grows to fit, text truncates if overflow |
| Rest day (no workouts) | Neutral cell, no accent borders, no workout rows |
| Unknown modality (fallback) | Zinc/gray left-border accent applied |
| Day in adjacent month (grayed out) | Maintains neutral style, muted text, no accent borders |
| Mixed + deload combination | Purple ring on cell + individual accent borders on workout rows |

## Test Requirements

- AC1-3: Verify unified rendering — no branching between single/multi display paths
- AC4: Verify all 4 modality accent colors are distinct (palette: slate, teal, rose, indigo)
- AC5: Verify completion marker renders for both single and multi-workout days
- AC6: Verify deload ring class still applied to cell container
- AC7: Visual verification — dark mode rendering
- AC8: Verify workout text size is 0.65rem

## Dependencies

- `lib/ui/modality-colors.ts` — color palette update (same change set)

## Out of Scope

- Day detail panel (side sheet) redesign
- Calendar navigation or month-switching behavior
- Adding new data to calendar cells
- Mobile-specific calendar layout

## Open Questions

- None
