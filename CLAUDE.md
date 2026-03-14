# Fitness Tracking App

Personal fitness planning + logging app. Desktop for coaching/planning, mobile for post-workout logging. Replaces a 4-sheet Excel system.

## Stack

- **Framework**: Next.js 16 App Router
- **Database**: SQLite (WAL mode) via Drizzle ORM v2
- **UI**: shadcn/ui + Tailwind v4
- **Auth**: JWT via `jose` (Edge-compatible), single-user, env-based credentials
- **Runtime**: Node 20, pnpm, Docker (node:20-alpine)
- **Deploy**: Hostinger VPS, nginx reverse proxy (docker-app-stack)

## Directory Map

```
docs/
  architecture.md      # System overview, data model, API boundaries
  prd.md               # Full PRD with story map and V1 scope
  adr.md               # ADR index (links to docs/adrs/001-008)
  adrs/                # 8 individual architecture decision records
specs/                 # 43 feature specs (status/epic/depends/AC/tests)
.plan/
  IMPLEMENTATION_PLAN.md  # 77 tasks across 15 waves with dependency graph
  progress.md             # Task status table (T0001-T0004, T001-T073)
.sisyphus/plans/
  fitness-app.md       # Detailed execution plan (Prometheus format)
app/                   # Next.js App Router routes (README.md)
lib/                   # Server-side logic — auth, db, exercises, mesocycles, templates (README.md → submodule READMEs)
components/            # Shared React components — nav, forms (README.md)
```

## Commands

**pnpm ONLY — do NOT use npm or yarn. `npm install` will fail (blocked by preinstall hook).**

```bash
pnpm install           # install deps
pnpm dev               # dev server (port 3000)
pnpm build             # production build
pnpm test              # vitest (unit + integration)
pnpm test:unit         # vitest unit only
pnpm test:integration  # vitest integration only
pnpm test:e2e          # playwright
pnpm lint              # eslint
pnpm type-check        # tsc --noEmit
pnpm db:generate       # drizzle-kit generate
pnpm db:migrate        # drizzle-kit migrate
docker compose up -d   # containerized run
```

## Key Conventions

- **Plan/log separation**: templates are mutable config, logs are immutable snapshots
- **Hybrid API** (ADR-004): Server Actions for mutations, Route Handlers for computed reads
- **Drizzle v2**: use `defineRelations` — NOT old `relations()` from expense-tracker
- **Date storage**: `text` YYYY-MM-DD for calendar dates, `integer({ mode: 'timestamp' })` for events
- **JSON columns**: `text({ mode: 'json' }).$type<T>()` with `version` field — never `blob`
- **IDs**: auto-increment integers, no UUIDs
- **Middleware**: NO `better-sqlite3` imports (Edge runtime). JWT via `jose` only.
- **Migrations**: `drizzle-kit generate` then `drizzle-kit migrate`. Never `push`.
- **SQLite PRAGMAs**: `journal_mode=WAL`, `busy_timeout=5000`, `synchronous=NORMAL`, `foreign_keys=ON`
- **Immutability**: no UPDATE/DELETE on logged_workouts, logged_exercises, logged_sets, routine_logs

## Forbidden

- `as any`, `@ts-ignore`, `@ts-expect-error`
- `blob` columns
- `relations()` old API
- `better-sqlite3` in middleware.ts
- `drizzle-kit push` in production
- UUIDs
- Editable logged workouts

## Architecture References

- Core invariant: plan changes cascade via `canonical_name`; logged history frozen at snapshot time
- 10 tables: 6 planning (mutable) + 4 logging (immutable). See `docs/architecture.md` Data Model.
- Auth: single-user, JWT cookie, env vars `AUTH_USERNAME`, `AUTH_PASSWORD_HASH`, `JWT_SECRET`
- Infra: standalone port 3000, orchestrated port 3002. SQLite volume at `/app/data/`
- Sibling apps: expense-tracker (3001), tutor-ai. Shared nginx in docker-app-stack.

## Current Status

Waves 0–9 partially complete (30/77 tasks done). Foundation, auth, exercise library, mesocycle lifecycle, resistance templates, exercise slots, template assignment, mesocycle form, schedule grid UI, status transitions, running/MMA templates, and today's workout API implemented. T024 (template list UI), T045 (API today) in progress. Next up: T028–T030 (slot editing), T033–T034 (schedule tabs + rest day), T046–T047 (today's workout display).
See `.plan/progress.md` for task-level status (77 tasks: 4 infra + 73 feature, 15 waves).
