# lib/

Server-side business logic, database, and auth.

## Files
- `utils.ts` — `cn()` Tailwind class merge utility

## Subdirectories
- `auth/` — JWT authentication, credentials, logout ([README](./auth/README.md))
- `db/` — SQLite connection, Drizzle schema, relations, migrations ([README](./db/README.md))
- `exercises/` — Exercise CRUD actions and queries ([README](./exercises/README.md))
- `mesocycles/` — Mesocycle lifecycle and date utils ([README](./mesocycles/README.md))
- `templates/` — Workout template actions and canonical naming ([README](./templates/README.md))
- `schedule/` — Weekly schedule assignment actions (assign/remove template per day slot) ([README](./schedule/README.md))
- `routines/` — Routine item CRUD actions (create/update/delete with auto-ordering) ([README](./routines/README.md))
- `today/` — Today workout lookup query (active meso → schedule → template + slots) ([README](./today/README.md))
- `workouts/` — Workout logging: save workout Server Action with validation, template snapshot, and atomic inserts ([README](./workouts/README.md))
