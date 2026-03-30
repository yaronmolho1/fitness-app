# app/

Next.js App Router entry point. Route groups separate authenticated and public pages.

## Files
- `layout.tsx` — root layout with global styles

## Subdirectories
- `(app)/` — authenticated routes: calendar, coaching, exercises, mesocycles, progression, routines, settings
- `(auth)/` — public routes: login page ([README](./(auth)/README.md))
- `api/` — route handlers: auth, calendar, coaching, google, health, progression, today ([README](./api/README.md))
