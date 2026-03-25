# (app)/

Authenticated route group. All routes require JWT auth via middleware.

## Files
- `layout.tsx` — app shell with sidebar (desktop) and bottom bar (mobile)
- `page.tsx` — dashboard / home page

## Subdirectories
- `exercises/` — exercise library CRUD
- `mesocycles/` — mesocycle management, templates, schedules
- `progression/` — exercise progression charts (planned vs actual)
- `routines/` — routine management and items
- `calendar/` — projected month calendar grid, color-coded by workout modality
- `coaching/` — coaching overview: active mesocycle status, week navigation, daily slot cards
