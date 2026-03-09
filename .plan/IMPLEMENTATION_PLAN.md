# Implementation Plan

> 74 tasks across 13 waves. Each task = one TDD cycle.
> Waves are sequential; tracks within a wave are parallel.

## Critical Path

The longest dependency chain through the project:

```
db-schema → auth → app-shell → create-mesocycle → resistance-templates
→ exercise-slots (joins exercise-search-filter) → 7-day-assignment-grid (joins mesocycle-status)
→ view-todays-workout → pre-filled-resistance-logging → save-workout + log-immutability
→ exercise-progression-chart → phase-boundary-markers
```

12 spec-level dependencies on the critical path. Everything else branches off as parallel work.

---

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
| Small | 42 | 1-2h | ~63h |
| Medium | 26 | 2-4h | ~78h |
| Large | 3 | 4-8h | ~18h |
| **Total** | **73** | | **~159h** |

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
