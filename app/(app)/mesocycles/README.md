# mesocycles/

List and detail pages for mesocycle management.

## Files
- `page.tsx` — list page: fetches all mesocycles, renders status/dates/weeks summary cards, links to `/mesocycles/new`

## Subdirectories
- `[id]/` — detail page: fetches mesocycle, schedule, templates, and exercise slots; renders `ScheduleTabs` (normal/deload `ScheduleGrid`), `TemplateSection` (with `SlotList`); 404 on missing/invalid ID
- `new/` — create page: fetches non-completed mesocycles for overlap detection, renders `MesocycleForm`, breadcrumb back to list
