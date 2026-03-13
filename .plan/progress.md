# Progress

> Auto-managed. Source: .plan/IMPLEMENTATION_PLAN.md

| ID | Title | Wave | Status | Branch | Started | Completed | Notes |
|----|-------|------|--------|--------|---------|-----------|-------|
| T0001 | Next.js scaffold + test infrastructure | 0 | [x] | | | | |
| T0002 | Docker setup (dev + production) | 0 | [x] | | | | |
| T0003 | GitHub Actions CI/CD | 0 | [x] | | | | |
| T0004 | nginx site config (cross-repo) | 0 | [x] | | 2026-03-12T19:10 | 2026-03-12T19:15 | committed in docker-app-stack repo |
| T001 | SQLite connection + PRAGMAs | 1 | [x] | | | | |
| T002 | Planning layer schema (6 tables) | 1 | [x] | | | | |
| T003 | Logging layer schema (4 tables) | 1 | [x] | | | | |
| T004 | Drizzle v2 relations + migration | 1 | [x] | | | | |
| T005 | Env config + credential validation | 2 | [x] | | | | |
| T006 | JWT issuance + verification (jose) | 2 | [x] | | | | |
| T007 | Login/logout API routes + cookie | 2 | [x] | | | | |
| T008 | Auth middleware (Edge, route protection) | 2 | [x] | | | | |
| T009 | Login page UI + logout action | 2 | [x] | | | | |
| T010 | Route groups (app)/(auth) + layouts | 3 | [x] | feat/task-010-route-groups | 2026-03-12T10:00 | 2026-03-12T18:55 | PR #1 |
| T011 | Health endpoint | 3 | [x] | feat/task-011-health-endpoint | 2026-03-13T10:00 | 2026-03-13T10:30 | PR #2 |
| T012 | Navigation (sidebar + bottom bar) | 3 | [x] | feat/task-012-navigation | 2026-03-13T10:00 | 2026-03-13T10:45 | PR #3 |
| T013 | Create exercise SA + validation | 4 | [x] | feat/task-013-create-exercise-sa | 2026-03-13T12:00 | 2026-03-13T12:30 | PR #7 |
| T014 | Exercise list + empty state + form UI | 4 | [ ] | | | | |
| T015 | Edit exercise SA + form | 4 | [ ] | | | | |
| T016 | Delete exercise + deletion protection | 4 | [ ] | | | | |
| T017 | Exercise search & filter | 4 | [ ] | | | | |
| T018 | Create mesocycle SA + end date calc | 5 | [~] | feat/task-018-create-mesocycle | 2026-03-13T11:00 | | |
| T019 | Mesocycle list + detail view | 5 | [ ] | | | | |
| T020 | Create mesocycle form + end date preview | 5 | [ ] | | | | |
| T021 | Status transitions + one-active constraint | 5 | [~] | feat/task-021-mesocycle-status | 2026-03-13T13:00 | | |
| T022 | Status transition UI | 5 | [ ] | | | | |
| T023 | Create resistance template SA + canonical slug | 6 | [ ] | | | | |
| T024 | Template list + edit + delete | 6 | [ ] | | | | |
| T025 | Running template SA + form | 6 | [ ] | | | | |
| T026 | MMA/BJJ template SA + form | 6 | [ ] | | | | |
| T027 | Add exercise slot SA + picker | 7 | [ ] | | | | |
| T028 | Slot editing + remove | 7 | [ ] | | | | |
| T029 | Drag-reorder slots (SA + UI) | 7 | [ ] | | | | |
| T030 | Main/complementary role toggle | 7 | [ ] | | | | |
| T031 | Assign/remove/replace template SA | 7 | [ ] | | | | |
| T032 | 7-day schedule grid UI | 7 | [ ] | | | | |
| T033 | Normal/deload tabs | 7 | [ ] | | | | |
| T034 | Rest day display in grid | 7 | [ ] | | | | |
| T035 | Cascade sibling query (3 scopes) | 8 | [ ] | | | | |
| T036 | Cascade atomic execution SA | 8 | [ ] | | | | |
| T037 | Cascade scope selection UI | 8 | [ ] | | | | |
| T038 | Block edits on completed mesocycle | 8 | [ ] | | | | |
| T039 | Cascade skips completed + summary | 8 | [ ] | | | | |
| T040 | Clone mesocycle SA (atomic) | 8 | [ ] | | | | |
| T041 | Clone form UI | 8 | [ ] | | | | |
| T042 | Canonical name preservation | 8 | [ ] | | | | |
| T043 | Routine item CRUD SA + scope validation | 8 | [ ] | | | | |
| T044 | Routine item list + edit + delete | 8 | [ ] | | | | |
| T045 | GET /api/today (lookup chain + deload) | 9 | [ ] | | | | |
| T046 | Today's resistance workout display | 9 | [ ] | | | | |
| T047 | Today's running + MMA/BJJ display | 9 | [ ] | | | | |
| T048 | Logging form + pre-fill from template | 10 | [ ] | | | | |
| T049 | Actual reps/weight/RPE inputs | 10 | [ ] | | | | |
| T050 | Add/remove set rows | 10 | [ ] | | | | |
| T051 | Rating + notes fields | 10 | [ ] | | | | |
| T052 | Save workout SA (atomic + snapshot) | 10 | [ ] | | | | |
| T053 | Immutability enforcement | 10 | [ ] | | | | |
| T054 | Running logging form + save SA | 11 | [ ] | | | | |
| T055 | Running rating & notes | 11 | [ ] | | | | |
| T056 | Interval logging (JSON array) | 11 | [ ] | | | | |
| T057 | MMA/BJJ logging form + save SA | 11 | [ ] | | | | |
| T058 | Already-logged detection | 12 | [ ] | | | | |
| T059 | Already-logged summary display | 12 | [ ] | | | | |
| T060 | Re-logging prevention | 12 | [ ] | | | | |
| T061 | Active routine scope filtering | 12 | [ ] | | | | |
| T062 | Mark done/skipped SA + check-off UI | 12 | [ ] | | | | |
| T063 | Rest day display + routine integration | 12 | [ ] | | | | |
| T064 | GET /api/calendar projection logic | 13 | [ ] | | | | |
| T065 | Calendar month grid UI | 13 | [ ] | | | | |
| T066 | Day detail drill-in panel | 13 | [ ] | | | | |
| T067 | Completed day markers | 13 | [ ] | | | | |
| T068 | Deload week distinction | 13 | [ ] | | | | |
| T069 | GET /api/progression route handler | 13 | [ ] | | | | |
| T070 | Exercise progression chart UI | 13 | [ ] | | | | |
| T071 | Phase boundary markers | 13 | [ ] | | | | |
| T072 | Weekly completion count | 14 | [ ] | | | | |
| T073 | Streak calculation + display | 14 | [ ] | | | | |
