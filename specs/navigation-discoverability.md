# Navigation & Discoverability
**Status:** planned
**Epic:** Navigation & Discoverability
**Depends:** specs/app-shell-navigation.md

## Description
Improve navigation by adding Progression to main nav, providing quick-links from calendar and today to template editing, and ensuring CRUD access is always reachable.

## Acceptance Criteria

### Progression in main nav
- [ ] A "Progression" nav item is added to the main navigation after "Calendar"
- [ ] Uses the `TrendingUp` (or similar chart) icon from lucide-react
- [ ] Links to `/progression`
- [ ] Active state highlights correctly when on the progression page
- [ ] Appears in both desktop sidebar and mobile sheet nav

### Quick links from Today page
- [ ] When viewing today's workout, a pencil/edit icon links to the template detail within the mesocycle page
- [ ] The link navigates to `/mesocycles/[id]` with the relevant template section scrolled into view (or anchor)
- [ ] If no active mesocycle, a prompt links to `/mesocycles` to create or activate one

### Quick links from Calendar
- [ ] When drilling into a calendar day, a link to "Edit template" appears next to the workout name
- [ ] The link navigates to the template within its mesocycle detail page
- [ ] Rest days show a link to the schedule grid for the active mesocycle

### Navigation ordering
- [ ] Nav items ordered: Today, Exercises, Mesocycles, Calendar, Progression, Routines
- [ ] Order is consistent between desktop sidebar and mobile sheet

## Edge Cases
- No active mesocycle: Today page shows "No active mesocycle" with link to create one
- Completed mesocycle: edit links are hidden (read-only protection)
- Progression page with no logged workouts: empty state with guidance

## Test Requirements
- Progression nav item renders and links correctly
- Edit links from Today page navigate to correct mesocycle/template
- Mobile navigation includes all 6 items
- Active state highlights for progression route
