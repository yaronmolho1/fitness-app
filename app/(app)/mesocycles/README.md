# mesocycles/

List and detail pages for mesocycle management.

## Files
- `page.tsx` — list page: fetches all mesocycles, renders status/dates/weeks summary cards, links to `/mesocycles/new`

## Subdirectories
- `[id]/` — detail page: fetches mesocycle, schedule, and templates; renders `ScheduleGrid`; 404 on missing/invalid ID
- `new/` — create page: renders `MesocycleForm`, breadcrumb back to list
