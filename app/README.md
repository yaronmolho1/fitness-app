# app/

Next.js App Router entry point. Route groups separate authenticated and public pages.

## Files
- `layout.tsx` — root layout with global styles

## Subdirectories
- `(app)/` — authenticated routes: dashboard, exercises, mesocycles, future calendar/routines
- `(auth)/` — public routes: login page ([README](./(auth)/README.md))
- `api/` — route handlers: auth, health, today, progression, calendar ([README](./api/README.md))
