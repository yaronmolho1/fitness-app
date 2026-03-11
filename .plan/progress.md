# Progress Tracker

> 77 tasks across 15 waves. Check off as completed.

## Wave 0: Project Infrastructure
- [x] **T0001** — Next.js scaffold + test infrastructure `(medium)` `[infrastructure]`
- [x] **T0002** — Docker setup (dev + production) `(small)` `[infrastructure]`
- [x] **T0003** — GitHub Actions CI/CD `(small)` `[infrastructure]`
- [ ] **T0004** — nginx site config (cross-repo) `(small)` `[infrastructure]`

## Wave 1: Database Foundation
- [x] **T001** — SQLite connection + PRAGMAs `(small)` `[db-schema-migrations]`
- [x] **T002** — Planning layer schema (6 tables) `(medium)` `[db-schema-migrations]`
- [x] **T003** — Logging layer schema (4 tables) `(medium)` `[db-schema-migrations]`
- [x] **T004** — Drizzle v2 relations + migration `(small)` `[db-schema-migrations]`

## Wave 2: Auth
- [x] **T005** — Env config + credential validation `(small)` `[auth-system]`
- [x] **T006** — JWT issuance + verification (jose) `(small)` `[auth-system]`
- [x] **T007** — Login/logout API routes + cookie `(small)` `[auth-system]`
- [~] **T008** — Auth middleware (Edge, route protection) `(small)` `[auth-system]` _(started 2026-03-11)_
- [ ] **T009** — Login page UI + logout action `(medium)` `[auth-system]`

## Wave 3: App Shell
- [ ] **T010** — Route groups (app)/(auth) + layouts `(medium)` `[app-shell-navigation]`
- [ ] **T011** — Health endpoint `(small)` `[app-shell-navigation]`
- [ ] **T012** — Navigation (sidebar + bottom bar) `(medium)` `[app-shell-navigation]`

## Wave 4: Exercise Library
- [ ] **T013** — Create exercise SA + validation `(small)` `[exercise-crud]`
- [ ] **T014** — Exercise list + empty state + form UI `(small)` `[exercise-crud]`
- [ ] **T015** — Edit exercise SA + form `(medium)` `[exercise-crud]`
- [ ] **T016** — Delete exercise + deletion protection `(small)` `[exercise-crud, exercise-deletion-protection]`
- [ ] **T017** — Exercise search & filter `(small)` `[exercise-search-filter]`

## Wave 5: Mesocycle Lifecycle
- [ ] **T018** — Create mesocycle SA + end date calc `(small)` `[create-mesocycle, auto-calculate-end-date]`
- [ ] **T019** — Mesocycle list + detail view `(small)` `[create-mesocycle]`
- [ ] **T020** — Create mesocycle form + end date preview `(small)` `[create-mesocycle, auto-calculate-end-date]`
- [ ] **T021** — Status transitions + one-active constraint `(small)` `[mesocycle-status-management]`
- [ ] **T022** — Status transition UI `(small)` `[mesocycle-status-management]`

## Wave 6: Workout Templates
- [ ] **T023** — Create resistance template SA + canonical slug `(small)` `[create-resistance-templates]`
- [ ] **T024** — Template list + edit + delete `(medium)` `[create-resistance-templates]`
- [ ] **T025** — Running template SA + form `(small)` `[running-templates]`
- [ ] **T026** — MMA/BJJ template SA + form `(small)` `[mma-bjj-template-support]`

## Wave 7: Exercise Slots + Schedule

### Track A: Exercise Slots
- [ ] **T027** — Add exercise slot SA + picker `(small)` `[exercise-slots]`
- [ ] **T028** — Slot editing + remove `(small)` `[exercise-slots]`
- [ ] **T029** — Drag-reorder slots (SA + UI) `(medium)` `[drag-reorder-exercises]`
- [ ] **T030** — Main/complementary role toggle `(small)` `[main-vs-complementary-marking]`

### Track B: Weekly Schedule
- [ ] **T031** — Assign/remove/replace template SA `(small)` `[7-day-assignment-grid]`
- [ ] **T032** — 7-day schedule grid UI `(medium)` `[7-day-assignment-grid]`
- [ ] **T033** — Normal/deload tabs `(medium)` `[normal-vs-deload-tabs]`
- [ ] **T034** — Rest day display in grid `(small)` `[explicit-rest-days]`

## Wave 8: Cascade + Clone + Routines

### Track A: Template Cascade
- [ ] **T035** — Cascade sibling query (3 scopes) `(medium)` `[cascade-scope-selection]`
- [ ] **T036** — Cascade atomic execution SA `(medium)` `[cascade-scope-selection]`
- [ ] **T037** — Cascade scope selection UI `(medium)` `[cascade-scope-selection]`
- [ ] **T038** — Block edits on completed mesocycle `(small)` `[completed-mesocycle-protection]`
- [ ] **T039** — Cascade skips completed + summary `(small)` `[completed-mesocycle-protection]`

### Track B: Mesocycle Cloning
- [ ] **T040** — Clone mesocycle SA (atomic) `(large)` `[clone-mesocycle]`
- [ ] **T041** — Clone form UI `(small)` `[clone-mesocycle]`
- [ ] **T042** — Canonical name preservation `(small)` `[canonical-name-preservation]`

### Track C: Routine Items
- [ ] **T043** — Routine item CRUD SA + scope validation `(medium)` `[routine-item-crud]`
- [ ] **T044** — Routine item list + edit + delete `(small)` `[routine-item-crud]`

## Wave 9: Today's Workout
- [ ] **T045** — GET /api/today (lookup chain + deload) `(medium)` `[view-todays-planned-workout]`
- [ ] **T046** — Today's resistance workout display `(medium)` `[view-todays-planned-workout]`
- [ ] **T047** — Today's running + MMA/BJJ display `(small)` `[view-todays-planned-workout]`

## Wave 10: Logging — Resistance
- [ ] **T048** — Logging form + pre-fill from template `(medium)` `[pre-filled-resistance-logging]`
- [ ] **T049** — Actual reps/weight/RPE inputs `(small)` `[actual-set-input]`
- [ ] **T050** — Add/remove set rows `(small)` `[add-remove-sets]`
- [ ] **T051** — Rating + notes fields `(small)` `[workout-rating-notes]`
- [ ] **T052** — Save workout SA (atomic + snapshot) `(large)` `[log-immutability]`
- [ ] **T053** — Immutability enforcement `(small)` `[log-immutability]`

## Wave 11: Logging — Running + MMA/BJJ
- [ ] **T054** — Running logging form + save SA `(medium)` `[running-logging]`
- [ ] **T055** — Running rating & notes `(small)` `[running-rating-notes]`
- [ ] **T056** — Interval logging (JSON array) `(medium)` `[interval-logging]`
- [ ] **T057** — MMA/BJJ logging form + save SA `(small)` `[mma-bjj-logging]`

## Wave 12: Already-Logged + Rest Day + Routines
- [ ] **T058** — Already-logged detection `(small)` `[already-logged-summary]`
- [ ] **T059** — Already-logged summary display `(medium)` `[already-logged-summary]`
- [ ] **T060** — Re-logging prevention `(small)` `[already-logged-summary]`
- [ ] **T061** — Active routine scope filtering `(medium)` `[daily-routine-check-off]`
- [ ] **T062** — Mark done/skipped SA + check-off UI `(medium)` `[daily-routine-check-off]`
- [ ] **T063** — Rest day display + routine integration `(small)` `[rest-day-display]`

## Wave 13: Calendar & Progression

### Track A: Calendar
- [ ] **T064** — GET /api/calendar projection logic `(medium)` `[projected-calendar]`
- [ ] **T065** — Calendar month grid UI `(medium)` `[projected-calendar]`
- [ ] **T066** — Day detail drill-in panel `(medium)` `[day-detail-drill-in]`
- [ ] **T067** — Completed day markers `(small)` `[completed-day-markers]`
- [ ] **T068** — Deload week distinction `(small)` `[deload-week-distinction]`

### Track B: Progression
- [ ] **T069** — GET /api/progression route handler `(medium)` `[exercise-progression-chart]`
- [ ] **T070** — Exercise progression chart UI `(medium)` `[exercise-progression-chart]`
- [ ] **T071** — Phase boundary markers `(small)` `[phase-boundary-markers]`

## Wave 14: Routine Analytics
- [ ] **T072** — Weekly completion count `(small)` `[routine-streaks-counts]`
- [ ] **T073** — Streak calculation + display `(small)` `[routine-streaks-counts]`

---

## Summary

| Status | Count |
|--------|-------|
| Done | 8 |
| In Progress | 0 |
| Remaining | 69 |

| Scope | Count |
|-------|-------|
| Small | 42 |
| Medium | 26 |
| Large | 3 |
| **Total** | **73** |**Estimate: ~160 hours**
