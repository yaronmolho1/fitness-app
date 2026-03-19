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
| T014 | Exercise list + empty state + form UI | 4 | [x] | feat/task-014-exercise-list-ui | 2026-03-13T13:30 | 2026-03-13T14:00 | PR #11 |
| T015 | Edit exercise SA + form | 4 | [x] | feat/task-015-edit-exercise | 2026-03-13T22:00 | 2026-03-14 | merged via PR #18 |
| T016 | Delete exercise + deletion protection | 4 | [x] | feat/task-016-delete-exercise | 2026-03-13T14:30 | 2026-03-13T15:10 | PR #10 |
| T017 | Exercise search & filter | 4 | [x] | feat/task-017-exercise-search-filter | 2026-03-13T16:00 | 2026-03-13T17:00 | PR #12 |
| T018 | Create mesocycle SA + end date calc | 5 | [x] | feat/task-018-create-mesocycle | 2026-03-13T11:00 | 2026-03-13T11:45 | PR #6 |
| T019 | Mesocycle list + detail view | 5 | [x] | feat/task-019-mesocycle-list-detail | 2026-03-14T14:00 | 2026-03-14 | merged via PR #99 |
| T020 | Create mesocycle form + end date preview | 5 | [x] | feat/task-020-mesocycle-form | 2026-03-14T21:30 | 2026-03-14 | merged via PR #101 |
| T021 | Status transitions + one-active constraint | 5 | [x] | feat/task-021-mesocycle-status | 2026-03-13T13:00 | 2026-03-13T14:30 | PR #8 |
| T022 | Status transition UI | 5 | [x] | feat/task-022-status-transition-ui | 2026-03-14T22:30 | 2026-03-14 | merged via PR #105 |
| T023 | Create resistance template SA + canonical slug | 6 | [x] | feat/task-023-resistance-templates | 2026-03-13T14:00 | 2026-03-13T14:45 | PR #9 |
| T024 | Template list + edit + delete | 6 | [x] | feat/task-024-template-list-edit-delete | 2026-03-15T00:00 | 2026-03-15 | merged via PR #108 |
| T025 | Running template SA + form | 6 | [x] | feat/task-025-running-templates | 2026-03-14T23:00 | 2026-03-14 | merged via PR #106 |
| T026 | MMA/BJJ template SA + form | 6 | [x] | feat/task-026-mma-bjj-templates | 2026-03-14T23:30 | 2026-03-14 | merged via PR #107 |
| T027 | Add exercise slot SA + picker | 7 | [x] | feat/task-027-exercise-slot-sa | 2026-03-13T21:00 | 2026-03-14 | merged via PR #14 |
| T028 | Slot editing + remove | 7 | [x] | feat/task-028-slot-editing-remove | 2026-03-14T20:30 | 2026-03-15 | merged via PR #112 |
| T029 | Drag-reorder slots (SA + UI) | 7 | [x] | feat/task-029-drag-reorder-slots | 2026-03-15T12:00 | 2026-03-15 | merged via PR #124 |
| T030 | Main/complementary role toggle | 7 | [x] | feat/task-030-role-toggle | 2026-03-15T00:30 | 2026-03-15 | merged via PR #110 |
| T031 | Assign/remove/replace template SA | 7 | [x] | feat/task-031-assign-template-sa | 2026-03-14T17:00 | 2026-03-14 | merged via PR #98 |
| T032 | 7-day schedule grid UI | 7 | [x] | feat/task-032-schedule-grid-ui | 2026-03-14 | 2026-03-14 | merged via PR #100 |
| T033 | Normal/deload tabs | 7 | [x] | feat/task-033-normal-deload-tabs | 2026-03-15T00:15 | 2026-03-15 | merged via PR #109 |
| T034 | Rest day display in grid | 7 | [x] | feat/task-034-rest-day-display | 2026-03-15T00:30 | 2026-03-15 | merged via PR #111 |
| T035 | Cascade sibling query (3 scopes) | 8 | [x] | feat/task-035-cascade-sibling-query | 2026-03-15T12:00 | 2026-03-15 | merged via PR #115 |
| T036 | Cascade atomic execution SA | 8 | [x] | feat/task-036-cascade-atomic-execution | 2026-03-15T11:00 | 2026-03-15 | merged via PR #126 |
| T037 | Cascade scope selection UI | 8 | [x] | feat/task-037-cascade-scope-ui | 2026-03-15T12:00 | 2026-03-15 | merged via PR #128 |
| T038 | Block edits on completed mesocycle | 8 | [x] | feat/task-038-completed-meso-protection | 2026-03-15T14:00 | 2026-03-15 | merged via PR #129 |
| T039 | Cascade skips completed + summary | 8 | [x] | feat/task-039-cascade-skips-completed | 2026-03-15T15:00 | 2026-03-15 | merged via PR #130 |
| T040 | Clone mesocycle SA (atomic) | 8 | [x] | feat/task-040-clone-mesocycle | 2026-03-15T13:00 | 2026-03-15 | merged via PR #127 |
| T041 | Clone form UI | 8 | [x] | feat/task-041-clone-form-ui | 2026-03-15T16:00 | 2026-03-15 | merged via PR #134 |
| T042 | Canonical name preservation | 8 | [x] | feat/task-042-canonical-name-preservation | 2026-03-15T15:00 | 2026-03-15 | merged via PR #131 |
| T043 | Routine item CRUD SA + scope validation | 8 | [x] | feat/task-043-routine-item-crud | 2026-03-15T13:00 | 2026-03-15 | merged via PR #125 |
| T044 | Routine item list + edit + delete | 8 | [ ] | | | | |
| T045 | GET /api/today (lookup chain + deload) | 9 | [x] | feat/task-045-api-today | 2026-03-14T22:00 | 2026-03-14 | merged via PR #104 |
| T046 | Today's resistance workout display | 9 | [x] | feat/task-046-todays-resistance-display | 2026-03-15T10:00 | 2026-03-15 | merged via PR #119 |
| T047 | Today's running + MMA/BJJ display | 9 | [x] | feat/task-047-running-mma-display | 2026-03-15 | 2026-03-15 | merged via PR #133 |
| T048 | Logging form + pre-fill from template | 10 | [x] | feat/task-048-logging-form | 2026-03-15T13:00 | 2026-03-15 | merged via PR #132 |
| T049 | Actual reps/weight/RPE inputs | 10 | [x] | feat/task-049-actual-set-input | 2026-03-15T16:00 | 2026-03-15 | merged via PR #144 |
| T050 | Add/remove set rows | 10 | [x] | feat/task-050-add-remove-sets | 2026-03-15T17:00 | 2026-03-15 | merged via PR #145 |
| T051 | Rating + notes fields | 10 | [x] | feat/task-051-rating-notes | 2026-03-15T18:00 | 2026-03-15 | merged via PR #146 |
| T052 | Save workout SA (atomic + snapshot) | 10 | [~] | feat/task-052-save-workout | 2026-03-15T19:00 | | |
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
| T074 | OKLCH theme + dark mode setup | UI-1 | [x] | feat/task-074-oklch-theme | 2026-03-15T18:00 | 2026-03-15 | merged via PR #135 |
| T075 | Geist fonts + Providers + Toaster | UI-1 | [x] | feat/task-075-geist-providers | 2026-03-15T19:00 | 2026-03-15 | merged via PR #136 |
| T076 | Install shadcn components (11) | UI-1 | [x] | feat/task-076-shadcn-components | 2026-03-15T19:00 | 2026-03-15 | merged via PR #137 |
| T077 | Navigation overhaul (collapsible + Sheet) | UI-2 | [x] | feat/task-077-nav-overhaul | 2026-03-15T20:00 | 2026-03-15 | merged via PR #138 |
| T078 | Exercise form Select refactor | UI-2 | [x] | feat/task-078-exercise-select | 2026-03-15T20:00 | 2026-03-15 | merged via PR #139 |
| T079 | Mesocycle form Checkbox + date refactor | UI-2 | [x] | feat/task-079-meso-form-refactor | 2026-03-15T20:00 | 2026-03-15 | merged via PR #140 |
| T080 | Schedule Tabs component refactor | UI-2 | [x] | feat/task-080-schedule-tabs | 2026-03-15T20:00 | 2026-03-15 | merged via PR #141 |
| T081 | Status Badge + Skeleton refactor | UI-2 | [x] | feat/task-081-badge-skeleton | 2026-03-15T20:00 | 2026-03-15 | merged via PR #142 |
| T082 | Visual consistency pass | UI-3 | [x] | feat/task-082-visual-polish | 2026-03-15T21:00 | 2026-03-15 | merged via PR #143 |
| T083 | PageContainer component | R1 | [ ] | | | | |
| T084 | PageHeader component | R1 | [ ] | | | | |
| T085 | Adopt PageContainer + PageHeader across all pages | R1 | [ ] | | | | |
| T086 | RPE schema migration (logged_sets → logged_exercises) | R2 | [ ] | | | | |
| T087 | 3-column set input grid | R2 | [ ] | | | | |
| T088 | Per-exercise RPE selector (1-10 buttons) | R2 | [ ] | | | | |
| T089 | Touch target enforcement (44px minimum) | R2 | [ ] | | | | |
| T090 | Update save workout SA for per-exercise RPE | R2 | [ ] | | | | |
| T091 | Modality color utility extraction | R3 | [ ] | | | | |
| T092 | Card normalization pass | R3 | [ ] | | | | |
| T093 | Empty state component | R3 | [ ] | | | | |
| T094 | Progressive padding + interactive feedback | R3 | [ ] | | | | |
| T095 | Time slots schema: period + time_slot on weekly_schedule | F1 | [ ] | | | | |
| T096 | Mixed modality schema: template_sections + section_id + mixed enum | F1 | [ ] | | | | |
| T097 | Routines frequency schema: frequency_mode + frequency_days | F1 | [ ] | | | | |
| T098 | Shared auto-suggest combobox component | F1 | [ ] | | | | |
| T099 | Distinct values queries (exercise + routine) | F1 | [ ] | | | | |
| T100 | Add Progression to main nav | F1 | [ ] | | | | |
| T101 | Slot matching utility for cross-template cascade | F1 | [ ] | | | | |
| T102 | Period pill selector + optional time picker component | F2 | [ ] | | | | |
| T103 | Schedule assignment SA: period + time_slot | F2 | [ ] | | | | |
| T104 | Running/MMA template fields editable post-creation + cascade | F2 | [ ] | | | | |
| T105 | Cascade slot parameter changes SA (3 scopes) | F2 | [ ] | | | | |
| T106 | Cascade add/remove exercise slot SA | F2 | [ ] | | | | |
| T107 | Mixed template creation + section management SAs | F2 | [ ] | | | | |
| T108 | Collapsible exercise form + comboboxes | F2 | [ ] | | | | |
| T109 | Edit exercise form comboboxes | F2 | [ ] | | | | |
| T110 | Frequency mode selector + day picker component | F2 | [ ] | | | | |
| T111 | Routine create/edit forms: frequency mode + category combobox | F2 | [ ] | | | | |
| T112 | Today page quick links to template editing | F2 | [ ] | | | | |
| T113 | Schedule grid multi-entry per day | F3 | [ ] | | | | |
| T114 | Today API array response + multi-session display | F3 | [ ] | | | | |
| T115 | Calendar multi-workout per day + period labels | F3 | [ ] | | | | |
| T116 | Cascade scope selector UI on all edit operations | F3 | [ ] | | | | |
| T117 | Mixed template creation form UI | F3 | [ ] | | | | |
| T118 | Routine scope filtering for frequency modes | F3 | [ ] | | | | |
| T119 | Header/padding audit + standardization pass | F3 | [ ] | | | | |
| T120 | Clone mesocycle: copy period, time_slot, template_sections | F3 | [ ] | | | | |
| T121 | Mixed template display on Today page | F4 | [ ] | | | | |
| T122 | Mixed template logging form + composite save SA | F4 | [ ] | | | | |
| T123 | Calendar + schedule integration for mixed templates | F4 | [ ] | | | | |
| T124 | Calendar day detail quick links to template editing | F4 | [ ] | | | | |
