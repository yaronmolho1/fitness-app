# mesocycles/

List and detail pages for mesocycle management.

## Files
- `page.tsx` — list page: fetches all mesocycles, renders status/dates/weeks summary cards, links to `/mesocycles/new`

## Subdirectories
- `[id]/` — detail page: single mesocycle view with back-navigation, 404 on missing ID
- `new/` — create page: renders `MesocycleForm`, breadcrumb back to list
