# Learnings & Conventions

## Project Context
- Greenfield Next.js 16 fitness tracking app
- Replaces 4-sheet Excel system
- Stack: Next.js 16 App Router, SQLite WAL, Drizzle ORM v2, shadcn/ui, Tailwind v4
- Single-user, JWT auth via jose (Edge-compatible)
- Worktree: /home/yaron/projects/personal/servers/hostinger/docker-app-stack/apps/fitness-app-work

## Key Architecture Decisions
- Plan/log separation: templates mutable, logs immutable snapshots
- Hybrid API: Server Actions for mutations, Route Handlers for computed reads
- Cascade: template changes propagate via canonical_name
- Drizzle v2: use defineRelations, NOT old relations()
- Date storage: text YYYY-MM-DD for calendar dates, integer({ mode: 'timestamp' }) for events
- JSON columns: text({ mode: 'json' }).$type<T>() with version field
- IDs: auto-increment integers, NO UUIDs
- Middleware: NO better-sqlite3 imports (Edge runtime). JWT via jose only
- Migrations: drizzle-kit generate then drizzle-kit migrate. Never push

## Forbidden
- as any, @ts-ignore, @ts-expect-error
- blob columns
- relations() old API
- better-sqlite3 in middleware.ts
- drizzle-kit push in production
- UUIDs
- Editable logged workouts

## pnpm ONLY — do NOT use npm or yarn

## [2026-03-09] Task: T0001 — Scaffold Complete
- Next.js version: 16.1.1
- drizzle-orm version: 0.45.1
- better-sqlite3 installed for data layer
- Vitest projects API used (unit + integration projects)
- Vitest 4 projects API: `name` goes inside `test` block, use `extends: true` to inherit root config
- Auth setup: tests/setup/auth.setup.ts
- lib/utils.ts with cn() helper created
- pnpm `onlyBuiltDependencies` needed for native modules (bcrypt, better-sqlite3, esbuild, sharp, unrs-resolver)
- All acceptance criteria passed: lint, type-check, build, test:unit, test:integration, dev+health

## [2026-03-10] Task: T0001 — Scaffold Complete (Verified)
- Next.js version installed: 16.1.1
- drizzle-orm version: 0.45.1
- better-sqlite3 for SQLite data layer
- Vitest 4.0.18 with projects API (unit + integration)
  - Projects API: use `name` inside `test` block, not at project root
  - Test scripts: `pnpm test:unit` runs `vitest run tests/unit`, `pnpm test:integration` runs `vitest run tests/integration`
  - Both unit and integration tests pass
- playwright 1.57 configured with chromium, storageState auth, webServer
- playwright/.auth/ directory created, user.json added to .gitignore
- lib/utils.ts with cn() helper for Tailwind + clsx merging
- All acceptance criteria verified:
  - ✓ pnpm install (no peer dep issues)
  - ✓ pnpm lint (0 errors)
  - ✓ pnpm type-check (0 errors)
  - ✓ pnpm build (.next/standalone/server.js exists)
  - ✓ pnpm test:unit (1 test passed)
  - ✓ pnpm test:integration (1 test passed)
  - ✓ pnpm dev + curl /api/health → {"status":"ok"}
  - ✓ git commit: feat: initialize Next.js 16 project with test infrastructure

## [2026-03-10] T0001 Fix — vitest.config.ts TypeScript Error
- Vitest 4 projects API: `name` goes INSIDE `test` block (not at project root)
- Correct: `{ test: { name: 'unit', include: [...], ... } }`
- Wrong:   `{ name: 'unit', test: { include: [...], ... } }`
- Fixed TypeScript error TS2769 by moving `name` property into `test` block
- All tests pass with corrected config
- Commit amended: feat: initialize Next.js 16 project with test infrastructure

## [2026-03-10] Task: T0003 — GitHub Actions CI/CD Complete
- ci.yml: 4 jobs (lint+typecheck, test, build, e2e) — lint/test/build parallel, e2e needs build
- test job: JWT_SECRET + DATABASE_URL=':memory:' env vars for SQLite in-memory
- build job: .next/cache cached by lockfile+source hash
- e2e job: installs chromium + deps, uploads report on failure
- deploy.yml: triggers on workflow_run CI success on main + manual dispatch
- deploy: SSH via appleboy/ssh-action, git pull, docker compose up --build, healthcheck, prune

## [2026-03-10] Task: T0004 — nginx Config Complete
- fitness-app.conf at infrastructure/nginx/sites/fitness-app.conf in docker-app-stack repo
- Proxies to http://fitness-app:3000 (container name matches docker-compose.production.yml)
- SSL cert path: /etc/letsencrypt/live/fitness.devyaron.cloud/
- Certbot command to provision cert (for later):
  docker compose -f docker-compose.orchestration.yml -f docker-compose.orchestration.prod.yml exec certbot \
    certbot certonly --webroot -w /var/www/certbot -d fitness.devyaron.cloud --email yaron@devyaron.cloud --agree-tos
- After cert: docker compose exec nginx nginx -s reload

## [2026-03-10] Task: Wave1-T1 — SQLite Connection
- lib/db/index.ts: better-sqlite3 + drizzle init, 4 PRAGMAs applied at connection time
- drizzle.config.ts: dialect 'sqlite', schema at lib/db/schema.ts, migrations at lib/db/migrations/
- PRAGMAs: journal_mode=WAL, busy_timeout=5000, synchronous=NORMAL, foreign_keys=ON
- integration test verifies all 4 PRAGMAs return expected values
- DATABASE_URL env var used; defaults to /app/data/db.sqlite
- Schema file (lib/db/schema.ts) not created yet — that's Wave1-T2 and T3
- WAL mode cannot be set on in-memory databases; integration test uses temp file-based DB

## [2026-03-10] Task: Wave1-T2 — Planning Layer Schema
- lib/db/schema.ts: 6 planning tables created
- Calendar dates (start_date, end_date, log_date): text YYYY-MM-DD (NOT integer timestamp)
- Event timestamps (created_at, logged_at): integer({ mode: 'timestamp' })
- boolean columns: integer({ mode: 'boolean' })
- weekly_schedule unique constraint: uniqueIndex on (mesocycle_id, day_of_week, week_type)
- exercise_slots.exercise_id: no cascade (deletion protection at app layer)
- workout_templates.mesocycle_id: cascade delete
- No logging tables here — those are in Task 3

## [2026-03-10] Task: Wave1-T3 — Logging Layer Schema
- 4 logging tables added to lib/db/schema.ts (logged_workouts, logged_exercises, logged_sets, routine_logs)
- logged_workouts: NO FK to workout_templates — template_id is integer (no .references())
- logged_workouts.template_snapshot: text({ mode: 'json' }).$type<{ version: number, ... }>()
- logged_exercises.exercise_id: soft reference (integer, no FK) — snapshotted at log time
- routine_logs unique constraint: uniqueIndex on (routine_item_id, log_date)
- All logging tables immutable by convention (no UPDATE/DELETE in app layer)
- Cross-layer link via canonical_name string match (ADR-006), not DB FK

## [2026-03-10] Task: Wave1-T4 — Drizzle v2 Relations + Migration

### Key Learnings
- **Drizzle v0.45 API**: Uses `relations()` function (NOT `defineRelations()` as mentioned in task description)
- **Relations structure**: Each table gets its own `relations()` call exported separately (e.g., `mesocyclesRelations`, `workout_templatesRelations`)
- **Schema integration**: Pass both schema tables AND relation definitions to `drizzle()` via `{ schema: { ...schema, ...relationsModule } }`
- **Migration generation**: `pnpm db:generate` creates SQL files in `lib/db/migrations/` with proper FK constraints and indexes
- **Migration idempotency**: Second `pnpm db:migrate` run is no-op (safe to run multiple times)
- **Eager loading syntax**: Use `db.query.tableName.findFirst({ with: { relationName: true } })` for eager loading
- **Nested relations**: Can chain `with:` for nested eager loading (e.g., `with: { workout_templates: { with: { exercise_slots: true } } }`)

### Files Created
- `lib/db/relations.ts` — 10 relation definitions using `relations()` API
- `lib/db/migrations/0000_old_old_lace.sql` — Initial schema with all 10 tables, FKs, indexes
- `tests/integration/db/relations.integration.test.ts` — 3 tests verifying eager loading works

### Verification Passed
- ✅ `pnpm type-check` — 0 errors
- ✅ `pnpm db:generate` — creates migration file
- ✅ `pnpm db:migrate` — applies migration (idempotent)
- ✅ `pnpm test:integration` — all 8 tests pass (3 new relation tests + 5 existing)

### Gotchas
- Task description mentioned `defineRelations()` but Drizzle v0.45 uses `relations()` — corrected during implementation
- Vitest alias `@/` doesn't resolve in test imports — used relative paths instead
- Each relation definition must be exported separately (not bundled in single object)

## CRITICAL CORRECTION: drizzle-orm v0.45 Relations API
- `defineRelations` does NOT exist in drizzle-orm v0.45 — it is undefined
- Use `relations()` from 'drizzle-orm' — this IS the correct API for v0.45
- CLAUDE.md/plan says "defineRelations" but installed drizzle-orm v0.45 only exports `relations()`
- Pattern: `import { relations } from 'drizzle-orm'`
- Drizzle init: `drizzle(sqlite, { schema: { ...tables, ...relationDefs } })`
- With: eager loading works: `db.query.tableName.findFirst({ with: { related: true } })`

## [2026-03-10] Task: Wave2-T5 — Auth Config + Credential Validation
- lib/auth/config.ts: reads AUTH_USERNAME, AUTH_PASSWORD_HASH, JWT_SECRET, JWT_EXPIRES_IN
- Lazy validation: getAuthConfig() checks env vars on first access (not module load) to allow tests to set env vars before import
- authConfig object uses getters to trigger lazy validation
- validateCredentials(): timing-safe bcrypt compare (always runs compare even on username mismatch to prevent timing attacks)
- Tests use beforeAll to set env vars + real bcrypt hash before dynamic import
- Tests use vi.resetModules() in afterEach to clear module cache between tests (required for lazy-loaded config)
- Dynamic imports use relative paths (../../../lib/auth/config) not @ alias in vitest
- All 7 credential tests pass: correct creds, wrong password, wrong username, both wrong, missing AUTH_USERNAME, missing AUTH_PASSWORD_HASH, missing JWT_SECRET
