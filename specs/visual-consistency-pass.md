# Visual Consistency Pass

**Status:** draft
**Epic:** UI Redesign
**Depends:** specs/layout-system.md, specs/ui-overhaul-shadcn-theme.md

## Description

Normalize visual patterns across all pages: extract hardcoded modality colors to a shared utility, standardize card styling, ensure consistent empty states, and add progressive padding for wider viewports.

## Acceptance Criteria

### Modality colors

1. **Given** any component that displays modality-specific colors (calendar cells, badges, template cards), **When** it determines the color, **Then** it reads from a single shared color mapping (not inline Tailwind classes).
2. **Given** the shared modality color mapping, **When** dark mode is active, **Then** the mapping provides appropriate dark mode variants without inline `dark:` overrides in each component.
3. **Given** a new modality is added in the future, **When** a developer updates the color mapping, **Then** all components automatically pick up the new color.

### Card normalization

4. **Given** any card rendered on any page, **When** it renders, **Then** it uses consistent border-radius (`rounded-xl`) and shadow (`shadow-sm`).
5. **Given** any card header with an action (edit, delete, toggle), **When** the card renders, **Then** the action control is positioned consistently in the top-right of the card header.
6. **Given** any card, **When** it renders in both light and dark mode, **Then** the card background, border, and shadow use theme tokens (not hardcoded colors).

### Empty states

7. **Given** any list page (Exercises, Mesocycles, Routines) with no items, **When** the page renders, **Then** a consistent empty state is shown with an icon, message, and a primary action button.
8. **Given** the empty state across different pages, **When** compared, **Then** they use the same layout pattern and visual treatment.

### Progressive padding

9. **Given** any page on a small viewport (< 640px), **When** horizontal padding is measured, **Then** it is `1rem` (16px).
10. **Given** any page on a medium viewport (640px - 1024px), **When** horizontal padding is measured, **Then** it is `1.5rem` (24px).
11. **Given** any page on a large viewport (> 1024px), **When** horizontal padding is measured, **Then** it is `2rem` (32px).

### Interactive feedback

12. **Given** any clickable card or list item, **When** the user hovers (desktop) or presses (mobile), **Then** a subtle visual transition occurs (opacity, scale, or background shift).
13. **Given** any interactive transition, **When** it triggers, **Then** the transition duration is consistent across the app.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Modality value not in the color mapping (unknown type) | Falls back to a neutral/gray color; does not throw or render broken |
| Card with no header actions | Card header renders normally without empty action area |
| Empty state on a page that also has filters | Empty state appears below filters; filters remain interactive |
| Transition on a disabled button | No hover/press transition on disabled elements |

## Test Requirements

- AC1-3: Unit — verify modality color mapping returns correct values for all known modalities and a fallback for unknown
- AC4-6: Visual — verify card styling consistency across all pages in both themes
- AC7-8: E2E — verify empty state renders on each list page when no items exist
- AC9-11: Visual — verify progressive padding at 3 viewport widths
- AC12-13: Visual — verify hover/press transitions on interactive elements

## Dependencies

- `specs/layout-system.md` — container and padding system used as foundation
- `specs/ui-overhaul-shadcn-theme.md` — theme tokens and card primitives

## Out of Scope

- New shadcn component installations (Drawer, Accordion — separate if needed)
- Animation/motion system beyond hover/press feedback
- Responsive grid breakpoint extraction (per-component decision)
- Loading skeleton improvements (already addressed in ui-overhaul spec)

## Open Questions

- None
