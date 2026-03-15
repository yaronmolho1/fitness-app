# UI Overhaul: shadcn Theme & Component Adoption

**Status:** draft
**Epic:** Foundation
**Depends:** specs/app-shell-navigation.md

## Description

Adopt the expense-tracker's visual design system into the fitness app: OKLCH color theme with dark mode, Geist fonts, collapsible sidebar + Sheet mobile nav, shadcn component library expansion, and refactor existing forms/pages to use styled primitives instead of raw HTML elements.

## Acceptance Criteria

### Theme foundation

1. **Given** the app loads, **When** the browser renders any page, **Then** the OKLCH color system is active with CSS custom properties for all semantic tokens (primary, secondary, muted, accent, destructive, background, foreground, card, popover, border, ring, chart-1 through chart-5).
2. **Given** the app loads, **When** the browser renders, **Then** Geist Sans is the primary font and Geist Mono is the monospace font.
3. **Given** a user's system preference is dark mode, **When** the app loads, **Then** the dark mode color palette is applied automatically.
4. **Given** a user is on any page, **When** they toggle the color scheme (via system preference), **Then** the app switches between light and dark palettes without a page reload.
5. **Given** any page renders, **Then** base styles apply: all elements use `border-border` and `outline-ring/50`, body uses `bg-background text-foreground`.

### Providers & feedback

6. **Given** any mutation succeeds or fails, **When** a toast is triggered, **Then** a Sonner toast notification appears with the appropriate message.
7. **Given** the root layout renders, **Then** a Providers wrapper (with QueryClient if needed) and Sonner Toaster are mounted.

### Navigation overhaul

8. **Given** a desktop viewport, **When** the user clicks the sidebar toggle, **Then** the sidebar collapses or expands.
9. **Given** a desktop viewport with collapsed sidebar, **When** the user navigates, **Then** the main content area expands to fill the available width.
10. **Given** a mobile viewport, **When** the user taps the menu button, **Then** a Sheet component slides in from the left with navigation links.
11. **Given** the Sheet nav is open on mobile, **When** the user taps a link or taps outside, **Then** the Sheet closes.
12. **Given** any viewport, **When** any nav renders, **Then** the same 5 sections are listed: Today, Exercises, Mesocycles, Calendar, Routines.
13. **Given** any viewport, **When** the user is on a route, **Then** the corresponding nav item shows an active indicator.
14. **Given** the mobile viewport, **Then** a top header bar is visible with a menu toggle (left) and logout (right).
15. **Given** any viewport, **Then** a logout control is accessible from the navigation.

### shadcn component installation

16. **Given** the component library, **Then** the following shadcn/ui components are installed and available: select, checkbox, dialog, alert-dialog, tabs, sheet, dropdown-menu, popover, badge, skeleton, textarea.
17. **Given** any installed component, **Then** it uses the project's OKLCH theme tokens (no hardcoded colors).

### Form refactoring

18. **Given** the exercise form, **When** the user selects modality or muscle group, **Then** a styled Select component renders instead of a raw HTML `<select>`.
19. **Given** the mesocycle form, **When** the user toggles the deload checkbox, **Then** a styled Checkbox component renders instead of a raw HTML `<input type="checkbox">`.
20. **Given** the mesocycle form, **When** the user picks a start date, **Then** a styled date input renders (consistent with theme, not browser-default chrome).
21. **Given** the schedule tabs (normal/deload), **When** the user switches tabs, **Then** a styled Tabs component renders instead of custom div-based tab switching.

### Status indicators

22. **Given** any status badge (planned/active/completed), **Then** it uses the Badge component with semantic theme tokens instead of hardcoded Tailwind color classes.
23. **Given** a loading state on any page, **Then** Skeleton components are used for placeholder UI instead of `animate-pulse` divs.

### Visual consistency

24. **Given** any page renders, **Then** cards use consistent `rounded-xl` borders with `shadow-sm`.
25. **Given** any page renders, **Then** spacing follows the expense-tracker pattern: generous `gap-4`/`gap-6` padding, `max-w-4xl` page containers.
26. **Given** any interactive element, **Then** hover/focus states use theme-consistent transitions.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| System color scheme changes while app is open | Theme switches without reload; no flash of wrong colors |
| Sidebar state persists across navigations | Collapsed/expanded preference survives route changes within the session |
| Sheet nav open + viewport resize to desktop | Sheet dismisses, sidebar renders instead |
| Dark mode + status badges | Badges remain readable with appropriate contrast ratios |
| Geist font fails to load | Falls back to system sans-serif; layout does not break |
| Raw HTML elements missed during refactor | No raw `<select>`, `<input type="checkbox">`, or unstyled date inputs remain in the codebase |

## Test Requirements

- AC1-5: Visual — verify theme tokens applied in globals.css and rendered pages
- AC6: Integration — trigger a server action; verify Sonner toast renders
- AC7: Unit — verify Providers component mounts Toaster
- AC8-9: E2E — toggle sidebar on desktop viewport; verify collapse/expand and content reflow
- AC10-11: E2E — tap menu on mobile viewport; verify Sheet opens and closes
- AC12-15: E2E — verify nav items, active state, logout on both viewports
- AC16-17: Unit — verify each component exists and uses theme tokens
- AC18-21: E2E — open each form; verify styled components render (no raw HTML form elements)
- AC22: Visual — verify Badge component renders for all 3 statuses with theme colors
- AC23: E2E — verify Skeleton renders during loading states
- AC24-26: Visual — verify consistent card styling, spacing, transitions

## Dependencies

- `specs/app-shell-navigation.md` — this spec supersedes the desktop sidebar and mobile bottom bar sections; health endpoint and route group structure remain unchanged

## Out of Scope

- Charts / recharts integration
- Dark mode manual toggle (system preference only for now)
- PageHeader reusable component (can be added later)
- CollapsibleFilter component
- Multi-select component
- Date range picker / month-year picker
- Table component (no data tables in current pages)

## Open Questions

None — resolved:
- Sidebar collapsed state persists to localStorage
- Bottom bar replaced entirely with top header + Sheet (expense-tracker pattern)
