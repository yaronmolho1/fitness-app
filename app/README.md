# app/

Next.js App Router entry point. Route groups separate authenticated and public pages.

## Files
- `layout.tsx` — root layout with global styles

## Subdirectories
- `(app)/` — authenticated routes: dashboard, exercises, mesocycles, future calendar/routines
- `(auth)/` — public routes: login page
- `api/` — route handlers: auth (login/logout), health check, today workout
