# Layout System

**Status:** draft
**Epic:** UI Redesign
**Depends:** specs/app-shell-navigation.md, specs/ui-overhaul-shadcn-theme.md

## Description

Establish a consistent layout system across all pages with shared container, header, and spacing primitives. Desktop planning pages use wider containers; mobile logging pages use narrower containers optimized for single-hand use.

## Acceptance Criteria

### Page container

1. **Given** any page renders on a mobile viewport, **When** the content area is measured, **Then** horizontal padding is `1rem` (16px) on each side.
2. **Given** a mobile-focused page (Today, Routines), **When** the content area is measured, **Then** the max content width does not exceed `32rem` (512px / max-w-lg) and is centered.
3. **Given** a desktop-focused page (Exercises, Mesocycles, Calendar, Progression), **When** the content area is measured on a desktop viewport, **Then** the max content width does not exceed `56rem` (896px / max-w-4xl) and is centered.
4. **Given** any page, **When** the viewport is wider than the max content width, **Then** the content is horizontally centered with equal margins.
5. **Given** any page, **When** the content area renders, **Then** vertical padding is `1.5rem` (24px) top and bottom.

### Page header

6. **Given** any page with a title, **When** the header area renders, **Then** the page title and optional action buttons are displayed in a consistent layout.
7. **Given** a page header on a mobile viewport, **When** action buttons are present, **Then** they stack below the title (not inline) to avoid horizontal overflow.
8. **Given** a page header on a desktop viewport, **When** action buttons are present, **Then** they render inline to the right of the title.
9. **Given** any page header, **When** a description is provided, **Then** it renders as muted text below the title.
10. **Given** any page, **When** the header renders, **Then** consistent vertical spacing separates the header from the first content section.

### Spacing normalization

11. **Given** any page, **When** top-level content sections render, **Then** vertical spacing between sections is `1.5rem` (24px / space-y-6).
12. **Given** any page with cards, **When** cards render, **Then** all cards use identical border-radius and shadow values.
13. **Given** the Calendar page, **When** it renders on desktop, **Then** it uses the same container system as other desktop pages (not full-bleed).
14. **Given** the Progression page, **When** it renders on desktop, **Then** it uses the same container system as other desktop pages.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Very narrow viewport (<320px) | Content remains usable with no horizontal overflow; padding scales proportionally |
| Page with no action buttons in header | Header renders title only; no empty space where buttons would be |
| Page with very long title | Title wraps naturally; does not truncate or overflow |
| Desktop viewport at exactly the breakpoint | Only one layout variant renders; no flash or double-render |

## Test Requirements

- AC1-5: Visual — verify container widths and padding on mobile and desktop viewports
- AC6-10: E2E — verify page header renders title, description, and actions correctly on both viewports
- AC11-12: Visual — verify consistent spacing and card styling across all pages
- AC13-14: E2E — verify Calendar and Progression pages use the container system

## Dependencies

- `specs/app-shell-navigation.md` — layout wraps within the existing nav shell
- `specs/ui-overhaul-shadcn-theme.md` — uses established theme tokens for colors and shadows

## Out of Scope

- Dark mode toggle (system-only per existing spec)
- Bottom bar redesign (existing implementation retained)
- New page routes or navigation items
- Responsive grid patterns within page content (handled per-component)

## Open Questions

- None
