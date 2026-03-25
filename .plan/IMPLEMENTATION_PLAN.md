# Implementation Plan

> 158 tasks across 30 waves (Wave 0 infra + 14 feature waves + 3 UI overhaul + 3 UI redesign + 4 enhancement waves + 4 P3 waves + 2 coaching summary waves + 2 retroactive logging waves). Each feature task = one TDD cycle.
> Waves are sequential; tracks within a wave are parallel.

## Critical Path

The longest dependency chain through the project:

```
scaffold → docker → db-schema → auth → app-shell → create-mesocycle → resistance-templates
→ exercise-slots (joins exercise-search-filter) → 7-day-assignment-grid (joins mesocycle-status)
→ view-todays-workout → pre-filled-resistance-logging → save-workout + log-immutability
→ exercise-progression-chart → phase-boundary-markers
```

14 dependencies on the critical path. Everything else branches off as parallel work.

---

## Wave 0: Project Infrastructure

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T0001 | Next.js 16 scaffold: package.json (pnpm, all scripts), next.config.ts (standalone), tsconfig, eslint, Tailwind v4, shadcn/ui, placeholder app + /api/health. Test infra: vitest.config.ts (projects: unit + integration), playwright.config.ts (webServer, storageState auth), SQLite :memory: test helpers, transaction rollback hooks, placeholder tests. | medium | Infrastructure | — | — |
| T0002 | Docker: Dockerfile (dev), Dockerfile.production (multi-stage, standalone, SQLite volume /app/data/), docker-compose.yml (dev), docker-compose.production.yml (prod, app-network, healthcheck), docker-entrypoint.sh (migrate + start), .dockerignore | small | Infrastructure | T0001 | — |
| T0003 | GitHub Actions CI/CD: ci.yml (lint + type-check, vitest unit/integration, build, e2e — all parallel, SQLite :memory: no service containers), deploy.yml (SSH on CI success on main, docker compose up, healthcheck). Caching: pnpm store, .next/cache. | small | Infrastructure | T0001 | — |
| T0004 | nginx config (cross-repo): fitness-app.conf in docker-app-stack/infrastructure/nginx/sites/. HTTP→HTTPS redirect, proxy to fitness-app:3000, static caching. Document certbot command. | small | Infrastructure | T0002 | — |

## Wave 1: Database Foundation

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T001 | SQLite connection + 4 PRAGMAs (WAL, busy_timeout, synchronous, foreign_keys). Verify each returns expected value after init. | small | Foundation | — | db-schema-migrations |
| T002 | Planning layer schema: `exercises`, `mesocycles`, `workout_templates`, `exercise_slots`, `weekly_schedule`, `routine_items`. All columns, FKs, unique constraints, cascade rules per spec. | medium | Foundation | T001 | db-schema-migrations |
| T003 | Logging layer schema: `logged_workouts`, `logged_exercises`, `logged_sets`, `routine_logs`. Soft references (no FK to templates), JSON columns with `$type<T>()`, cascade deletes. | medium | Foundation | T001 | db-schema-migrations |
| T004 | Drizzle v2 `defineRelations` for all 10 tables. Separate `relations.ts`. Generate + apply initial migration via `drizzle-kit generate && drizzle-kit migrate`. | small | Foundation | T002, T003 | db-schema-migrations |

## Wave 2: Auth

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T005 | Env config validation: read `AUTH_USERNAME`, `AUTH_PASSWORD_HASH`, `JWT_SECRET`, `JWT_EXPIRES_IN` (default 7d). Fail loudly if required vars missing. Credential validation: bcrypt compare, timing-safe. | small | Foundation | T004 | auth-system |
| T006 | JWT issuance + verification via `jose`. Payload: `sub`, `iat`, `exp`. Sign with `JWT_SECRET`. Verify valid, reject expired/tampered. | small | Foundation | T005 | auth-system |
| T007 | Login route handler `POST /api/auth/login`. Valid creds → set `auth-token` cookie (`httpOnly`, `secure`, `sameSite=lax`). Invalid → generic error. Logout route clears cookie. | small | Foundation | T005, T006 | auth-system |
| T008 | Auth middleware: validate JWT via `jose` (Edge-compatible, no `better-sqlite3`). Protect `/(app)` routes. Redirect unauthenticated → `/login`. Redirect authenticated on `/login` → app home. Public: `/login`, `/api/auth/*`, `/api/health`. | small | Foundation | T006 | auth-system |
| T009 | Login page UI: username + password fields, submit, error display, mobile-friendly. Logout action accessible from app shell. | medium | Foundation | T007, T008 | auth-system |

## Wave 3: App Shell

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T010 | Route groups: `(app)` for authenticated routes, `(auth)` for login. Root layout wraps `(app)` with nav shell. No shell on `(auth)` routes. | medium | Foundation | T008 | app-shell-navigation |
| T011 | Health endpoint `GET /api/health`. Returns `{ status: "ok", db: "connected" }` (200) or `{ status: "error", db: "disconnected" }` (503). Public route, no auth. Verifies live DB connection. | small | Foundation | T004 | app-shell-navigation |
| T012 | Navigation: desktop sidebar (persistent) + mobile bottom bar (fixed). Links: Today, Exercises, Mesocycles, Calendar, Routines. Active route indicator. Logout control in sidebar. CSS breakpoint swap, no layout shift. | medium | Foundation | T010 | app-shell-navigation |

## Wave 4: Exercise Library

> Parallel with Wave 5 (Mesocycle Lifecycle). Both depend on T012.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T013 | Create exercise SA: validate name (non-empty, trimmed, unique case-insensitive), modality (resistance\|running\|mma), optional muscle_group + equipment. Auto-increment ID, `created_at` timestamp. | small | Exercise Library | T012 | exercise-crud |
| T014 | Exercise list server component + empty state. Each row: name, modality, muscle_group, equipment. Create exercise form UI (inline or modal). | small | Exercise Library | T013 | exercise-crud |
| T015 | Edit exercise SA + form: pre-populated fields, duplicate name check (excluding self), modality changeable, muscle_group/equipment clearable. | medium | Exercise Library | T013 | exercise-crud |
| T016 | Delete exercise SA: confirmation step, in-use check (`exercise_slots` references across all mesocycles). Blocked if in use with clear error. FK safety net (no cascade on `exercise_id`). | small | Exercise Library | T013 | exercise-crud, exercise-deletion-protection |
| T017 | Exercise search & filter: text search (case-insensitive, partial match, as-you-type), modality filter (resistance\|running\|mma\|all), combined. Empty-state for no results distinct from no exercises. | small | Exercise Library | T014 | exercise-search-filter |

## Wave 5: Mesocycle Lifecycle

> Parallel with Wave 4. Both depend on T012.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T018 | Create mesocycle SA: name (required), start_date (YYYY-MM-DD text), work_weeks (positive integer), has_deload (boolean, default false). Status = `planned`. Auto-calculate end_date. | small | Mesocycle Lifecycle | T012 | create-mesocycle, auto-calculate-end-date |
| T019 | Mesocycle list page + detail view scaffold. Shows name, dates, status, work_weeks, has_deload. | small | Mesocycle Lifecycle | T018 | create-mesocycle |
| T020 | Create mesocycle form UI with live end_date preview. Formula: `start_date + (work_weeks * 7) + (has_deload ? 7 : 0) - 1` days. End date read-only, recomputed on update. | small | Mesocycle Lifecycle | T018 | create-mesocycle, auto-calculate-end-date |
| T021 | Status transition SAs: planned→active, active→completed. No skip, no revert from completed. Only-one-active constraint (check before activate, reject with error). | small | Mesocycle Lifecycle | T018 | mesocycle-status-management |
| T022 | Status transition UI: contextual buttons (planned→"Activate", active→"Complete", completed→none). Current status displayed on list + detail. | small | Mesocycle Lifecycle | T021 | mesocycle-status-management |

## Wave 6: Workout Templates

> Depends on Wave 5 (T018 create-mesocycle). Running/MMA parallel with resistance.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T023 | Create resistance template SA: name (required), mesocycle_id (FK), modality=`resistance` (immutable). Auto-generate `canonical_name` slug (lowercase, hyphens, no special chars). Unique canonical_name per mesocycle. Block create on completed mesocycle. | small | Workout Templates | T018 | create-resistance-templates |
| T024 | Template list on mesocycle detail. Edit template name + canonical_name (with cross-phase link warning). Delete template (blocked if has slots or schedule refs). | medium | Workout Templates | T023 | create-resistance-templates |
| T025 | Create running template SA: modality=`running`, run_type enum (easy\|tempo\|interval\|long\|race), target_pace (text), hr_zone (int 1-5), interval_count/rest (conditional on run_type=interval), coaching_cues. Same canonical_name slug rules. Running template form with conditional interval fields. | small | Workout Templates | T018 | running-templates |
| T026 | Create MMA/BJJ template SA: modality=`mma_bjj`, planned_duration (optional positive int minutes). No exercise slots. Same canonical_name slug rules. Form UI. | small | Workout Templates | T018 | mma-bjj-template-support |

## Wave 7: Exercise Slots + Schedule

> Two parallel tracks. Both depend on Wave 6.
> Track A (slots) also needs T017 (exercise search) from Wave 4.

### Track A: Exercise Slots

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T027 | Add exercise slot SA: select exercise via picker (filtered by modality=resistance), store target_sets (required, positive int), target_reps (required, positive int), target_weight (optional, non-negative), target_rpe (optional, 1-10), rest_seconds (optional, non-negative), guidelines (text). Auto-assign sort_order. Same exercise addable multiple times. | small | Workout Templates | T023, T017 | exercise-slots |
| T028 | Slot editing (inline or form) + remove slot SA (confirmation, permanent). Exercise picker UI. Template empty state when no slots. | small | Workout Templates | T027 | exercise-slots |
| T029 | Drag-reorder slots: SA accepts ordered slot IDs, updates sort_order. No-op if unchanged. Desktop mouse drag + mobile touch drag. Drag handle UI. | medium | Workout Templates | T027 | drag-reorder-exercises |
| T030 | Main/complementary role toggle SA: defaults `complementary`, toggle to `main`. Visual distinction in template detail, today's view, and logging UI. Role included in template_snapshot. | small | Workout Templates | T027 | main-vs-complementary-marking |

### Track B: Weekly Schedule

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T031 | Assign template to day SA: creates `weekly_schedule` row (mesocycle_id, day_of_week 0-6, template_id, variant=normal). Replace existing assignment. Remove assignment (delete row). Only templates from same mesocycle. Block on completed mesocycle. | small | Weekly Schedule | T023 | 7-day-assignment-grid |
| T032 | 7-day schedule grid UI: all 7 days shown, template name or rest state per day. Template picker from mesocycle's templates. Assign/remove/replace flow. | medium | Weekly Schedule | T031 | 7-day-assignment-grid |
| T033 | Normal/deload tabs: show deload tab only when `has_deload=true`. Each tab edits its own variant rows independently. Same template usable on both. All 7 days on both tabs. | medium | Weekly Schedule | T032 | normal-vs-deload-tabs |
| T034 | Rest day display: days with no schedule row shown as "Rest" (distinct styling). All 7 days always visible. Rest state derived from absence of row, not a separate record. Independent per variant. | small | Weekly Schedule | T032 | explicit-rest-days |

## Wave 8: Cascade + Clone + Routines

> Three parallel tracks. Cascade needs T023+T031, Clone needs T027+T031, Routines need T018.

### Track A: Template Cascade

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T035 | Cascade sibling query: find templates with same `canonical_name` across mesocycles. Three scopes: "this only" (no siblings), "this + future" (active/planned created after current), "all phases" (all active/planned). Exclude `status=completed`. | medium | Template Cascade | T023, T031 | cascade-scope-selection |
| T036 | Cascade atomic execution SA: update all targets in single transaction. Skip templates with existing logged workouts. Return summary (updated count, skipped count). Cancel aborts all changes. | medium | Template Cascade | T035 | cascade-scope-selection |
| T037 | Cascade scope selection UI: inline confirmation step on save. Show three scope options. Summary after execution. | medium | Template Cascade | T036 | cascade-scope-selection |
| T038 | Block direct edits on completed mesocycle templates (SA returns error). | small | Template Cascade | T036, T021 | completed-mesocycle-protection |
| T039 | Cascade skips completed mesocycles silently. Summary shows skipped count. All three scopes respect this. | small | Template Cascade | T038 | completed-mesocycle-protection |

### Track B: Mesocycle Cloning

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T040 | Clone mesocycle SA: single atomic transaction copies mesocycle + all workout_templates + all exercise_slots + all weekly_schedule (normal + deload). New IDs, same canonical_names. Status=planned. Reject if source has no templates. Compute new end_date. | large | Mesocycle Cloning | T027, T031 | clone-mesocycle |
| T041 | Clone form UI: collect new name + start_date (required). work_weeks + has_deload copied from source, overridable. Navigate to new mesocycle on success. | small | Mesocycle Cloning | T040 | clone-mesocycle |
| T042 | Canonical name preservation: verify cloned templates have identical canonical_names. Cross-phase query returns both source + clone. Cascade includes cloned template when active/planned. | small | Mesocycle Cloning | T040 | canonical-name-preservation |

### Track C: Routine Items

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T043 | Create routine item SA: name (required), category (required), value_type (boolean\|duration\|count), frequency_target (>=1), scope_type (global\|per_mesocycle\|date_range\|skip_on_deload). Scope-specific field validation. | medium | Daily Routines | T018 | routine-item-crud |
| T044 | Routine item list (name, category, value_type, frequency_target, scope summary). Edit SA (scope change clears old fields). Delete SA (preserves routine_logs). | small | Daily Routines | T043 | routine-item-crud |

## Wave 9: Today's Workout

> Depends on schedule (T032) and status management (T021).

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T045 | `GET /api/today` route handler: lookup chain (active mesocycle → day_of_week → deload week detection → variant → weekly_schedule → template + slots). Returns `type: workout \| rest_day \| no_active_mesocycle`. Deload = last week when `has_deload=true`. | medium | Today's Workout | T032, T021 | view-todays-planned-workout |
| T046 | Today's resistance workout display: template name, exercises in sort_order with all targets, main/complementary distinction. Mobile-first, large tap targets. | medium | Today's Workout | T045 | view-todays-planned-workout |
| T047 | Today's running workout display (run_type, pace, HR zone, interval details, cues) + MMA/BJJ display (duration, notes). Modality-specific rendering. | small | Today's Workout | T045 | view-todays-planned-workout |

## Wave 10: Workout Logging - Resistance

> Depends on today's view (T045) and exercise slots (T027).

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T048 | Logging form structure: exercises in sort_order, one set row per target_sets. Pre-fill actual_weight from target_weight, actual_reps from target_reps. Null target_weight → blank (not zero). Mobile-first, "Save Workout" prominent. | medium | Workout Logging | T045, T027 | pre-filled-resistance-logging |
| T049 | Actual set input fields: actual_reps (required, positive int), actual_weight (optional, non-negative), actual_rpe (optional, 1-10, NOT pre-filled). Planned values shown read-only alongside. Numeric keyboards on mobile. | small | Workout Logging | T048 | actual-set-input |
| T050 | Add/remove set rows: "Add Set" copies weight/reps from last row (not RPE). "Remove" blocked on last remaining set. Modified set count saved, template_snapshot reflects original plan. | small | Workout Logging | T048 | add-remove-sets |
| T051 | Rating (1-5, optional, null≠0) + notes (free text, optional, whitespace→null). Positioned at bottom near save button. | small | Workout Logging | T048 | workout-rating-notes |
| T052 | Save workout SA: atomic transaction creates `logged_workouts` (with template_snapshot JSON, version:1, canonical_name) + `logged_exercises` (per exercise, snapshotted name) + `logged_sets` (per set, actuals). Rollback on any failure. | large | Workout Logging | T048, T049, T050, T051 | log-immutability, pre-filled-resistance-logging |
| T053 | Immutability enforcement: no UPDATE/DELETE SAs for log tables. No edit UI for logged workouts. Template edits after logging don't affect snapshots. | small | Workout Logging | T052 | log-immutability |

## Wave 11: Workout Logging - Running + MMA/BJJ

> Parallel with Wave 10 resistance logging after T045.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T054 | Running logging form: planned reference (read-only), actual_distance (non-negative), actual_avg_pace (text), actual_avg_hr (positive int). All optional. Template_snapshot + canonical_name. No logged_exercises/sets rows. Save SA atomic. | medium | Workout Logging | T045, T025 | running-logging |
| T055 | Running rating & notes: same rating (1-5) + notes behavior as resistance. Part of same atomic transaction. | small | Workout Logging | T054 | running-rating-notes |
| T056 | Interval logging: shown only for run_type=interval. Rows = interval_count. Per-rep: interval_pace (text), interval_avg_hr (positive int), interval_notes (collapsed by default). Stored as JSON array on logged_workouts. | medium | Workout Logging | T054 | interval-logging |
| T057 | MMA/BJJ logging form: actual_duration_minutes (positive int), feeling (1-5), notes. All optional. Template_snapshot + canonical_name. No logged_exercises/sets rows. Save SA atomic. | small | Workout Logging | T045, T026 | mma-bjj-logging |

## Wave 12: Already-Logged + Rest Day + Routine Check-off

> Depends on logging (T052/T054/T057) and routines (T043).

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T058 | Already-logged detection: check logged_workouts for today's date + active mesocycle. Detection via calendar date match (not timestamp). Part of `GET /api/today` response. | small | Today's Workout | T045, T052 | already-logged-summary |
| T059 | Already-logged summary display: workout name, logged_at, modality-specific actuals (resistance: exercises/sets, running: distance/pace/HR, MMA: duration/notes). Rating + notes if present. Read-only, no edit controls. | medium | Today's Workout | T058 | already-logged-summary |
| T060 | Re-logging prevention: no "Log Workout" button when already logged. Server-side duplicate check (same date + mesocycle → reject). | small | Today's Workout | T058 | already-logged-summary |
| T061 | Active routine scope filtering: global (always), per_mesocycle (active mesocycle in range), date_range (today in range), skip_on_deload (exclude during deload weeks). | medium | Daily Routines | T043 | daily-routine-check-off |
| T062 | Mark done/skipped SA: creates routine_log row (routine_item_id, log_date, status, optional value). Block duplicate same item+date. Immutable after insert. Numeric value for duration/count types. Mobile check-off UI. | medium | Daily Routines | T061 | daily-routine-check-off |
| T063 | Rest day display: "Rest Day" heading, no workout content, show active daily routines below (fully functional check-off). Empty state if no routines. | small | Today's Workout | T045, T062 | rest-day-display |

## Wave 13: Calendar & Progression

> Two parallel tracks. Calendar depends on schedule (T032). Progression depends on log immutability (T053).

### Track A: Calendar

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T064 | `GET /api/calendar` projection logic: accept `month=YYYY-MM`, iterate each day, map to mesocycle + day_of_week + variant → template. Include modality, is_deload flag, completion status (logged_workouts check). Days outside mesocycle ranges → rest. | medium | Calendar & Progression | T032 | projected-calendar, deload-week-distinction, completed-day-markers |
| T065 | Calendar month grid UI: 7 columns (Mon-Sun), modality color-coding (3 distinct colors + rest), prev/next month nav. Current month default. | medium | Calendar & Progression | T064 | projected-calendar |
| T066 | Day detail drill-in: inline panel/modal on day click. Projected days read live template; completed days read template_snapshot. Rest days show "Rest Day". Resistance: slots with targets + actuals. Running/MMA: modality fields. Rating + notes. Dismissible. | medium | Calendar & Progression | T064 | day-detail-drill-in |
| T067 | Completed day markers: `status` field (completed\|projected\|rest) on each calendar entry. Completed = logged_workouts row exists for that date. Distinct visual marker alongside modality color. Past unlogged = projected (missed workout visible). | small | Calendar & Progression | T064, T053 | completed-day-markers |
| T068 | Deload week distinction: `is_deload` flag on calendar entries. Last week of mesocycle with has_deload=true. Distinct visual treatment (background/border). Legend/label. Spans month boundaries correctly. | small | Calendar & Progression | T064, T033 | deload-week-distinction |

### Track B: Progression

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T069 | `GET /api/progression` route handler: accept canonical_name + optional exercise_id. Cross-phase query via canonical_name on logged_workouts. Data points: date, mesocycle, planned weight (from template_snapshot), actual weight (from logged_sets), planned volume, actual volume. Time-ordered. Top-set weight + total volume calculations. | medium | Calendar & Progression | T053 | exercise-progression-chart |
| T070 | Exercise progression chart UI: exercise selector, two data series (planned vs actual), time axis. Weight view (top-set) + volume view (toggle). Phase-colored data points. Empty state if no data. | medium | Calendar & Progression | T069 | exercise-progression-chart |
| T071 | Phase boundary markers: `phases` array in progression response (mesocycle id, name, start_date, end_date). Only mesocycles with data points. Vertical marker lines at start/end dates. Labeled with mesocycle name. Start vs end visually distinct. | small | Calendar & Progression | T069 | phase-boundary-markers |

## Wave 14: Routine Analytics

> Depends on routine check-off (T062).

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T072 | Weekly completion count: count `done` logs in current Mon-Sun week per item. Display as "3/5 this week" alongside frequency_target. Excludes `skipped`. Resets each Monday. | small | Daily Routines | T062 | routine-streaks-counts |
| T073 | Streak calculation: consecutive calendar days ending today (or yesterday) with `done` status. Broken by `skipped` or missing day. Display per item with visual indicator. Updates immediately after check-off. | small | Daily Routines | T062 | routine-streaks-counts |

---

## Dependency Graph (Spec Level)

```
db-schema-migrations
└── auth-system
    └── app-shell-navigation
        ├── exercise-crud
        │   ├── exercise-search-filter ──────────────────┐
        │   └── exercise-deletion-protection             │
        └── create-mesocycle                             │
            ├── auto-calculate-end-date                  │
            ├── mesocycle-status-management ──────────┐   │
            ├── routine-item-crud                    │   │
            │   └── daily-routine-check-off          │   │
            │       └── routine-streaks-counts       │   │
            ├── create-resistance-templates          │   │
            │   ├── exercise-slots ◄─────────────────┼───┘
            │   │   ├── drag-reorder-exercises       │
            │   │   ├── main-vs-complementary        │
            │   │   └── clone-mesocycle ◄─────────┐  │
            │   │       └── canonical-name-pres.  │  │
            │   ├── 7-day-assignment-grid ────────┤  │
            │   │   ├── normal-vs-deload-tabs     │  │
            │   │   ├── explicit-rest-days        │  │
            │   │   ├── projected-calendar        │  │
            │   │   │   ├── day-detail-drill-in   │  │
            │   │   │   ├── completed-day-markers │  │
            │   │   │   └── deload-week-distinct. │  │
            │   │   └── view-todays-workout ◄─────┼──┘
            │   │       ├── already-logged-summary│
            │   │       ├── rest-day-display      │
            │   │       ├── pre-filled-logging    │
            │   │       │   ├── actual-set-input  │
            │   │       │   ├── add-remove-sets   │
            │   │       │   ├── workout-rating    │
            │   │       │   └── log-immutability  │
            │   │       │       ├── completed-markers
            │   │       │       └── progression-chart
            │   │       │           └── phase-markers
            │   │       ├── running-logging       │
            │   │       │   ├── running-rating    │
            │   │       │   └── interval-logging  │
            │   │       └── mma-bjj-logging       │
            │   └── cascade-scope-selection       │
            │       └── completed-meso-protection │
            ├── running-templates                 │
            └── mma-bjj-template-support          │
```

## Scope Summary

| Scope | Count | Est. Hours Each | Total |
|-------|-------|-----------------|-------|
| Small | 49 | 1-2h | ~74h |
| Medium | 30 | 2-4h | ~90h |
| Large | 4 | 4-8h | ~24h |
| **Total** | **83** | | **~188h** |

## Epics

| Epic | Task Count | Specs Covered |
|------|-----------|---------------|
| Foundation | 12 | db-schema-migrations, auth-system, app-shell-navigation |
| Exercise Library | 5 | exercise-crud, exercise-search-filter, exercise-deletion-protection |
| Mesocycle Lifecycle | 5 | create-mesocycle, auto-calculate-end-date, mesocycle-status-management |
| Workout Templates | 10 | create-resistance-templates, running-templates, mma-bjj-template-support, exercise-slots, drag-reorder-exercises, main-vs-complementary-marking |
| Weekly Schedule | 4 | 7-day-assignment-grid, normal-vs-deload-tabs, explicit-rest-days |
| Template Cascade | 5 | cascade-scope-selection, completed-mesocycle-protection |
| Mesocycle Cloning | 3 | clone-mesocycle, canonical-name-preservation |
| Today's Workout | 6 | view-todays-planned-workout, already-logged-summary, rest-day-display |
| Workout Logging | 10 | pre-filled-resistance-logging, actual-set-input, add-remove-sets, workout-rating-notes, log-immutability, running-logging, running-rating-notes, interval-logging, mma-bjj-logging |
| Calendar & Progression | 8 | projected-calendar, day-detail-drill-in, completed-day-markers, deload-week-distinction, exercise-progression-chart, phase-boundary-markers |
| Daily Routines | 5 | routine-item-crud, daily-routine-check-off, routine-streaks-counts |
| UI Overhaul | 9 | ui-overhaul-shadcn-theme |
| UI Redesign | 10 | layout-system, mobile-logging-redesign, visual-consistency-pass |

---

## Wave UI-1: Theme Foundation

> No feature dependencies. Can run in parallel with any wave.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T074 | OKLCH theme setup: globals.css with full CSS custom properties (primary, secondary, muted, accent, destructive, background, foreground, card, popover, border, ring, chart-1 through chart-5). Light + dark palettes. Dark mode via `prefers-color-scheme`. Base layer: `border-border`, `outline-ring/50`, body `bg-background text-foreground`. Copy expense-tracker's OKLCH color system. | medium | UI Overhaul | T012 | ui-overhaul-shadcn-theme |
| T075 | Geist fonts + root layout: install `geist` font package, configure in root layout. Add Providers wrapper component. Install + mount Sonner Toaster. Add `suppressHydrationWarning` to html element. | small | UI Overhaul | T074 | ui-overhaul-shadcn-theme |
| T076 | Install shadcn/ui components: select, checkbox, dialog, alert-dialog, tabs, sheet, dropdown-menu, popover, badge, skeleton, textarea. All must use OKLCH theme tokens. Verify each renders correctly in light + dark mode. | medium | UI Overhaul | T074 | ui-overhaul-shadcn-theme |

## Wave UI-2: Navigation + Form Refactoring

> Depends on Wave UI-1. All tasks in this wave are parallel.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T077 | Navigation overhaul: replace fixed sidebar with collapsible sidebar (toggle, localStorage persistence). Replace bottom bar with top header bar (menu toggle left, logout right) + Sheet mobile nav (slide from left). Same 5 nav items. Active route indicator. Responsive breakpoint swap. | large | UI Overhaul | T075, T076 | ui-overhaul-shadcn-theme |
| T078 | Exercise form refactor: replace raw `<select>` elements for modality and muscle_group with shadcn Select component. Match theme styling. | small | UI Overhaul | T076 | ui-overhaul-shadcn-theme |
| T079 | Mesocycle form refactor: replace raw `<input type="checkbox">` with shadcn Checkbox for has_deload. Replace raw `<input type="date">` with themed date input (consistent with design system). | small | UI Overhaul | T076 | ui-overhaul-shadcn-theme |
| T080 | Schedule tabs refactor: replace custom div-based tab switching in ScheduleTabs with shadcn Tabs component. Normal/deload tab content unchanged. | small | UI Overhaul | T076 | ui-overhaul-shadcn-theme |
| T081 | Status indicators refactor: replace hardcoded color StatusBadge with shadcn Badge using semantic theme tokens. Add Skeleton loading states to replace `animate-pulse` divs across pages. | small | UI Overhaul | T076 | ui-overhaul-shadcn-theme |

## Wave UI-3: Visual Polish

> Depends on Wave UI-2. Final consistency pass.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T082 | Visual consistency pass: ensure all cards use `rounded-xl` + `shadow-sm`. Normalize page spacing to `max-w-4xl` containers with `gap-4`/`gap-6`. Add theme-consistent hover/focus transitions to all interactive elements. Verify no raw HTML form elements remain. | medium | UI Overhaul | T077, T078, T079, T080, T081 | ui-overhaul-shadcn-theme |

---

## Wave R1: Layout System

> Depends on UI Overhaul (T082 complete). Foundation for all redesign work.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T083 | PageContainer component: shared wrapper with adaptive max-width (`max-w-lg` for Today/Routines, `max-w-4xl` for Exercises/Mesocycles/Calendar/Progression). Centered, `px-4 sm:px-6 lg:px-8` progressive padding, `py-6` vertical padding. Accepts `variant` prop (`narrow` \| `wide`). | small | UI Redesign | T082 | layout-system |
| T084 | PageHeader component: title (required), description (optional, muted text), actions slot (optional). Mobile: actions stack below title. Desktop: actions inline right. Consistent `space-y-1.5` between title and description, `mb-6` bottom margin. | small | UI Redesign | T083 | layout-system |
| T085 | Adopt PageContainer + PageHeader across all pages: Today, Exercises, Mesocycles (list + detail + new + clone), Calendar, Progression, Routines. Remove per-page ad-hoc container classes. Fix Calendar and Progression pages to use the container system (currently no max-w constraint). | medium | UI Redesign | T083, T084 | layout-system |

## Wave R2: Mobile Logging Redesign

> Depends on layout system (T083). Critical path for mobile UX.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T086 | RPE schema migration: add `actual_rpe` column (real, nullable) to `logged_exercises` table. Drop `actual_rpe` column from `logged_sets` table. Generate + apply migration via `drizzle-kit generate && drizzle-kit migrate`. Update Drizzle schema + relations. | small | UI Redesign | T083 | mobile-logging-redesign |
| T087 | 3-column set input grid: refactor resistance logging form from 5-column grid (set#/weight/reps/RPE/delete) to 3-column grid (weight/reps/delete). Set number as non-interactive label left of inputs. Planned values shown as placeholder text in inputs (not separate reference row). Inputs wide enough for 5+ chars (weight) and 3+ chars (reps). | medium | UI Redesign | T086 | mobile-logging-redesign |
| T088 | Per-exercise RPE selector: row of 10 tappable buttons (1-10) below each exercise's set rows. Tap to select (highlighted), tap again to deselect (null). Stored on `logged_exercises.actual_rpe`. All RPE buttons meet 44px min touch target. Wraps to 2 rows on viewports <340px. | medium | UI Redesign | T087 | mobile-logging-redesign |
| T089 | Touch target enforcement: increase all interactive elements in logging form to 44px minimum tappable area. Delete button (currently 32px → 44px via padding hit area). Add Set button (currently ~32px → 44px height). Rating stars (currently 40px → 44px). Save button already compliant (56px). | small | UI Redesign | T087 | mobile-logging-redesign |
| T090 | Update save workout SA: read `actual_rpe` from per-exercise form data (not per-set). Write to `logged_exercises.actual_rpe` instead of `logged_sets.actual_rpe`. Preserve atomic transaction. Update template_snapshot if RPE field references changed. | medium | UI Redesign | T086, T088 | mobile-logging-redesign |

## Wave R3: Visual Consistency

> Depends on layout system (T085). All tasks in this wave are parallel.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T091 | Modality color utility: extract hardcoded modality colors (blue=resistance, green=running, amber=mma) into a shared `lib/ui/modality-colors.ts` mapping. Provides both light and dark mode class names. Includes fallback for unknown modality (neutral/gray). Refactor calendar-grid, status-badge, template cards, day-detail-panel to use it. | small | UI Redesign | T085 | visual-consistency-pass |
| T092 | Card normalization: audit all Card usages across pages. Ensure consistent `rounded-xl` + `shadow-sm`. Standardize card header action placement (top-right). Verify theme token usage for background/border/shadow in both light and dark mode. | small | UI Redesign | T085 | visual-consistency-pass |
| T093 | Empty state component: shared `EmptyState` component (icon, message, action button). Apply to Exercises, Mesocycles, and Routines list pages. Consistent layout and visual treatment across all empty states. | small | UI Redesign | T085 | visual-consistency-pass |
| T094 | Progressive padding + interactive feedback: update PageContainer to use `px-4 sm:px-6 lg:px-8` (already in T083, verify). Add subtle hover/press transitions to clickable cards and list items (consistent `transition-colors duration-150`). No transitions on disabled elements. | small | UI Redesign | T085 | visual-consistency-pass |

## UI Redesign Dependency Graph

```
T082 (UI Overhaul complete)
├── T083 (PageContainer) → T084 (PageHeader) → T085 (Adopt across pages)
│   ├── T091 (Modality colors)
│   ├── T092 (Card normalization)
│   ├── T093 (Empty states)
│   └── T094 (Progressive padding + feedback)
└── T086 (RPE migration) → T087 (3-col grid) → T088 (RPE selector) → T090 (Save SA update)
                                               └── T089 (Touch targets)
```

## UI Redesign Critical Path

T082 → T083 → T086 → T087 → T088 → T090 (estimated: M + S + S + M + M + M = ~14-20h)

## UI Redesign Risk Areas

- **T086 (RPE migration)**: Schema change moves `actual_rpe` from `logged_sets` to `logged_exercises`. If production data exists in `logged_sets.actual_rpe`, a data migration step is needed. Verify before deploying.
- **T087 (3-col grid)**: Major UX change to resistance logging. Removing planned values reference row means users lose side-by-side comparison — mitigated by placeholder text showing targets.
- **T090 (Save SA update)**: Must update all code paths that read/write RPE — server action, form submission, snapshot generation. Risk of partial migration if any path is missed.

---

## Wave F1: Enhancement — Schema + Shared Components

> No dependencies on new work. All depend only on existing completed tasks. All tasks parallel.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T095 | Schema migration: add `period` (text NOT NULL enum 'morning'\|'afternoon'\|'evening') + `time_slot` (text nullable "HH:MM") to `weekly_schedule`. Replace unique constraint `(mesocycle_id, day_of_week, variant)` with `(mesocycle_id, day_of_week, variant, period)`. Default existing rows to period='morning'. | small | Schedule & Calendar | — | workout-time-slots |
| T096 | Schema migration: new `template_sections` table (id, template_id FK, modality enum, section_name, order, run_type, target_pace, hr_zone, interval_count, interval_rest, coaching_cues, planned_duration, created_at). Add nullable `section_id` FK on `exercise_slots`. Extend `workout_templates.modality` enum with 'mixed'. | medium | Template System | — | mixed-modality-templates |
| T097 | Schema migration: add `frequency_mode` (text NOT NULL default 'weekly_target', enum 'daily'\|'specific_days'\|'weekly_target') + `frequency_days` (text nullable, JSON array of day numbers 0-6) to `routine_items`. Existing rows default to 'weekly_target'. | small | Daily Habits | — | routines-ux-improvements |
| T098 | Shared auto-suggest combobox component: input + dropdown list, populated from prop data, type-to-filter (case-insensitive), select existing or type new value, mobile-friendly. Uses shadcn Popover + Command pattern. | medium | Shared UI | — | exercise-creation-ux |
| T099 | Server queries: `getDistinctExerciseValues()` returns sorted unique equipment + muscle_group values. `getDistinctRoutineCategories()` returns sorted unique category values. Null/empty excluded. | small | Shared | — | exercise-creation-ux, routines-ux-improvements |
| T100 | Add Progression nav item: TrendingUp icon, links to `/progression`, positioned after Calendar. Update nav-items.ts + verify in both desktop sidebar and mobile sheet. | small | Navigation | — | navigation-discoverability |
| T101 | Slot matching utility: given a source template + slot change, find corresponding slots in sibling templates by (exercise_id + order) primary match, fallback to (exercise_id, any position) for single matches, skip if ambiguous. Returns match map with skip reasons. | medium | Template Cascade | T035 | cascade-slot-edits |

## Wave F2: Enhancement — Core Logic

> Depends on Wave F1. Multiple parallel tracks.

### Track A: Time Slots

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T102 | Period pill selector component: 3 toggle pills (Morning/Afternoon/Evening), required selection. Optional time picker (expandable, mobile-friendly scroll/wheel). Auto-derive period from clock time (before 12→morning, 12-16:59→afternoon, 17+→evening). Manual override allowed. | medium | Schedule & Calendar | T095 | workout-time-slots |
| T103 | Update schedule assignment SA: accept `period` (required) + `time_slot` (optional). Validate no duplicate (day, variant, period). Update remove/replace flows. | small | Schedule & Calendar | T095 | workout-time-slots |

### Track B: Template Cascade Extension

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T104 | Make running template fields (run_type, target_pace, hr_zone, interval_count, interval_rest, coaching_cues) + MMA planned_duration editable post-creation. Edit UI on template row. Cascade scope selector on save. | medium | Template Cascade | T101 | cascade-slot-edits |
| T105 | Cascade slot parameter changes SA: when editing sets/reps/weight/RPE/rest/guidelines on a slot, apply same 3-scope cascade (this only / this+future / all phases). Use slot matching utility. Skip logged/completed. Return summary counts. | large | Template Cascade | T101 | cascade-slot-edits |
| T106 | Cascade add/remove exercise slot SA: adding a slot cascades to sibling templates (append if order conflict). Removing cascades with match-by-exercise_id (skip if no match). Re-order remaining after remove. Return summary. | large | Template Cascade | T101 | cascade-slot-edits |

### Track C: Mixed Templates

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T107 | Mixed template creation SA: create workout_template with modality='mixed', then add template_sections. Section management SAs: add section (name, modality, modality-specific fields, order), remove section (validate 2+ remain with different modalities), reorder sections. | medium | Template System | T096 | mixed-modality-templates |

### Track D: Exercise + Routine UX

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T108 | Collapsible exercise creation form: collapsed by default, "+ New Exercise" button expands. Smooth transition. Reset on collapse. Integrate comboboxes for equipment + muscle_group (create form). | medium | Exercise Library | T098, T099 | exercise-creation-ux |
| T109 | Edit exercise form: replace equipment + muscle_group text inputs with comboboxes. Same data source as create form. | small | Exercise Library | T098, T099 | exercise-creation-ux |
| T110 | Frequency mode selector component: 3-option toggle (Daily / Specific Days / X per Week). Day picker: 7 circular S-M-T-W-T-F-S pills, multi-select, min 1 required, 40px+ touch target. Number input for weekly target. Mode switch clears previous data. | medium | Daily Habits | T097 | routines-ux-improvements |
| T111 | Update routine create + edit forms: integrate frequency mode selector + category combobox. Pre-fill on edit. Validate per mode. | medium | Daily Habits | T110, T098, T099 | routines-ux-improvements |

### Track E: Navigation Quick Links

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T112 | Today page quick links: pencil/edit icon on workout → links to /mesocycles/[id] template section. "No active mesocycle" prompt with link. Hide edit for completed mesocycles. | small | Navigation | — | navigation-discoverability |

## Wave F3: Enhancement — UI Integration

> Depends on Wave F2. Multiple parallel tracks.

### Track A: Time Slots UI

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T113 | Schedule grid: render multiple entries per day stacked, ordered by period (morning→afternoon→evening). Period label on each entry. Add button per unused period slot. | medium | Schedule & Calendar | T102, T103 | workout-time-slots |
| T114 | GET /api/today: return array of workouts when multiple sessions scheduled. Include period + time_slot in response. Today page: render sessions grouped by period with time labels. | medium | Schedule & Calendar | T095, T102 | workout-time-slots |
| T115 | Calendar month grid: show multiple workouts per day as stacked pills/badges with period labels. Update GET /api/calendar to include period + time_slot. | small | Schedule & Calendar | T095 | workout-time-slots |

### Track B: Cascade UI

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T116 | Cascade scope selector: trigger on slot param edits, slot add/remove, running/MMA field edits. Show preview of affected templates. Summary of updated/skipped. Template notes field editable with cascade support. | medium | Template Cascade | T105, T106, T104 | cascade-slot-edits |

### Track C: Mixed Templates UI

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T117 | Mixed template creation form: "+ Mixed Workout" button, name input, section editor (add sections with name + modality, modality-specific fields per section, drag-reorder, min 2 sections with different modalities). Reuses existing slot editor for resistance sections. | large | Template System | T107 | mixed-modality-templates |

### Track D: Routines + Polish

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T118 | Update routine scope filtering for frequency modes: daily=every day, specific_days=check day-of-week, weekly_target=every day (existing). Filter after scope check. | medium | Daily Habits | T097, T110 | routines-ux-improvements |
| T119 | Header/padding audit: standardize all page headers to PageHeader with mb-6, H2 with mt-8 mb-4. Ensure all pages use PageContainer. Fix inconsistent card spacing. Verify mobile pt-14 offset. 44px touch targets. Typography scale enforcement. | medium | Navigation & Discoverability | — | ui-polish-headers-padding |

### Track E: Backward Compat

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T120 | Clone mesocycle: copy period + time_slot for schedule entries. Copy template_sections + section-associated exercise slots for mixed templates. | small | Mesocycle Cloning | T095, T096 | workout-time-slots, mixed-modality-templates |

## Wave F4: Enhancement — Completion

> Depends on Wave F3. Final integration tasks.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T121 | Mixed template display on Today page: render sections in order with headers + modality badges. Resistance sections show exercise slots. Running sections show run plan. MMA sections show duration. Visual separator between sections. | medium | Template System | T096, T114 | mixed-modality-templates |
| T122 | Mixed template logging form: section-by-section inputs (resistance, running, MMA — reuses existing logging form components embedded per section). Single "Save Workout" button. Atomic save SA. Template snapshot v2 with sections array. | large | Template System | T121 | mixed-modality-templates |
| T123 | Calendar + schedule: mixed templates show combined modality badge. Schedule grid assigns mixed templates like any other. Canonical name cascade works for mixed. | small | Template System | T096, T117 | mixed-modality-templates |
| T124 | Calendar day detail: quick link to "Edit template" next to workout name → /mesocycles/[id]. Rest days link to schedule grid. (Depends on T066 day detail existing.) | small | Navigation | T066 | navigation-discoverability |

---

## Enhancement Dependency Graph

```
T095 (time slots schema)
├── T102 (period selector) ──┬── T113 (schedule grid multi)
│                            │── T114 (today multi-session) ── T121 (mixed today display) ── T122 (mixed logging)
├── T103 (assign SA) ────────┘
├── T115 (calendar multi)
└── T120 (clone copy)

T096 (mixed schema)
├── T107 (mixed SAs) ── T117 (mixed form UI) ── T123 (calendar mixed)
├── T121 (mixed today)
├── T120 (clone copy)
└── T123 (calendar mixed)

T097 (routines schema)
├── T110 (frequency selector) ── T111 (routine forms)
└── T118 (scope filtering)

T098 (combobox)
├── T108 (exercise form)
├── T109 (edit exercise form)
└── T111 (routine forms)

T099 (distinct queries) ── T108, T109, T111

T100 (progression nav) ── standalone

T101 (slot matching)
├── T104 (running/MMA editable)
├── T105 (cascade slot params) ──┬── T116 (cascade scope UI)
└── T106 (cascade add/remove) ──┘

T112 (today quick links) ── standalone
T119 (header/padding audit) ── standalone
T124 (calendar quick links) ── T066
```

## Enhancement Critical Path

T096 → T107 → T117 → T121 → T122 (estimated: M + M + L + M + L = ~22-30h)

Alternative path: T101 → T105 → T116 (M + L + M = ~12-16h)

## Enhancement Scope Summary

| Scope | Count | Est. Hours Each | Total |
|-------|-------|-----------------|-------|
| Small | 12 | 1-2h | ~18h |
| Medium | 14 | 2-4h | ~42h |
| Large | 4 | 4-8h | ~24h |
| **Total** | **30** | | **~84h** |

## Enhancement Epics

| Epic | Task Count | Spec |
|------|-----------|------|
| Schedule & Calendar (Time Slots) | 7 | workout-time-slots |
| Template Cascade Extension | 6 | cascade-slot-edits |
| Template System (Mixed Modality) | 7 | mixed-modality-templates |
| Exercise Library UX | 2 | exercise-creation-ux |
| Daily Habits (Routines) | 4 | routines-ux-improvements |
| Navigation & Discoverability | 4 | navigation-discoverability, ui-polish-headers-padding |

## Enhancement Gap Analysis

1. **workout-time-slots**: Unique constraint on `(day, variant, period)` caps at 3 workouts per day. User said "don't need 3 but might later." If N>3 needed, constraint changes. Acceptable for now.
2. **cascade-slot-edits**: Same exercise appearing multiple times in a template (e.g., two bench press slots) creates ambiguous matching. Spec defines fallback but not the ambiguous case. **Mitigated**: skip if ambiguous, report in summary.
3. **mixed-modality-templates**: Running fields stored on template_sections for mixed, but on workout_templates for pure running. Query layer must handle both. No migration of existing data needed — pure templates keep fields on workout_templates.
4. **routines-ux-improvements**: `specific_days` filtering is additive to scope. Sequence: scope filter first (global/mesocycle/date_range), then frequency filter (daily=pass, specific_days=check day, weekly_target=pass).
5. **navigation-discoverability**: T124 (calendar quick links) depends on T066 (day detail) which is not yet implemented. Deferred to Wave F4.
6. **ui-polish-headers-padding**: Broad spec based on code review. Will refine after visual browser audit.

## Enhancement Risk Areas

- **T096 (mixed schema)**: template_sections stores running fields per-section. Must not break existing pure-modality template queries. Test backward compat thoroughly.
- **T105/T106 (cascade slot edits)**: Complex matching logic across diverged templates. Edge cases with reordered/added/removed exercises. Needs comprehensive test coverage.
- **T122 (mixed logging)**: Composite form saving multiple modalities atomically. Snapshot v2 format change. Must not break existing snapshot v1 reads.
- **T095 (time slots schema)**: Adding NOT NULL column with default to existing rows. Migration must handle existing schedule data correctly.

---

## Wave F5: Run Distance/Duration + Supersets + Cascade UX

> Three new features: running template distance/duration, exercise supersets, cascade auto-dismiss.
> **Parallelism**: tasks within each sub-wave can run concurrently in separate worktrees.

### Sub-wave F5.1 (no deps — parallel)

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T125 | Cascade auto-dismiss (2s timeout + Done fallback) | small | UX Polish | — | cascade-auto-dismiss |
| T126 | Schema: target_distance/target_duration on templates + group_id/group_rest_seconds on slots + migrate | small | Foundation | — | run-distance-duration, supersets |

### Sub-wave F5.2

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T127 | Types/queries: update TemplateOption, SlotWithExercise, TemplateInfo, SectionData, SlotData + test fixtures | small | Foundation | T126 | run-distance-duration, supersets |

### Sub-wave F5.3 (parallel — 4 independent branches)

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T128 | SA: running template create/edit + cascade with distance/duration | medium | Running Templates | T127 | run-distance-duration |
| T130 | UI: distance/duration display on today page + logging form reference | small | Running Templates | T127 | run-distance-duration |
| T131 | Snapshot: include target_distance/target_duration in running + mixed workout snapshots | small | Running Templates | T127 | run-distance-duration |
| T132 | SA: createSuperset, breakSuperset, updateGroupRest | medium | Workout Templates | T127 | supersets |

### Sub-wave F5.4 (parallel — 2 branches)

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T129 | UI: distance/duration inputs on running-template-form, mixed-template-form, template-section inline edit | medium | Running Templates | T128 | run-distance-duration |
| T133 | UI: slot-list visual grouping, selection mode, group CRUD, reorder awareness | large | Workout Templates | T132 | supersets |

### Sub-wave F5.5

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T134 | UI: superset display in logging form + today page + resistance workout snapshot | medium | Workout Templates | T133 | supersets |

## Wave F5 Dependency Graph

```
T125 (cascade auto-dismiss) ── standalone
T126 (schema)
└── T127 (types/queries)
    ├── T128 (running SA) → T129 (running UI)
    ├── T130 (today + logging display)
    ├── T131 (running snapshot)
    └── T132 (superset SA) → T133 (superset UI) → T134 (superset display + snapshot)
```

## Wave F5 Critical Path

T126 → T127 → T132 → T133 → T134 (estimated: S + S + M + L + M = ~16-24h)

## Wave F5 Risk Areas

- **T133 (superset UI)**: Largest task. Drag-reorder with group awareness is complex. May need to simplify: move groups as unit, auto-ungroup on solo drag.
- **T127 (types/queries)**: Many files touched. Test fixtures need updating for required fields. Low risk but tedious.

---

## Wave P1: Template UX — Quick Fixes

> No new dependencies. All tasks parallel. Can run concurrently in separate worktrees.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T135 | Number input zero fix: replace `type="number"` inputs with controlled text inputs + numeric validation. Backspace to empty shows blank (not "0"), typing after clear gives clean value (not "05"). `inputMode="numeric"` for integers, `inputMode="decimal"` for weight/RPE. Normalize on blur. Affects: slot-list.tsx (sets/reps/weight/RPE/rest), template forms (duration, intervals, pace), logging forms. | small | UX Polish | — | number-input-zero-fix |
| T136 | Cascade toast notification: remove the inline "Cascade complete" summary panel + "Done" button from both cascade-scope-selector.tsx and slot-cascade-scope-selector.tsx. On cascade success, fire `toast.success()` (Sonner) with summary counts ("3 updated, 1 skipped"), close selector immediately, return row to display mode. Supersedes T125 auto-dismiss approach — summary step eliminated entirely, not just auto-dismissed. | small | UX Polish | — | cascade-toast-notification |
| T137 | Template copy server action: `copyTemplateToMesocycle(sourceTemplateId, targetMesocycleId)`. Copies template row + all exercise_slots (with new IDs), template_sections (for mixed), superset groups. Preserves canonical_name. Rejects if target meso already has same canonical_name. Single transaction. Supports all modalities (resistance, running, MMA, mixed). | small | Template UX | — | template-copy-from-existing |

## Wave P2: Template UX — Feature UI

> Depends on Wave P1. Two parallel tracks.

### Track A: Template Add Picker + Copy Browse

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T138 | Template add picker + copy browse UI: replace 4 inline type buttons in template-section.tsx with single "Add Template" button. Mobile (< 640px): opens bottom sheet (shadcn Sheet). Desktop: opens dropdown popover. Options: Resistance, Running, MMA/BJJ, Mixed, "From Existing". Selecting a type opens existing creation form. "From Existing" opens browse dialog: templates grouped by mesocycle, search/filter by name, modality badge + exercise count, confirm copies via T137 SA. | medium | Template UX | T137 | template-add-picker, template-copy-from-existing |

### Track B: Batch Cascade Scope

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T139 | Batch cascade scope: add pending-edit state tracking to slot-list. Edited slots get visual indicator (dot/highlight). Template-level "Apply Changes" button appears when edits pending. Clicking triggers single cascade scope selector for all pending changes. Batch SA applies all edits atomically with chosen scope. "Discard Changes" reverts all. Unsaved-changes warning on navigate-away. Per-slot cascade still available (opt-in batch, not forced). Result via Sonner toast (aggregate summary). | medium | Template Cascade | T136 | batch-cascade-scope |

## Wave P1-P2 Dependency Graph

```
T135 (number input fix) ── standalone
T136 (cascade toast) ── T139 (batch cascade)
T137 (template copy SA) ── T138 (add picker + browse UI)
```

## Wave P1-P2 Critical Path

T137 → T138 (estimated: S + M = ~6-10h)
T136 → T139 (estimated: S + M = ~6-10h)

## Wave P1-P2 Gap Analysis

1. **cascade-toast-notification** supersedes **cascade-auto-dismiss** (T125). T125 implemented auto-dismiss with 2s timer + "Done" button. T136 eliminates the summary step entirely, replacing with a Sonner toast. No conflict — T136 is a further simplification.
2. **batch-cascade-scope**: Pending-edit state is client-only (React state). No schema changes needed. Batch SA reuses existing cascade slot parameter/add/remove SAs internally, wrapping them in a single transaction.
3. **template-copy-from-existing**: Superset group_id references must be remapped during copy (new group IDs in target meso). T133 (supersets) must be complete first — it is (confirmed by user).

## Wave P1-P2 Risk Areas

- **T138 (add picker + browse UI)**: Largest UI task. Browse dialog needs to query all templates across all mesocycles — could be slow if many mesos exist. Mitigated: single-user app, likely <50 mesos.
- **T139 (batch cascade)**: Pending-edit state management adds complexity to slot-list (already the largest component). Risk of stale state if page revalidates mid-edit. Mitigated: client-only state, no server roundtrip until "Apply Changes".

## Wave P1-P2 Scope Summary

| Scope | Count | Est. Hours Each | Total |
|-------|-------|-----------------|-------|
| Small | 3 | 1-3h | ~6h |
| Medium | 2 | 4-8h | ~12h |
| **Total** | **5** | | **~18h** |

---

## Wave P3.1: Mixed Template Section Fixes

> Bug fixes for mixed template form + section_id plumbing.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T140 | Mixed template plumbing fixes (3-in-1): (a) add `<Label>` to section name field for form alignment, (b) add `section_id` parameter to `addExerciseSlot` SA with validation, (c) replace hardcoded `'resistance'` filter in ExercisePicker with `modality` prop. Merges T141+T142. | small | Bug Fix | — | mixed-template-section-fixes |

## Wave P3.2: Mixed Template Section Editing UI

> Depends on P3.1. Renders full editing UI per section in mixed templates.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T143 | Mixed template section editing UI: replace read-only summary (template-section.tsx:813-841) with modality-specific editors per section. Resistance sections render SlotList (with section_id context). Running sections render editable running fields. MMA sections render editable duration. Each section gets its own add/edit/remove controls. Pass section context (section_id, modality) through to SlotList and ExercisePicker. | medium | Bug Fix | T140 | mixed-template-section-fixes |

## Wave P3.3: Calendar Multi-Workout Display

> Independent of P3.1/P3.2. Three sequential tasks.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T144 | Day detail multi-workout query + API (2-in-1): change `getDayDetail()` to return all schedule entries (`.all()` instead of `.get()`), add period field, update `/api/calendar/day` to return array. Merges T145. | small | Bug Fix | — | calendar-multi-workout-display |
| T146 | DayDetailPanel expandable cards: refactor panel to render one collapsible card per workout. Card header: template name + modality badge + period label (AM/PM/EVE). Collapsed by default when multi-workout; expanded by default when single. Click toggles expand/collapse. Each card reuses existing SlotRow, RunningDetail, MmaDetail, CompletedExerciseRow components. | medium | Enhancement | T144 | calendar-multi-workout-display |

## Wave P3.4: Exercise Slot Transfer

> Depends on T141 (section_id in addExerciseSlot). Four tasks, partially parallel.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T147 | Copy/move exercise slot server actions: `copyExerciseSlots(slotIds, targetTemplateId, targetSectionId?)` and `moveExerciseSlots(same)`. Validate target template/meso not completed, source meso not completed (for move). Copy slot fields, remap section_id + group_id (reuse pattern from copy-actions.ts:140-184). Move = copy + delete source in single transaction. Reorder remaining source slots after move. | medium | Feature | T140 | exercise-slot-transfer |
| T148 | Target picker modal component: 3-step selection (mesocycle → template → section). Loads active/planned mesocycles, filters templates to compatible modalities (resistance or mixed with resistance sections). Section step only for mixed targets. Confirm button triggers copy/move SA. | medium | Feature | T147 | exercise-slot-transfer |
| T149 | Slot context menu integration: add "Copy to..." and "Move to..." actions to slot-list.tsx exercise dropdown/context menu. Wire to target picker modal. Show operation result via Sonner toast. | small | Feature | T148 | exercise-slot-transfer |
| T150 | Superset group transfer: when selected slot has group_id, prompt "This exercise only" vs "Entire superset". If entire group: collect all slots sharing group_id, pass all to copyExerciseSlots/moveExerciseSlots. New group_id assigned sequentially after target's max. group_rest_seconds transferred with group. | small | Feature | T147 | exercise-slot-transfer |

## Wave P3.5: Intra-Phase Progression

> Largest feature. 8 tasks across 3 sub-waves. Schema first, then backend, then UI.

### Sub-wave P3.5a — Schema

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T151 | `slot_week_overrides` table: schema in lib/db/schema.ts. Columns: id (PK), exercise_slot_id (FK → exercise_slots, CASCADE delete), week_number (integer), weight (real), reps (text), sets (integer), rpe (real), distance (real), duration (integer), pace (text), is_deload (integer, default 0), created_at. Unique on (exercise_slot_id, week_number). Add defineRelations. Generate + apply migration. | small | Feature | — | intra-phase-progression |

### Sub-wave P3.5b — Backend

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T152 | Week override CRUD: server actions `upsertWeekOverride(slotId, weekNumber, fields)` and `deleteWeekOverride(slotId, weekNumber)`. Query `getWeekOverrides(slotId)` returns all overrides for a slot. Merge helper: `mergeSlotWithOverride(baseSlot, override)` returns effective values (override field if non-null, else base). Deload default calculation: 60% weight, 50% sets, RPE −2. | medium | Feature | T151 | intra-phase-progression |
| T153 | Week override merge — today + calendar (2-in-1): in both `getTodayWorkout()` and `getDayDetail()`, query slot_week_overrides for current week_number and merge into slot response. Merges T154. | small | Feature | T152 | intra-phase-progression |
| T155 | Snapshot week_number + template copy overrides (2-in-1): add `week_number_in_meso` to snapshot JSON with effective merged values, bump version. Extend `copyTemplateToMesocycle` to copy overrides with slot ID remapping. Merges T156. | small | Feature | T152 | intra-phase-progression |

### Sub-wave P3.5c — UI + Cascade

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T157 | Plan Weeks grid UI: new `week-progression-grid.tsx` component. Opens from "Plan Weeks" button on exercise slot. Grid: rows = weeks (1..work_weeks + deload if enabled), columns = overrideable fields (weight/reps/sets/RPE for resistance; distance/duration/pace for running). Week 1 pre-filled with base. Deload pre-filled with defaults. Edits call upsertWeekOverride SA. Empty/cleared fields delete override. Read-only in completed mesocycles. | medium | Feature | T152 | intra-phase-progression |
| T158 | Cascade override warning: when editing a base slot that has existing week overrides, show confirmation dialog: "This exercise has per-week progression values. Keep existing overrides or clear them?" Options: keep, clear all. Wire into updateExerciseSlot SA flow. | small | Feature | T152 | intra-phase-progression |

## Wave P3 Dependency Graph

```
T140 (plumbing fixes) ── T143 (section editing UI)
                      └── T147 (copy/move SA) → T148 (target picker) → T149 (context menu)
                                              └── T150 (superset transfer)

T144 (day detail query+API) → T146 (expandable cards)

T151 (schema) → T152 (CRUD SA)
                ├── T153 (today+calendar merge)
                ├── T155 (snapshot+copy overrides)
                ├── T157 (Plan Weeks UI)
                └── T158 (cascade warning)
```

## Wave P3 Critical Path

T151 → T152 → T157 (schema → CRUD → Plan Weeks UI, estimated: S + M + M = ~10-16h)

## Wave P3 Risk Areas

- **T143 (section editing UI)**: Largest refactor — replacing read-only mixed template summary with per-section editors. template-section.tsx is already the largest component (~850 lines). May need to extract section renderers into sub-components.
- **T146 (expandable cards)**: DayDetailPanel currently expects single result. Changing to array affects fetch, state, and all conditional rendering blocks. Breaking change to API response shape.
- **T152 (week override CRUD)**: Merge logic touches hot paths (today + calendar). Must ensure zero performance regression when no overrides exist (the common case).
- **T157 (Plan Weeks grid)**: New UI component with week×field grid. Many input fields — must handle numeric validation consistently (reuse T135 number input patterns).

## Wave P3 Scope Summary

| Scope | Count | Est. Hours Each | Total |
|-------|-------|-----------------|-------|
| Small | 6 | 2-4h | ~18h |
| Medium | 7 | 4-8h | ~42h |
| **Total** | **13** | | **~60h** |

---

## Wave CS1: Coaching Summary — Foundation

> New feature: coaching context export page. Schema + data layer + summary generator.

### Sub-wave CS1.1 — Schema + Profile

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T159 | `athlete_profile` table: id (PK), age (int), weight_kg (real), height_cm (real), gender (text), training_age_years (int), primary_goal (text), injury_history (text), created_at (timestamp), updated_at (timestamp). All nullable. Single-row. Generate + apply migration. | small | Coaching Summary | — | coaching-summary |
| T160 | Profile queries + actions: `getAthleteProfile()` returns single row or null. `saveAthleteProfile(input)` upsert with zod validation. Follow exercises/actions.ts pattern. Revalidate `/coaching`. | small | Coaching Summary | T159 | coaching-summary |

### Sub-wave CS1.2 — Summary Generator

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T161 | Active mesocycle query: fetch active meso with templates → exercise_slots → exercises + weekly_schedule. New function `getCurrentPlan(db)` in coaching queries. | medium | Coaching Summary | T159 | coaching-summary |
| T162 | Recent sessions query: `getRecentSessions(db, weeks)` — fetch logged_workouts (last 4 weeks) with logged_exercises + logged_sets. Join exercise names. Chronological order. | medium | Coaching Summary | T159 | coaching-summary |
| T163 | Summary generator: `generateCoachingSummary(subjectiveState)` assembles 6 markdown sections: Profile, Current Plan, Recent Sessions (4 wks), Progression Trends (reuse `getProgressionData`), Subjective State (passthrough), Upcoming Plan (reuse `getCalendarProjection`). Returns markdown string. | large | Coaching Summary | T160, T161, T162 | coaching-summary |

### Sub-wave CS1.3 — API

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T164 | Summary route handler: `POST /api/coaching/summary` — accepts `{ fatigue, soreness, sleep, injuries, notes }` in body, validates with zod, calls `generateCoachingSummary()`, returns `{ markdown }`. | small | Coaching Summary | T163 | coaching-summary |

## Wave CS2: Coaching Summary — UI

> Depends on CS1. Page + components + nav.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T165 | Coaching page (server component): `/coaching` route. Loads profile via `getAthleteProfile()`, passes to client. `force-dynamic`. | small | Coaching Summary | T160 | coaching-summary |
| T166 | Profile form component: inline edit with controlled inputs. Fields: age, weight, height, gender (select), training age, primary goal, injury history (textarea). Auto-save on blur via `saveAthleteProfile`. Uses `useTransition`. | medium | Coaching Summary | T160, T165 | coaching-summary |
| T167 | Subjective state form component: ephemeral (not persisted). Radio groups for fatigue/soreness/sleep (1-5), current injuries textarea, notes textarea. Local state, passed up via callback. | small | Coaching Summary | T165 | coaching-summary |
| T168 | Summary preview component: fetches POST `/api/coaching/summary` on "Generate" click. Shows markdown in `<pre>` block. Copy-to-clipboard button with check icon feedback. Loading state. | medium | Coaching Summary | T164 | coaching-summary |
| T169 | Client orchestrator component: composes profile form, subjective state form, generate button, summary preview. Manages state flow between components. | medium | Coaching Summary | T166, T167, T168 | coaching-summary |
| T170 | Nav link: add `{ href: '/coaching', label: 'Coaching', icon: BrainCircuit }` after Routines in nav-items.ts. | small | Coaching Summary | T165 | coaching-summary |

## Wave CS Dependency Graph

```
T159 (schema)
├── T160 (profile queries+actions) → T163 (summary generator) → T164 (API route) → T168 (preview)
├── T161 (current plan query) ──────┘                                                      │
├── T162 (recent sessions query) ───┘                                                      │
├── T165 (page) → T166 (profile form) ──┐                                                  │
│              → T167 (subjective form) ─┼── T169 (orchestrator) ◄─────────────────────────┘
│              → T170 (nav link)         │
└────────────────────────────────────────┘
```

## Wave CS Critical Path

T159 → T160 → T163 → T164 → T168 → T169 (schema → profile → generator → API → preview → orchestrator)

## Wave CS Scope Summary

| Scope | Count | Est. Hours Each | Total |
|-------|-------|-----------------|-------|
| Small | 5 | 1-2h | ~8h |
| Medium | 4 | 2-4h | ~12h |
| Large | 1 | 4-6h | ~5h |
| **Total** | **12** (T159-T170) | | **~25h** |

---

## Wave RL1: Retroactive Logging — API + Calendar Entry

> Unlock logging for past dates. API parameterization + calendar action button. No backend data changes needed — `saveWorkout`/`saveRunningWorkout` already accept any `logDate`.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T171 | Today API date param: add optional `date` query param to `GET /api/today`. Validate YYYY-MM-DD format, reject future dates (400), fall back to `todayDateString()` when absent or empty. Pass validated date to `getTodayWorkout(date)`. | small | Retroactive Logging | T045 | retroactive-workout-logging |
| T172 | Today page searchParams: read `searchParams.date` in `app/(app)/page.tsx`, pass as prop to `TodayWorkout`. Component fetches `/api/today?date=X` when prop present, `/api/today` otherwise. | small | Retroactive Logging | T171 | retroactive-workout-logging |
| T173 | DayDetailPanel "Log Workout" button: add action button on projected workout cards where `date ≤ today`. Button navigates to `/?date=YYYY-MM-DD`. Hidden for completed, rest, future dates. Multi-session: only unlogged cards show button. | small | Retroactive Logging | T066 | retroactive-workout-logging |

## Wave RL2: Retroactive Logging — Banner + Post-Save

> UI layer: retroactive date banner, post-save redirect to calendar.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T174 | Retroactive date banner: when `date` prop differs from today, render colored banner "Logging for dd/Mon/yyyy" with "Back to Calendar" link. No banner when date equals today or is absent. Add `formatDateBanner()` to `lib/date-format.ts` if needed. | small | Retroactive Logging | T172 | retroactive-workout-logging |
| T175 | Post-save redirect: when logging form saves with a retroactive date, show toast "Workout logged for dd/Mon" and navigate to `/calendar?month=YYYY-MM`. Today's normal flow (no date param) preserves existing inline confirmation with no redirect. | small | Retroactive Logging | T172, T174 | retroactive-workout-logging |
| T176 | E2E: retroactive logging flow: open calendar → tap past projected day → tap "Log Workout" → verify banner + correct date → fill form → save → verify toast + calendar redirect + completed marker. Also verify future dates blocked and already-logged shows summary. | medium | Retroactive Logging | T173, T175 | retroactive-workout-logging |

## Wave RL Dependency Graph

```
T045 (existing: GET /api/today)
└── T171 (API date param)
    └── T172 (page searchParams + fetch)
        ├── T174 (date banner)
        │   └── T175 (post-save redirect) ──┐
        └───────────────────────────────────┘
                                             └── T176 (E2E)
T066 (existing: day detail panel)
└── T173 (Log Workout button) ──────────────────┘
```

## Wave RL Critical Path

T171 → T172 → T174 → T175 → T176 (API param → page integration → banner → post-save → E2E)

## Wave RL Gap Analysis

- **E14 (multi-session duplicate check)**: `hasExistingLog` checks per-mesocycle, not per-template. Logging a second session on same date will fail at save layer even though UI shows it as available. Pre-existing bug, not introduced by this feature. Documented in spec, separate fix recommended.
- **Open question**: action sheet vs standalone button for "Log Workout". Spec notes this as extensible for future "Move Workout" feature. Recommend simple button for now — extract to shared action sheet when schedule-override spec lands.

## Wave RL Risk Areas

- **Post-save redirect timing**: toast + navigation must sequence correctly. Toast should be visible during navigation transition, not after.
- **Calendar cache invalidation**: after retroactive save, `revalidatePath('/calendar')` must fire so the day transitions from projected → completed on redirect.

## Wave RL Scope Summary

| Scope | Count | Est. Hours Each | Total |
|-------|-------|-----------------|-------|
| Small | 4 | 1-2h | ~6h |
| Medium | 1 | 2-4h | ~3h |
| Large | 0 | — | — |
| **Total** | **6** (T171-T176) | | **~9h** |
