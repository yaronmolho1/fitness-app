# Fitness Tracking App — V1 Implementation Plan

## TL;DR

> **Summary**: 73 TDD-cycle tasks across 14 waves. Each task maps to one or more acceptance-tested specs. Replaces Excel with template-based workout planning (cascade edits) + immutable snapshot logging. Desktop for coaching/planning, mobile for post-workout logging.
>
> **Stack**: Next.js 16 App Router, SQLite (WAL), Drizzle ORM v2, shadcn/ui, Tailwind v4, Docker
>
> **Estimated Effort**: ~160 hours
> **Parallel Execution**: YES — 14 waves, up to 3 parallel tracks per wave
> **Critical Path**: Schema → Auth → Shell → Mesocycle → Templates → Slots → Schedule → Today's View → Logging → Progression

---

## Context

### Source Documents
- **PRD**: `docs/prd.md`
- **Architecture**: `docs/architecture.md` (10-table schema, hybrid API, JWT auth, plan/log separation)
- **ADRs**: `docs/adrs/001-008` (SQLite, mesocycle-scoped templates, deload schedule, hybrid API, snapshots, canonical_name, Drizzle v2, modular arch)
- **Specs**: `specs/*.md` — 43 individual feature specs with acceptance criteria, edge cases, and test requirements

### Key Architecture Decisions
- **Plan/Log separation**: templates are mutable config, logs are permanent snapshot records
- **Hybrid API**: Server Actions for mutations, Route Handlers for computed reads (ADR-004)
- **Cascade**: template changes propagate via `canonical_name` across active/planned mesocycles
- **Snapshot**: at log time, template state is frozen into JSON + normalized rows atomically
- **Drizzle v2**: use `defineRelations` API, NOT old `relations()` from expense-tracker

### Implementation Conventions
- Date storage: `integer({ mode: 'timestamp' })` for events, `text` for calendar dates (YYYY-MM-DD)
- JSON columns: `text({ mode: 'json' }).$type<T>()` with `version: number` field
- IDs: auto-increment integers, no UUIDs
- Middleware: NO `better-sqlite3` imports (Edge runtime). JWT via `jose` only.
- Migrations: `drizzle-kit generate` then `drizzle-kit migrate`. Never `push`.

---

## Work Objectives

### Definition of Done
- [ ] `docker compose up` starts app on port 3000
- [ ] Can create mesocycle → templates → exercises → weekly schedule
- [ ] Editing a template cascades to future unlogged instances
- [ ] Logging a workout freezes it as an immutable snapshot
- [ ] Calendar shows projected workouts, color-coded by modality
- [ ] Mobile today's view works for post-workout logging (<2 min flow)
- [ ] Daily routines trackable with flexible scoping
- [ ] All Vitest + Playwright tests pass

### Must NOT Have
- NO `as any`, `@ts-ignore`, `@ts-expect-error`
- NO `blob` columns, NO `relations()` old API
- NO `better-sqlite3` in middleware.ts
- NO `drizzle-kit push` in production
- NO UUIDs (single user, auto-increment)
- NO editable logged workouts (immutable after save)

---

## Verification Strategy

- **Unit/Integration**: Vitest with test database
- **E2E**: Playwright against localhost:3000
- **Each task**: TDD cycle — write test, implement, refactor
- **Specs have test requirements**: each spec lists required unit, integration, and E2E tests

---

## Execution Strategy

### Critical Path (spec level)
```
db-schema → auth → app-shell → create-mesocycle → resistance-templates
→ exercise-slots (+ exercise-search-filter) → 7-day-grid (+ mesocycle-status)
→ view-todays-workout → pre-filled-logging → log-immutability
→ exercise-progression-chart → phase-boundary-markers
```

### Wave Summary
| Wave | Tasks | Parallel Tracks | Depends On |
|------|-------|-----------------|------------|
| 1 | T001-T004 | 1 | — |
| 2 | T005-T009 | 1 | Wave 1 |
| 3 | T010-T012 | 1 | Wave 2 |
| 4 | T013-T017 | 1 (Exercise Library) | Wave 3 |
| 5 | T018-T022 | 1 (Mesocycle) ∥ Wave 4 | Wave 3 |
| 6 | T023-T026 | 3 (Resistance ∥ Running ∥ MMA) | Wave 5 |
| 7 | T027-T034 | 2 (Slots ∥ Schedule) | Wave 4+6 |
| 8 | T035-T044 | 3 (Cascade ∥ Clone ∥ Routines) | Wave 7 |
| 9 | T045-T047 | 1 | Wave 7+5 |
| 10 | T048-T053 | 1 (Resistance logging) | Wave 9 |
| 11 | T054-T057 | 1 (Running+MMA logging) ∥ Wave 10 | Wave 9 |
| 12 | T058-T063 | 1 | Wave 10+11 |
| 13 | T064-T071 | 2 (Calendar ∥ Progression) | Wave 12 |
| 14 | T072-T073 | 1 | Wave 12 |

---

## TODOs

### Wave 1 — Database Foundation

- [ ] 1. SQLite Connection + PRAGMAs

  **Spec**: `specs/db-schema-migrations.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: — | **Blocks**: T002, T003

  Create `lib/db/index.ts` with SQLite connection. Apply 4 PRAGMAs on every init: `journal_mode=WAL`, `busy_timeout=5000`, `synchronous=NORMAL`, `foreign_keys=ON`. Database path from `DATABASE_URL` env var (default `/app/data/db.sqlite`).

  **Acceptance**:
  - [ ] All 4 PRAGMAs return expected values after connection
  - [ ] WAL mode confirmed: `PRAGMA journal_mode` → `wal`
  - [ ] FK enforcement active: `PRAGMA foreign_keys` → `1`
  - [ ] Missing DATABASE_URL → clear startup error

  **Commit**: `feat: add SQLite connection with WAL mode + PRAGMAs`

- [ ] 2. Planning Layer Schema (6 tables)

  **Spec**: `specs/db-schema-migrations.md`
  **Category**: `deep` | **Skills**: []
  **Deps**: T001 | **Blocks**: T004

  Create `lib/db/schema.ts` with 6 planning tables: `exercises` (name unique, modality enum), `mesocycles` (status enum, dates as text YYYY-MM-DD), `workout_templates` (canonical_name, modality, mesocycle FK with cascade), `exercise_slots` (template FK cascade, exercise FK no-cascade, all target fields), `weekly_schedule` (unique constraint on meso+day+week_type), `routine_items` (flexible scope fields).

  All PKs auto-increment integer. Calendar dates as text. Timestamps as `integer({ mode: 'timestamp' })`. See spec for exact column definitions.

  **Acceptance**:
  - [ ] All 6 tables created with correct columns, FKs, constraints
  - [ ] FK cascade delete works: delete mesocycle → templates + slots gone
  - [ ] Unique constraints enforced: exercises.name, weekly_schedule(meso,day,week_type)

  **Commit**: grouped with T003, T004

- [ ] 3. Logging Layer Schema (4 tables)

  **Spec**: `specs/db-schema-migrations.md`
  **Category**: `deep` | **Skills**: []
  **Deps**: T001 | **Blocks**: T004

  Add 4 logging tables to schema: `logged_workouts` (template_snapshot as `text({ mode: 'json' }).$type<T>()` with version field, canonical_name as text — NO FK to templates), `logged_exercises` (logged_workout FK cascade, snapshotted exercise_name), `logged_sets` (logged_exercise FK cascade, actual values), `routine_logs` (routine_item FK cascade, unique constraint on item+date).

  **Acceptance**:
  - [ ] All 4 tables created with correct columns
  - [ ] No FK from logged_workouts to workout_templates
  - [ ] JSON round-trip: insert template_snapshot object, read back with version field intact
  - [ ] Timestamp round-trip: insert Date, read back as Date

  **Commit**: grouped with T002, T004

- [ ] 4. Drizzle v2 Relations + Migration

  **Spec**: `specs/db-schema-migrations.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T002, T003 | **Blocks**: T005, T011

  Create `lib/db/relations.ts` using `defineRelations` v2 API (NOT old `relations()`). All 9 relation pairs per spec. Pass relations config to `drizzle()` init. Create `drizzle.config.ts`. Run `drizzle-kit generate` + `drizzle-kit migrate`. Verify idempotent re-run.

  **Acceptance**:
  - [ ] `defineRelations` used (not `relations()`)
  - [ ] `with:` eager loading works
  - [ ] Migration generated and applied
  - [ ] Re-running migrate is a no-op

  **Commit**: `feat: add Drizzle schema (10 tables), relations, initial migration`

### Wave 2 — Auth

- [ ] 5. Env Config + Credential Validation

  **Spec**: `specs/auth-system.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T004 | **Blocks**: T006, T007

  Read `AUTH_USERNAME`, `AUTH_PASSWORD_HASH`, `JWT_SECRET`, `JWT_EXPIRES_IN` (default 7d) from env. Fail if required vars missing. Implement credential validation: bcrypt compare with timing-safe comparison. No early-exit string comparison.

  **Acceptance**:
  - [ ] Missing required env vars → app fails to start or login always fails
  - [ ] Correct password → validation passes
  - [ ] Wrong password → validation fails (timing-safe)

  **Commit**: grouped with T006-T009

- [ ] 6. JWT Issuance + Verification (jose)

  **Spec**: `specs/auth-system.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T005 | **Blocks**: T007, T008

  JWT via `jose` library (Edge-compatible). Payload: `sub` (username), `iat`, `exp`. Sign with `JWT_SECRET`. Expiry from `JWT_EXPIRES_IN`. Verify: accept valid, reject expired, reject tampered signature.

  **Acceptance**:
  - [ ] Issued JWT contains sub, iat, exp
  - [ ] Verify valid JWT → success
  - [ ] Verify expired JWT → rejection
  - [ ] Verify tampered JWT → rejection

  **Commit**: grouped with T005, T007-T009

- [ ] 7. Login/Logout API Routes + Cookie

  **Spec**: `specs/auth-system.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T005, T006 | **Blocks**: T008, T009

  `POST /api/auth/login`: validate credentials, issue JWT, set cookie (`auth-token`, httpOnly, secure, sameSite=lax, expiry matches JWT). Invalid creds → generic "Invalid credentials" error (no username/password distinction). `POST /api/auth/logout`: clear cookie.

  **Acceptance**:
  - [ ] Valid login → auth-token cookie set with correct attributes
  - [ ] Invalid login → no cookie, generic error message
  - [ ] Logout → cookie cleared

  **Commit**: grouped with T005, T006, T008, T009

- [ ] 8. Auth Middleware (Edge, Route Protection)

  **Spec**: `specs/auth-system.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T006 | **Blocks**: T009, T010

  `middleware.ts` at project root. Validates JWT via `jose` on every request. NO `better-sqlite3` imports (Edge runtime). Protect all `/(app)` routes. Public routes: `/login`, `/api/auth/*`, `/api/health`. Unauthenticated → redirect `/login`. Authenticated on `/login` → redirect app home. Expired/tampered JWT → redirect `/login`.

  **Acceptance**:
  - [ ] Protected route without cookie → redirect /login
  - [ ] Protected route with valid cookie → pass through
  - [ ] Protected route with expired cookie → redirect /login
  - [ ] /login with valid cookie → redirect to app home
  - [ ] No better-sqlite3 import in middleware.ts

  **Commit**: grouped with T005-T007, T009

- [ ] 9. Login Page UI + Logout Action

  **Spec**: `specs/auth-system.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T007, T008 | **Blocks**: T010

  Login page at `/login`: username field, password field (masked), submit button. Show validation errors inline. Mobile-friendly (no horizontal scroll, touch-friendly). Logout accessible from app shell (not just direct URL).

  **Acceptance**:
  - [ ] Login form renders with username + password fields
  - [ ] Valid creds → redirect to app home
  - [ ] Invalid creds → "Invalid credentials" error shown
  - [ ] Empty fields → client-side validation error
  - [ ] Logout → cookie cleared, redirect to /login

  **Commit**: `feat: add JWT auth system (login, middleware, logout)`

### Wave 3 — App Shell

- [ ] 10. Route Groups (app)/(auth) + Layouts

  **Spec**: `specs/app-shell-navigation.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T008 | **Blocks**: T012, T013, T014

  Create `(app)` route group (authenticated, nav shell) and `(auth)` route group (public, no shell). Root layout wraps `(app)` with navigation. Login page has no nav shell. Main content area for page rendering.

  **Acceptance**:
  - [ ] (app) routes have nav shell, (auth) routes don't
  - [ ] All (app) routes protected by middleware
  - [ ] (auth) routes are public

  **Commit**: grouped with T011, T012

- [ ] 11. Health Endpoint

  **Spec**: `specs/app-shell-navigation.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T004 | **Blocks**: —

  `GET /api/health` Route Handler. Returns `{ status: "ok", db: "connected" }` (200) when DB is live. Returns `{ status: "error", db: "disconnected" }` (503) when DB unreachable. Public route (no auth). Verifies actual DB connection, not static response.

  **Acceptance**:
  - [ ] Live DB → 200 with status ok
  - [ ] DB down → 503 with status error
  - [ ] No auth required

  **Commit**: grouped with T010, T012

- [ ] 12. Navigation (Sidebar + Bottom Bar)

  **Spec**: `specs/app-shell-navigation.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T010 | **Blocks**: T013, T018

  Desktop: persistent sidebar with links (Today, Exercises, Mesocycles, Calendar, Routines) + logout. Mobile: fixed bottom bar with primary section links. CSS breakpoint swap, no layout shift or flash. Active route indicator. Bottom bar doesn't obscure content (safe area).

  **Acceptance**:
  - [ ] Desktop viewport → sidebar visible, bottom bar hidden
  - [ ] Mobile viewport → bottom bar visible, sidebar hidden
  - [ ] Active route visually indicated
  - [ ] Logout accessible from sidebar

  **Commit**: `feat: add app shell with responsive navigation + health endpoint`

### Wave 4 — Exercise Library

- [ ] 13. Create Exercise Server Action + Validation

  **Spec**: `specs/exercise-crud.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T012 | **Blocks**: T014, T015, T016, T017

  Server Action: create exercise with name (required, non-empty after trim, unique case-insensitive), modality (resistance|running|mma, required), muscle_group (optional), equipment (optional). Auto-increment ID, created_at timestamp. Reject whitespace-only names, duplicate names (case-insensitive), invalid modality values.

  **Acceptance**:
  - [ ] Valid data → exercise created
  - [ ] Empty name → validation error
  - [ ] Duplicate name (case-insensitive) → error
  - [ ] Missing modality → validation error

  **Commit**: grouped with T014-T017

- [ ] 14. Exercise List + Empty State + Form UI

  **Spec**: `specs/exercise-crud.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T013 | **Blocks**: T015

  Exercise library page accessible from nav. List all exercises showing name, modality, muscle_group, equipment. Empty state with prompt to create first exercise. Create exercise form (inline or modal). After creation, list revalidated.

  **Acceptance**:
  - [ ] Exercise list displays all exercises
  - [ ] Empty library → empty state shown
  - [ ] Create form submits and list updates

  **Commit**: grouped with T013, T015-T017

- [ ] 15. Edit Exercise Server Action + Form

  **Spec**: `specs/exercise-crud.md`
  **Category**: `unspecified-low` | **Skills**: []
  **Deps**: T013 | **Blocks**: —

  Edit SA: pre-populated form, validate name uniqueness (excluding self), modality changeable, muscle_group/equipment clearable. Same name as current → valid. Name of different exercise → duplicate error. Not-found exercise → error.

  **Acceptance**:
  - [ ] Edit updates exercise and list reflects change
  - [ ] Edit to duplicate name → error
  - [ ] Edit to same name → success

  **Commit**: grouped with T013, T014, T016, T017

- [ ] 16. Delete Exercise + Deletion Protection

  **Spec**: `specs/exercise-crud.md`, `specs/exercise-deletion-protection.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T013 | **Blocks**: —

  Delete SA: confirmation step required. Before delete, check if ANY `exercise_slot` references this exercise (across all mesocycles, including completed). If referenced → block with clear error. If not referenced → delete. App-layer check runs before DELETE; FK constraint is safety net. Protection error doesn't expose SQL details.

  **Acceptance**:
  - [ ] Exercise with no slots → deleted successfully
  - [ ] Exercise with slots (any mesocycle) → blocked with error
  - [ ] Error message is user-friendly, no SQL details

  **Commit**: grouped with T013-T015, T017

- [ ] 17. Exercise Search & Filter

  **Spec**: `specs/exercise-search-filter.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T014 | **Blocks**: T027

  Text search input: case-insensitive partial match, updates as user types, no submit needed. Modality filter: resistance|running|mma|all. Combined: both constraints apply simultaneously. Whitespace search → full list. No-results state distinct from no-exercises state.

  **Acceptance**:
  - [ ] Typing filters list in real-time
  - [ ] Modality filter shows only matching exercises
  - [ ] Combined search + filter works
  - [ ] Clear search → full list restored

  **Commit**: `feat: add exercise library (CRUD, search, filter, deletion protection)`

### Wave 5 — Mesocycle Lifecycle

- [ ] 18. Create Mesocycle Server Action + End Date Calc

  **Spec**: `specs/create-mesocycle.md`, `specs/auto-calculate-end-date.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T012 | **Blocks**: T019-T026, T031, T043

  Create SA: name (required, non-empty), start_date (YYYY-MM-DD text, required), work_weeks (positive integer, required), has_deload (boolean, default false). Status always `planned`. Auto-calculate end_date: `start_date + (work_weeks * 7) + (has_deload ? 7 : 0) - 1` days. Stored as YYYY-MM-DD text. Recompute on update. Auto-increment ID.

  **Acceptance**:
  - [ ] Valid data → mesocycle created with status=planned
  - [ ] End date correctly calculated (e.g., 4 weeks from 2026-03-01 → 2026-03-28)
  - [ ] End date with deload (4+1 from 2026-03-01 → 2026-04-04)
  - [ ] Empty name, work_weeks ≤ 0, non-integer → rejected

  **Commit**: grouped with T019-T022

- [ ] 19. Mesocycle List + Detail View

  **Spec**: `specs/create-mesocycle.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T018 | **Blocks**: T023

  Mesocycle list page: shows all mesocycles with name, dates, status, work_weeks, has_deload. Detail view scaffold for templates/schedule. New mesocycle appears in list after creation.

  **Acceptance**:
  - [ ] List page shows all mesocycles
  - [ ] Detail view accessible per mesocycle

  **Commit**: grouped with T018, T020-T022

- [ ] 20. Create Mesocycle Form + End Date Preview

  **Spec**: `specs/create-mesocycle.md`, `specs/auto-calculate-end-date.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T018 | **Blocks**: —

  Form with name, start_date (date picker), work_weeks, has_deload toggle. Live end_date preview (read-only, updates as inputs change). On success → navigate to new mesocycle detail.

  **Acceptance**:
  - [ ] End date updates live as user changes inputs
  - [ ] End date field is read-only
  - [ ] Successful creation → navigate to detail view

  **Commit**: grouped with T018, T019, T021, T022

- [ ] 21. Status Transitions + One-Active Constraint

  **Spec**: `specs/mesocycle-status-management.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T018 | **Blocks**: T022, T038, T045

  Status SAs: planned→active (check no other active), active→completed. No skip planned→completed. No revert from completed. Only one active at any time. Reject activation when another is active with clear error.

  **Acceptance**:
  - [ ] planned→active when no other active → success
  - [ ] planned→active when another active → rejected
  - [ ] active→completed → success
  - [ ] planned→completed directly → rejected
  - [ ] Any transition out of completed → rejected

  **Commit**: grouped with T018-T020, T022

- [ ] 22. Status Transition UI

  **Spec**: `specs/mesocycle-status-management.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T021 | **Blocks**: —

  Contextual buttons: planned→"Activate", active→"Complete", completed→none. Status displayed on list and detail views.

  **Acceptance**:
  - [ ] Correct buttons shown per status
  - [ ] Status visible on list + detail

  **Commit**: `feat: add mesocycle lifecycle (create, status, end date)`

### Wave 6 — Workout Templates

- [ ] 23. Create Resistance Template SA + Canonical Slug

  **Spec**: `specs/create-resistance-templates.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T018 | **Blocks**: T024, T027, T031, T035

  Create SA: name (required), mesocycle_id (FK). Modality=`resistance` (immutable). Auto-generate canonical_name: lowercase, hyphens, no special chars (e.g., "Push A (Main)" → "push-a-main"). Unique canonical_name per mesocycle. Block create on completed mesocycle. Auto-increment ID.

  **Acceptance**:
  - [ ] Template created with correct canonical_name slug
  - [ ] Duplicate canonical_name in same mesocycle → rejected
  - [ ] Duplicate canonical_name across mesocycles → allowed
  - [ ] Create on completed mesocycle → rejected

  **Commit**: grouped with T024-T026

- [ ] 24. Template List + Edit + Delete (Resistance)

  **Spec**: `specs/create-resistance-templates.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T023 | **Blocks**: —

  Template list on mesocycle detail (name, canonical_name, modality). Edit name + canonical_name (with cross-phase link warning). Delete blocked if has slots or schedule refs. Empty mesocycle → prompt to create first template.

  **Acceptance**:
  - [ ] Templates listed on mesocycle detail
  - [ ] Edit canonical_name shows warning
  - [ ] Delete with slots → blocked

  **Commit**: grouped with T023, T025, T026

- [ ] 25. Running Template SA + Form

  **Spec**: `specs/running-templates.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T018 | **Blocks**: T054

  Create SA: modality=`running` (immutable), run_type enum (easy|tempo|interval|long|race), target_pace (text), hr_zone (int 1-5), interval_count (positive int, interval only), interval_rest (non-negative int, interval only), coaching_cues (text). No exercise slots. Same canonical_name rules. Form with conditional interval fields (shown only when run_type=interval).

  **Acceptance**:
  - [ ] Running template created with correct modality
  - [ ] Interval fields shown only for run_type=interval
  - [ ] Invalid run_type → rejected

  **Commit**: grouped with T023, T024, T026

- [ ] 26. MMA/BJJ Template SA + Form

  **Spec**: `specs/mma-bjj-template-support.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T018 | **Blocks**: T057

  Create SA: modality=`mma_bjj` (immutable), planned_duration (optional positive int minutes). No exercise slots. Same canonical_name rules. Simple form.

  **Acceptance**:
  - [ ] MMA/BJJ template created with correct modality
  - [ ] No exercise slot UI shown
  - [ ] planned_duration=0 or negative → rejected

  **Commit**: `feat: add workout templates (resistance, running, MMA/BJJ)`

### Wave 7 — Exercise Slots + Schedule

#### Track A: Exercise Slots

- [ ] 27. Add Exercise Slot SA + Picker

  **Spec**: `specs/exercise-slots.md`
  **Category**: `unspecified-high` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T023, T017 | **Blocks**: T028-T030, T040, T048

  Add slot SA: select exercise via picker (filtered to resistance modality). Fields: target_sets (required positive int), target_reps (required positive int), target_weight (optional non-negative), target_rpe (optional 1-10), rest_seconds (optional non-negative), guidelines (text). Auto-assign sort_order (append). Same exercise addable multiple times. Exercise picker uses search/filter from T017.

  **Acceptance**:
  - [ ] Slot added with correct sort_order
  - [ ] Exercise picker shows only resistance exercises
  - [ ] Same exercise added twice → two distinct slots
  - [ ] Invalid targets (negative sets, RPE > 10) → rejected

  **Commit**: grouped with T028-T030

- [ ] 28. Slot Editing + Remove

  **Spec**: `specs/exercise-slots.md`
  **Category**: `unspecified-low` | **Skills**: []
  **Deps**: T027 | **Blocks**: —

  Inline or form editing of target fields. Remove slot SA with confirmation (permanent). Template empty state when no slots. Sort_order gaps after removal are acceptable.

  **Acceptance**:
  - [ ] Slot targets editable and persisted
  - [ ] Slot removed after confirmation
  - [ ] Empty template shows prompt

  **Commit**: grouped with T027, T029, T030

- [ ] 29. Drag-Reorder Slots (SA + UI)

  **Spec**: `specs/drag-reorder-exercises.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T027 | **Blocks**: —

  Reorder SA: accepts ordered list of slot IDs, updates sort_order. No-op if unchanged (no DB write). Desktop mouse drag + mobile touch drag. Drag handle UI. Single slot → no drag affordance.

  **Acceptance**:
  - [ ] Drag reorders slots visually and persists
  - [ ] Page reload shows same order
  - [ ] No-op when dropped in same position

  **Commit**: grouped with T027, T028, T030

- [ ] 30. Main/Complementary Role Toggle

  **Spec**: `specs/main-vs-complementary-marking.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T027 | **Blocks**: —

  Toggle SA: defaults `complementary`, toggle to `main`. Role values: `main` | `complementary`. Visual distinction in template detail, today's view, logging UI. Role included in template_snapshot at log time. Multiple main slots per template allowed.

  **Acceptance**:
  - [ ] New slot defaults to complementary
  - [ ] Toggle changes role and persists
  - [ ] Visual distinction visible

  **Commit**: `feat: add exercise slots (add, edit, remove, reorder, main/complementary)`

#### Track B: Weekly Schedule

- [ ] 31. Assign/Remove/Replace Template SA

  **Spec**: `specs/7-day-assignment-grid.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T023 | **Blocks**: T032-T034, T035, T040, T045

  Assign SA: creates weekly_schedule row (mesocycle_id, day_of_week 0-6, template_id, variant=normal). Only templates from same mesocycle. Replace: assigning to already-assigned day replaces (no duplicate). Remove: deletes row, day becomes rest. Block on completed mesocycle.

  **Acceptance**:
  - [ ] Assign creates correct row
  - [ ] Replace overwrites existing assignment
  - [ ] Remove deletes row
  - [ ] Template from different mesocycle → rejected

  **Commit**: grouped with T032-T034

- [ ] 32. 7-Day Schedule Grid UI

  **Spec**: `specs/7-day-assignment-grid.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T031 | **Blocks**: T033, T034, T045, T064

  Grid: all 7 days (Mon-Sun). Each cell shows template name or rest state. Template picker from mesocycle's templates. Assign/remove/replace flow. Grid scoped to mesocycle. Normal variant by default.

  **Acceptance**:
  - [ ] All 7 days shown
  - [ ] Template picker shows mesocycle's templates
  - [ ] Assign, replace, remove work without page reload

  **Commit**: grouped with T031, T033, T034

- [ ] 33. Normal/Deload Tabs

  **Spec**: `specs/normal-vs-deload-tabs.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T032 | **Blocks**: T068

  Deload tab shown only when has_deload=true. Each tab edits its own variant rows independently. Normal tab: variant='normal', Deload tab: variant='deload'. Same template usable on both tabs. Tab switch without page reload.

  **Acceptance**:
  - [ ] has_deload=false → no deload tab
  - [ ] has_deload=true → both tabs visible
  - [ ] Assignments independent per variant

  **Commit**: grouped with T031, T032, T034

- [ ] 34. Rest Day Display in Grid

  **Spec**: `specs/explicit-rest-days.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T032 | **Blocks**: —

  Days with no schedule row displayed as "Rest" (visually distinct from assigned). All 7 days always visible. Rest state derived from absence of row. Independent per variant.

  **Acceptance**:
  - [ ] Unassigned days show as "Rest"
  - [ ] All 7 days visible regardless of assignments

  **Commit**: `feat: add weekly schedule (7-day grid, deload tabs, rest days)`

### Wave 8 — Cascade + Clone + Routines

#### Track A: Template Cascade

- [ ] 35. Cascade Sibling Query (3 Scopes)

  **Spec**: `specs/cascade-scope-selection.md`
  **Category**: `deep` | **Skills**: []
  **Deps**: T023, T031 | **Blocks**: T036

  Query logic: find templates with same canonical_name across mesocycles. "This only" (no siblings). "This + future" (active/planned created after current). "All phases" (all active/planned). Always exclude status=completed. Slot changes also subject to cascade.

  **Acceptance**:
  - [ ] Each scope returns correct sibling set
  - [ ] Completed mesocycles always excluded
  - [ ] No siblings → equivalent to "this only"

  **Commit**: grouped with T036-T039

- [ ] 36. Cascade Atomic Execution SA

  **Spec**: `specs/cascade-scope-selection.md`
  **Category**: `deep` | **Skills**: []
  **Deps**: T035 | **Blocks**: T037, T038

  Single Server Action: update all targets in one transaction. Skip templates with existing logged workouts. Return summary (updated count, skipped count). Cancel aborts all changes (no partial persist).

  **Acceptance**:
  - [ ] All targets updated atomically
  - [ ] Templates with logged workouts skipped
  - [ ] Summary shows counts
  - [ ] Transaction rollback on failure

  **Commit**: grouped with T035, T037-T039

- [ ] 37. Cascade Scope Selection UI

  **Spec**: `specs/cascade-scope-selection.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T036 | **Blocks**: —

  Inline confirmation step on save. Three scope options. Summary after execution. Cancel aborts entirely.

  **Acceptance**:
  - [ ] Scope selection appears on template save
  - [ ] All three scopes available
  - [ ] Summary shown after cascade

  **Commit**: grouped with T035, T036, T038, T039

- [ ] 38. Block Edits on Completed Mesocycle

  **Spec**: `specs/completed-mesocycle-protection.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T036, T021 | **Blocks**: T039

  Direct edits on templates in completed mesocycles → SA returns error. No UI affordance for editing. Protection enforced at Server Action layer.

  **Acceptance**:
  - [ ] Edit template in completed mesocycle → error
  - [ ] No edit controls shown for completed mesocycle templates

  **Commit**: grouped with T035-T037, T039

- [ ] 39. Cascade Skips Completed + Summary

  **Spec**: `specs/completed-mesocycle-protection.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T038 | **Blocks**: —

  All cascade scopes silently skip completed mesocycles. Summary shows skipped count. Templates in completed mesocycles remain readable.

  **Acceptance**:
  - [ ] "All phases" cascade skips completed mesocycles
  - [ ] Summary shows how many were skipped
  - [ ] Completed mesocycle templates unchanged after cascade

  **Commit**: `feat: add template cascade (3 scopes, completed protection)`

#### Track B: Mesocycle Cloning

- [ ] 40. Clone Mesocycle SA (Atomic Transaction)

  **Spec**: `specs/clone-mesocycle.md`
  **Category**: `deep` | **Skills**: []
  **Deps**: T027, T031 | **Blocks**: T041, T042

  Single atomic transaction: create new mesocycle + copy all workout_templates + all exercise_slots + all weekly_schedule (normal + deload). New auto-increment IDs. Same canonical_names (verbatim copy). Status=planned. Compute new end_date. Reject if source has no templates. Source can be any status. Clone form: new name + start_date required, work_weeks + has_deload from source (overridable).

  **Acceptance**:
  - [ ] All rows copied with new IDs, correct references
  - [ ] canonical_names copied verbatim
  - [ ] Transaction atomic — failure rolls back everything
  - [ ] Source with no templates → rejected

  **Commit**: grouped with T041, T042

- [ ] 41. Clone Form UI

  **Spec**: `specs/clone-mesocycle.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T040 | **Blocks**: —

  Collect new name + start_date (required). work_weeks + has_deload copied from source, overridable. Navigate to new mesocycle on success.

  **Acceptance**:
  - [ ] Form pre-fills work_weeks and has_deload from source
  - [ ] Override fields work
  - [ ] Success → navigate to new mesocycle

  **Commit**: grouped with T040, T042

- [ ] 42. Canonical Name Preservation

  **Spec**: `specs/canonical-name-preservation.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T040 | **Blocks**: —

  Verify: cloned templates have byte-identical canonical_names. Cross-phase query returns both source + clone. Cascade includes cloned template when active/planned. Source canonical_names unmodified.

  **Acceptance**:
  - [ ] canonical_names identical between source and clone
  - [ ] Cross-phase query finds both
  - [ ] Source templates unchanged

  **Commit**: `feat: add mesocycle cloning with canonical name preservation`

#### Track C: Routine Items

- [ ] 43. Routine Item CRUD SA + Scope Validation

  **Spec**: `specs/routine-item-crud.md`
  **Category**: `unspecified-high` | **Skills**: []
  **Deps**: T018 | **Blocks**: T044, T061

  Create SA: name (required), category (required), value_type (boolean|duration|count), frequency_target (≥1), scope_type (global|per_mesocycle|date_range|skip_on_deload). Scope-specific validation: per_mesocycle needs mesocycle_id FK, date_range needs start+end dates (end ≥ start), others need no extras. Edit SA: scope change clears old fields. Delete SA: preserves routine_logs.

  **Acceptance**:
  - [ ] Each scope type creates with correct validation
  - [ ] Scope change clears old scope fields
  - [ ] Delete preserves routine_logs
  - [ ] Invalid mesocycle_id → error

  **Commit**: grouped with T044

- [ ] 44. Routine Item List + Edit + Delete

  **Spec**: `specs/routine-item-crud.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T043 | **Blocks**: —

  List: name, category, value_type, frequency_target, human-readable scope summary. Edit + delete actions. Coach planning UI.

  **Acceptance**:
  - [ ] All items listed with scope summary
  - [ ] Edit and delete work

  **Commit**: `feat: add routine item CRUD with flexible scoping`

### Wave 9 — Today's Workout

- [ ] 45. GET /api/today (Lookup Chain + Deload)

  **Spec**: `specs/view-todays-planned-workout.md`
  **Category**: `deep` | **Skills**: []
  **Deps**: T032, T021 | **Blocks**: T046-T048, T054, T057, T058

  Route Handler: lookup chain (active mesocycle → day_of_week → deload detection → variant → weekly_schedule → template + slots). Returns type: `workout | rest_day | no_active_mesocycle`. Deload = last week when has_deload=true (week offset from start_date). Include modality-specific fields. Include today's date in response.

  **Acceptance**:
  - [ ] Active mesocycle + assigned day → type: workout with full template
  - [ ] Active mesocycle + no assignment → type: rest_day
  - [ ] No active mesocycle → type: no_active_mesocycle
  - [ ] Correct deload variant selected based on week offset

  **Commit**: grouped with T046, T047

- [ ] 46. Today's Resistance Workout Display

  **Spec**: `specs/view-todays-planned-workout.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T045 | **Blocks**: —

  Template name prominent. Exercises in sort_order with all targets (sets, reps, weight, RPE, rest, guidelines). Main/complementary distinction visible. Mobile-first: large tap targets, no horizontal scroll. "Log Workout" action.

  **Acceptance**:
  - [ ] Exercises displayed in correct order with all targets
  - [ ] Main/complementary visually distinct
  - [ ] Mobile-friendly layout

  **Commit**: grouped with T045, T047

- [ ] 47. Today's Running + MMA/BJJ Display

  **Spec**: `specs/view-todays-planned-workout.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T045 | **Blocks**: —

  Running: run_type, target_pace, HR zone, interval details, coaching cues. MMA/BJJ: template name, duration target, coaching notes. Modality-specific rendering.

  **Acceptance**:
  - [ ] Running workout shows all running-specific fields
  - [ ] MMA/BJJ shows duration + notes
  - [ ] Correct modality renders for each type

  **Commit**: `feat: add today's workout view (all modalities, deload detection)`

### Wave 10 — Logging: Resistance

- [ ] 48. Logging Form + Pre-fill from Template

  **Spec**: `specs/pre-filled-resistance-logging.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T045, T027 | **Blocks**: T049-T052

  Logging form: accessible from today's view via "Log Workout". Exercises in sort_order. One row per target_sets. Pre-fill actual_weight from target_weight, actual_reps from target_reps. Null target_weight → blank field (not zero). Mobile-first. "Save Workout" prominent (sticky footer). No auto-save. Form reflects current template state at open time.

  **Acceptance**:
  - [ ] Exercises in correct order with correct number of set rows
  - [ ] Weight/reps pre-filled from template targets
  - [ ] Null target_weight → blank field
  - [ ] Save button always accessible

  **Commit**: grouped with T049-T053

- [ ] 49. Actual Reps/Weight/RPE Inputs

  **Spec**: `specs/actual-set-input.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T048 | **Blocks**: T052

  Per-set: actual_reps (required positive int), actual_weight (optional non-negative), actual_rpe (optional 1-10, NOT pre-filled). Planned values shown read-only alongside actuals. Numeric keyboards on mobile. Each set independently editable.

  **Acceptance**:
  - [ ] actual_rpe starts empty (not pre-filled)
  - [ ] Planned values shown read-only alongside inputs
  - [ ] Missing actual_reps at save → blocked with error

  **Commit**: grouped with T048, T050-T053

- [ ] 50. Add/Remove Set Rows

  **Spec**: `specs/add-remove-sets.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T048 | **Blocks**: T052

  "Add Set": copies weight/reps from last row, NOT RPE. "Remove": blocked on last remaining set (minimum 1). Modified count saved as logged_sets. template_snapshot reflects original plan, not modifications.

  **Acceptance**:
  - [ ] Added set copies weight+reps from previous, RPE empty
  - [ ] Cannot remove last set
  - [ ] Saved set count reflects form state

  **Commit**: grouped with T048, T049, T051-T053

- [ ] 51. Rating + Notes Fields

  **Spec**: `specs/workout-rating-notes.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T048 | **Blocks**: T052

  Rating: 1-5 integer, optional (null ≠ 0). Notes: free text, optional (whitespace → null). Both at bottom of form near save button. Stored on logged_workouts row.

  **Acceptance**:
  - [ ] Rating 1-5 valid, 0 or 6 rejected
  - [ ] Whitespace-only notes → null
  - [ ] Both optional, save succeeds without them

  **Commit**: grouped with T048-T050, T052, T053

- [ ] 52. Save Workout SA (Atomic + Snapshot)

  **Spec**: `specs/log-immutability.md`, `specs/pre-filled-resistance-logging.md`
  **Category**: `deep` | **Skills**: []
  **Deps**: T048-T051 | **Blocks**: T053, T058, T064, T069

  Single atomic transaction: create logged_workouts (template_snapshot JSON with version:1, canonical_name from template, logged_at timestamp, rating, notes) + logged_exercises per exercise (snapshotted name, sort_order) + logged_sets per set (actuals). Rollback on any failure. template_snapshot includes all slot fields. canonical_name is plain string copy.

  **Acceptance**:
  - [ ] All three table types created in one transaction
  - [ ] Rollback on failure — no partial rows
  - [ ] template_snapshot has version:1 and all slot fields
  - [ ] canonical_name matches source template

  **Commit**: grouped with T048-T051, T053

- [ ] 53. Immutability Enforcement

  **Spec**: `specs/log-immutability.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T052 | **Blocks**: T067, T069

  No UPDATE/DELETE Server Actions for logged_workouts, logged_exercises, logged_sets, routine_logs. No edit UI for logged workouts. Template edits after logging don't affect snapshots.

  **Acceptance**:
  - [ ] No SA exists for log mutation
  - [ ] No edit action in UI for logged workouts
  - [ ] Template edit after logging → snapshot unchanged

  **Commit**: `feat: add resistance workout logging (pre-fill, actuals, snapshot, immutability)`

### Wave 11 — Logging: Running + MMA/BJJ

- [ ] 54. Running Logging Form + Save SA

  **Spec**: `specs/running-logging.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T045, T025 | **Blocks**: T055, T056

  Running form: planned reference (read-only), actual_distance (non-negative), actual_avg_pace (text), actual_avg_hr (positive int). All optional. Template_snapshot with version:1 includes all running fields. canonical_name copied. No logged_exercises/sets rows. Atomic save.

  **Acceptance**:
  - [ ] Running form shows planned reference + editable actuals
  - [ ] Save creates logged_workouts only (no exercises/sets rows)
  - [ ] All actuals blank → save succeeds

  **Commit**: grouped with T055, T056

- [ ] 55. Running Rating & Notes

  **Spec**: `specs/running-rating-notes.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T054 | **Blocks**: —

  Same rating (1-5) + notes behavior as resistance. Part of atomic transaction. Applies to all run types including interval.

  **Acceptance**:
  - [ ] Rating + notes saved on running logged_workouts
  - [ ] Same validation as resistance rating/notes

  **Commit**: grouped with T054, T056

- [ ] 56. Interval Logging (JSON Array)

  **Spec**: `specs/interval-logging.md`
  **Category**: `unspecified-high` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T054 | **Blocks**: —

  Shown only for run_type=interval. Rows = interval_count. Per-rep: interval_pace (text), interval_avg_hr (positive int), interval_notes (collapsed by default). Stored as JSON array on logged_workouts ({rep_number, interval_pace, interval_avg_hr, interval_notes}). Null interval_count → no rows. Atomic with rest of save.

  **Acceptance**:
  - [ ] Correct number of interval rows rendered
  - [ ] JSON array stored with correct structure
  - [ ] All fields blank → save succeeds (objects with null fields)

  **Commit**: `feat: add running workout logging (distance, pace, HR, intervals)`

- [ ] 57. MMA/BJJ Logging Form + Save SA

  **Spec**: `specs/mma-bjj-logging.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T045, T026 | **Blocks**: —

  Form: actual_duration_minutes (positive int), feeling (1-5), notes. All optional. Template_snapshot + canonical_name. No logged_exercises/sets rows. Atomic save. Immutable after save.

  **Acceptance**:
  - [ ] MMA form shows duration + feeling + notes
  - [ ] Save creates logged_workouts only
  - [ ] All blank → save succeeds (session occurred marker)

  **Commit**: `feat: add MMA/BJJ session logging`

### Wave 12 — Already-Logged + Rest Day + Routine Check-off

- [ ] 58. Already-Logged Detection

  **Spec**: `specs/already-logged-summary.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T045, T052 | **Blocks**: T059, T060

  Check logged_workouts for today's date + active mesocycle. Uses calendar date match (not timestamp). Part of GET /api/today response (logged boolean or type: already_logged).

  **Acceptance**:
  - [ ] Logged today → already-logged state returned
  - [ ] Not logged → normal workout state

  **Commit**: grouped with T059, T060

- [ ] 59. Already-Logged Summary Display

  **Spec**: `specs/already-logged-summary.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T058 | **Blocks**: —

  Summary: workout name, logged_at, modality-specific actuals (resistance: exercises/sets, running: distance/pace/HR, MMA: duration/notes). Rating + notes if present. Read-only. No edit controls. "Workout Logged" label.

  **Acceptance**:
  - [ ] Summary shows all modality-appropriate data
  - [ ] No edit controls visible
  - [ ] Clear "already completed" indication

  **Commit**: grouped with T058, T060

- [ ] 60. Re-Logging Prevention

  **Spec**: `specs/already-logged-summary.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T058 | **Blocks**: —

  No "Log Workout" button when already logged. Server-side: duplicate logged_workouts row for same date + mesocycle → rejected.

  **Acceptance**:
  - [ ] No log button shown when already logged
  - [ ] Duplicate insert → rejected at SA layer

  **Commit**: `feat: add already-logged detection + summary + re-log prevention`

- [ ] 61. Active Routine Scope Filtering

  **Spec**: `specs/daily-routine-check-off.md`
  **Category**: `unspecified-high` | **Skills**: []
  **Deps**: T043 | **Blocks**: T062

  Filter logic: global (always), per_mesocycle (active mesocycle in range), date_range (today in range inclusive), skip_on_deload (exclude during deload weeks using ADR-003 detection). skip_on_deload shown when no active mesocycle. No active routines → empty state.

  **Acceptance**:
  - [ ] Each scope type correctly includes/excludes
  - [ ] Deload week → skip_on_deload items hidden
  - [ ] No active mesocycle → per_mesocycle hidden, skip_on_deload shown

  **Commit**: grouped with T062

- [ ] 62. Mark Done/Skipped SA + Check-off UI

  **Spec**: `specs/daily-routine-check-off.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T061 | **Blocks**: T063, T072, T073

  Mark SA: creates routine_log (routine_item_id, log_date, status done|skipped, optional value). Block duplicate same item+date. Immutable after insert. Numeric input for duration/count types, none for boolean. Mobile-optimized. Already-logged items visually distinct.

  **Acceptance**:
  - [ ] Mark done/skipped creates correct log row
  - [ ] Duplicate → blocked
  - [ ] Numeric value captured for duration/count types
  - [ ] No UPDATE/DELETE on routine_logs

  **Commit**: `feat: add daily routine check-off with scope filtering`

- [ ] 63. Rest Day Display + Routine Integration

  **Spec**: `specs/rest-day-display.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T045, T062 | **Blocks**: —

  "Rest Day" heading when type=rest_day. No workout content. Active daily routines shown below (fully functional check-off). Empty state if no routines. Distinct from no_active_mesocycle state.

  **Acceptance**:
  - [ ] Rest day shows "Rest Day" + routines
  - [ ] Routines fully functional on rest days
  - [ ] No-active-mesocycle shows different message

  **Commit**: `feat: add rest day display with routine integration`

### Wave 13 — Calendar & Progression

#### Track A: Calendar

- [ ] 64. GET /api/calendar Projection Logic

  **Spec**: `specs/projected-calendar.md`, `specs/deload-week-distinction.md`, `specs/completed-day-markers.md`
  **Category**: `deep` | **Skills**: []
  **Deps**: T032, T053 | **Blocks**: T065-T068

  Route Handler: accept month=YYYY-MM. Iterate each day, map to mesocycle + day_of_week + variant → template. Include: date, template name, modality, mesocycle_id, is_deload flag, status (completed|projected|rest). Completed = logged_workouts row exists for that date. Days outside mesocycle ranges → rest. Multiple mesocycles → each day assigned to correct one.

  **Acceptance**:
  - [ ] One entry per day in requested month
  - [ ] Correct template assigned per day
  - [ ] is_deload flag correct for deload week days
  - [ ] status: completed when logged, projected when assigned but not logged, rest when unassigned

  **Commit**: grouped with T065-T068

- [ ] 65. Calendar Month Grid UI

  **Spec**: `specs/projected-calendar.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T064 | **Blocks**: —

  7 columns (Mon-Sun). Template name per day. Modality color-coding (3 distinct colors). Rest days blank. Prev/next month nav. Current month default. Accessible from main nav.

  **Acceptance**:
  - [ ] Month grid renders correctly
  - [ ] Modality colors visually distinct
  - [ ] Month navigation works

  **Commit**: grouped with T064, T066-T068

- [ ] 66. Day Detail Drill-in Panel

  **Spec**: `specs/day-detail-drill-in.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T064 | **Blocks**: —

  Click day → inline panel/modal. Projected: live template data. Completed: template_snapshot + logged actuals. Rest: "Rest Day" message. Resistance: slots with targets + actuals. Rating + notes if present. Dismissible. No full-page navigation.

  **Acceptance**:
  - [ ] Projected day reads live template
  - [ ] Completed day reads snapshot (not current template)
  - [ ] Rest day shows message
  - [ ] Panel dismissible

  **Commit**: grouped with T064, T065, T067, T068

- [ ] 67. Completed Day Markers

  **Spec**: `specs/completed-day-markers.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T064, T053 | **Blocks**: —

  Completed days have distinct visual marker (checkmark/fill) alongside modality color. Past unlogged = projected (missed workouts visible). Future always projected.

  **Acceptance**:
  - [ ] Completed days show marker
  - [ ] Past unlogged days show as projected (not rest)
  - [ ] Marker visible alongside modality color

  **Commit**: grouped with T064-T066, T068

- [ ] 68. Deload Week Distinction

  **Spec**: `specs/deload-week-distinction.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T064, T033 | **Blocks**: —

  Deload days: distinct visual treatment (background/border). is_deload flag on calendar entries. Last week of mesocycle with has_deload=true. Applies to entire week row. Legend/label for distinction.

  **Acceptance**:
  - [ ] Deload week visually distinct
  - [ ] has_deload=false → no deload distinction
  - [ ] Spans month boundaries correctly

  **Commit**: `feat: add calendar (projection, modality colors, completion markers, deload, day detail)`

#### Track B: Progression

- [ ] 69. GET /api/progression Route Handler

  **Spec**: `specs/exercise-progression-chart.md`
  **Category**: `deep` | **Skills**: []
  **Deps**: T053 | **Blocks**: T070, T071

  Route Handler: accept canonical_name + optional exercise_id. Cross-phase query via canonical_name on logged_workouts. Data points: date, mesocycle, planned weight (from template_snapshot), actual weight (from logged_sets), planned volume, actual volume. Top-set weight = heaviest set. Volume = sets × reps × weight. Time-ordered. Planned data from snapshot, NOT live template.

  **Acceptance**:
  - [ ] Returns time-ordered data points across mesocycles
  - [ ] Planned data from template_snapshot
  - [ ] Cross-phase via canonical_name
  - [ ] No data → empty array (not error)

  **Commit**: grouped with T070, T071

- [ ] 70. Exercise Progression Chart UI

  **Spec**: `specs/exercise-progression-chart.md`
  **Category**: `visual-engineering` | **Skills**: [`frontend-ui-ux`]
  **Deps**: T069 | **Blocks**: —

  Exercise selector (any exercise from library). Two data series: planned (dotted) vs actual (solid). Time axis. Weight view (top-set) + volume view (toggle). Phase-colored data points. Empty state if no data.

  **Acceptance**:
  - [ ] Chart renders with two series
  - [ ] Exercise selector works
  - [ ] Weight/volume toggle
  - [ ] Empty state for no data

  **Commit**: grouped with T069, T071

- [ ] 71. Phase Boundary Markers

  **Spec**: `specs/phase-boundary-markers.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T069 | **Blocks**: —

  `phases` array in progression response: mesocycle id, name, start_date, end_date. Only mesocycles with data points. Vertical marker lines at start/end dates on chart. Labeled with mesocycle name. Start vs end visually distinct.

  **Acceptance**:
  - [ ] phases array includes only mesocycles with data
  - [ ] Vertical lines rendered at boundaries
  - [ ] Labels visible

  **Commit**: `feat: add exercise progression chart with phase boundaries`

### Wave 14 — Routine Analytics

- [ ] 72. Weekly Completion Count

  **Spec**: `specs/routine-streaks-counts.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T062 | **Blocks**: —

  Count done logs in current Mon-Sun week per item. Display as "3/5 this week" with frequency_target. Excludes skipped. Resets each Monday. 0 if no logs this week.

  **Acceptance**:
  - [ ] Count only done logs in current week
  - [ ] Skipped excluded
  - [ ] Display alongside frequency target

  **Commit**: grouped with T073

- [ ] 73. Streak Calculation + Display

  **Spec**: `specs/routine-streaks-counts.md`
  **Category**: `quick` | **Skills**: []
  **Deps**: T062 | **Blocks**: —

  Consecutive calendar days ending today (or yesterday) with done status. Broken by skipped or missing day. Displayed per item with visual indicator. Updates immediately after check-off.

  **Acceptance**:
  - [ ] Consecutive done days counted correctly
  - [ ] Skip or gap breaks streak
  - [ ] Updates without page reload

  **Commit**: `feat: add routine streaks + weekly completion counts`

---

## Commit Strategy

Each wave or logical group produces a commit. Messages use conventional commits:
- `feat:` for new features
- `fix:` for bug fixes
- `refactor:` for restructuring
- `test:` for test infrastructure
- `docs:` for documentation

---

## Success Criteria

### Verification Commands
```bash
docker compose up -d           # App running on localhost:3000
curl localhost:3000/api/health  # {"status":"ok","db":"connected"}
pnpm run test                  # All Vitest tests pass
pnpm run test:e2e              # All Playwright tests pass
```

### Final Checklist
- [ ] All 73 tasks completed
- [ ] All specs' acceptance criteria met
- [ ] Mobile logging flow works (<2 min for typical resistance session)
- [ ] Calendar shows projected workouts across mesocycles
- [ ] Template cascade works across 3 scopes
- [ ] Logged workouts immutable (no edit path)
- [ ] Clone-on-create copies all data atomically
- [ ] Daily routines trackable with flexible scoping
