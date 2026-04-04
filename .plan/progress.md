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
| T044 | Routine item list + edit + delete | 8 | [x] | feat/task-044-routine-item-list | | 2026-03-15 | merged via PR #149 |
| T045 | GET /api/today (lookup chain + deload) | 9 | [x] | feat/task-045-api-today | 2026-03-14T22:00 | 2026-03-14 | merged via PR #104 |
| T046 | Today's resistance workout display | 9 | [x] | feat/task-046-todays-resistance-display | 2026-03-15T10:00 | 2026-03-15 | merged via PR #119 |
| T047 | Today's running + MMA/BJJ display | 9 | [x] | feat/task-047-running-mma-display | 2026-03-15 | 2026-03-15 | merged via PR #133 |
| T048 | Logging form + pre-fill from template | 10 | [x] | feat/task-048-logging-form | 2026-03-15T13:00 | 2026-03-15 | merged via PR #132 |
| T049 | Actual reps/weight/RPE inputs | 10 | [x] | feat/task-049-actual-set-input | 2026-03-15T16:00 | 2026-03-15 | merged via PR #144 |
| T050 | Add/remove set rows | 10 | [x] | feat/task-050-add-remove-sets | 2026-03-15T17:00 | 2026-03-15 | merged via PR #145 |
| T051 | Rating + notes fields | 10 | [x] | feat/task-051-rating-notes | 2026-03-15T18:00 | 2026-03-15 | merged via PR #146 |
| T052 | Save workout SA (atomic + snapshot) | 10 | [x] | feat/task-052-save-workout | 2026-03-15T19:00 | 2026-03-15 | merged via PR #147 |
| T053 | Immutability enforcement | 10 | [x] | feat/task-053-immutability-enforcement | | 2026-03-15 | merged via PR #148 |
| T054 | Running logging form + save SA | 11 | [x] | feat/task-054-running-logging | | 2026-03-15 | merged via PR #150 |
| T055 | Running rating & notes | 11 | [x] | feat/task-054-running-logging | | 2026-03-15 | bundled in PR #150 |
| T056 | Interval logging (JSON array) | 11 | [x] | feat/task-056-interval-logging | | 2026-03-15 | merged via PR #152 |
| T057 | MMA/BJJ logging form + save SA | 11 | [x] | feat/task-057-mma-bjj-logging | | 2026-03-15 | merged via PR #151 |
| T058 | Already-logged detection | 12 | [x] | feat/task-58-already-logged-detection | | 2026-03-15 | merged via PR #156 |
| T059 | Already-logged summary display | 12 | [x] | feat/task-59-already-logged-summary | | 2026-03-15 | merged via PR #163 |
| T060 | Re-logging prevention | 12 | [x] | feat/task-60-relogging-prevention | | 2026-03-15 | merged via PR #159 |
| T061 | Active routine scope filtering | 12 | [x] | feat/task-61-routine-scope-filtering | | 2026-03-15 | merged via PR #158 |
| T062 | Mark done/skipped SA + check-off UI | 12 | [x] | feat/task-62-mark-done-skipped | | 2026-03-15 | merged via PR #160 |
| T063 | Rest day display + routine integration | 12 | [x] | feat/task-63-rest-day-display | | 2026-03-15 | merged via PR #164 |
| T064 | GET /api/calendar projection logic | 13 | [x] | feat/task-64-calendar-projection | | 2026-03-15 | merged via PR #155 |
| T065 | Calendar month grid UI | 13 | [x] | feat/task-65-calendar-grid-ui | | 2026-03-15 | merged via PR #165 |
| T066 | Day detail drill-in panel | 13 | [x] | feat/task-066-day-detail-drill-in | | 2026-03-16 | merged via PR #168 |
| T067 | Completed day markers | 13 | [x] | feat/task-67-completed-day-markers | | 2026-03-15 | merged via PR #166 |
| T068 | Deload week distinction | 13 | [x] | feat/task-068-deload-week-distinction | | 2026-03-16 | merged via PR #167 |
| T069 | GET /api/progression route handler | 13 | [x] | feat/task-69-api-progression | | 2026-03-15 | merged via PR #153 |
| T070 | Exercise progression chart UI | 13 | [x] | feat/task-70-progression-chart-ui | | 2026-03-15 | merged via PR #154 |
| T071 | Phase boundary markers | 13 | [x] | feat/task-71-phase-boundary-markers | | 2026-03-15 | merged via PR #157 |
| T072 | Weekly completion count | 14 | [x] | feat/task-072-weekly-completion-count | | 2026-03-16 | merged via PR #169 |
| T073 | Streak calculation + display | 14 | [x] | feat/task-073-streak-calculation | | 2026-03-16 | merged via PR #170 |
| T074 | OKLCH theme + dark mode setup | UI-1 | [x] | feat/task-074-oklch-theme | 2026-03-15T18:00 | 2026-03-15 | merged via PR #135 |
| T075 | Geist fonts + Providers + Toaster | UI-1 | [x] | feat/task-075-geist-providers | 2026-03-15T19:00 | 2026-03-15 | merged via PR #136 |
| T076 | Install shadcn components (11) | UI-1 | [x] | feat/task-076-shadcn-components | 2026-03-15T19:00 | 2026-03-15 | merged via PR #137 |
| T077 | Navigation overhaul (collapsible + Sheet) | UI-2 | [x] | feat/task-077-nav-overhaul | 2026-03-15T20:00 | 2026-03-15 | merged via PR #138 |
| T078 | Exercise form Select refactor | UI-2 | [x] | feat/task-078-exercise-select | 2026-03-15T20:00 | 2026-03-15 | merged via PR #139 |
| T079 | Mesocycle form Checkbox + date refactor | UI-2 | [x] | feat/task-079-meso-form-refactor | 2026-03-15T20:00 | 2026-03-15 | merged via PR #140 |
| T080 | Schedule Tabs component refactor | UI-2 | [x] | feat/task-080-schedule-tabs | 2026-03-15T20:00 | 2026-03-15 | merged via PR #141 |
| T081 | Status Badge + Skeleton refactor | UI-2 | [x] | feat/task-081-badge-skeleton | 2026-03-15T20:00 | 2026-03-15 | merged via PR #142 |
| T082 | Visual consistency pass | UI-3 | [x] | feat/task-082-visual-polish | 2026-03-15T21:00 | 2026-03-15 | merged via PR #143 |
| T083 | PageContainer component | R1 | [x] | feat/task-083-page-container | | 2026-03-18 | merged via PR #185 |
| T084 | PageHeader component | R1 | [x] | feat/task-084-page-header | | 2026-03-18 | merged via PR #187 |
| T085 | Adopt PageContainer + PageHeader across all pages | R1 | [x] | feat/task-085-adopt-layout | | 2026-03-18 | merged via PR #188 |
| T086 | RPE schema migration (logged_sets → logged_exercises) | R2 | [x] | feat/task-086-rpe-migration | | 2026-03-18 | merged via PR #186 |
| T087 | 3-column set input grid | R2 | [x] | feat/task-087-3col-grid | | 2026-03-18 | merged via PR #189 |
| T088 | Per-exercise RPE selector (1-10 buttons) | R2 | [x] | feat/task-088-rpe-selector | | 2026-03-18 | merged via PR #190 |
| T089 | Touch target enforcement (44px minimum) | R2 | [x] | feat/task-089-touch-targets | | 2026-03-18 | merged via PR #192 |
| T090 | Update save workout SA for per-exercise RPE | R2 | [x] | feat/task-090-save-sa-rpe | | 2026-03-18 | merged via PR #191 |
| T091 | Modality color utility extraction | R3 | [x] | feat/task-091-modality-colors | | 2026-03-18 | merged via PR #193 |
| T092 | Card normalization pass | R3 | [x] | feat/task-092-card-normalization | | 2026-03-18 | merged via PR #194 |
| T093 | Empty state component | R3 | [x] | feat/task-093-empty-state | | 2026-03-18 | merged via PR #195 |
| T094 | Progressive padding + interactive feedback | R3 | [x] | feat/task-094-progressive-padding | | 2026-03-18 | merged via PR #196 |
| T095 | Time slots schema: period + time_slot on weekly_schedule | F1 | [x] | feat/task-95-time-slot-schema | | 2026-03-19 | merged via PR #234 |
| T096 | Mixed modality schema: template_sections + section_id + mixed enum | F1 | [x] | feat/task-96-mixed-modality-schema | | 2026-03-19 | merged via PR #235 |
| T097 | Routines frequency schema: frequency_mode + frequency_days | F1 | [x] | feat/task-97-routines-frequency-schema | | 2026-03-19 | merged via PR #236 |
| T098 | Shared auto-suggest combobox component | F1 | [x] | feat/task-098-combobox | | 2026-03-19 | merged via PR #240 |
| T099 | Distinct values queries (exercise + routine) | F1 | [x] | feat/task-99-distinct-values | | 2026-03-20 | merged via PR #237 |
| T100 | Add Progression to main nav | F1 | [x] | feat/task-100-progression-nav | | 2026-03-20 | merged via PR #243 |
| T101 | Slot matching utility for cross-template cascade | F1 | [x] | feat/task-101-slot-matching | | 2026-03-19 | merged via PR #239 |
| T102 | Period pill selector + optional time picker component | F2 | [x] | feat/task-102-period-selector | | 2026-03-19 | merged via PR #242 |
| T103 | Schedule assignment SA: period + time_slot | F2 | [x] | feat/task-103-schedule-assignment-sa | | 2026-03-20 | merged via PR #248 |
| T104 | Running/MMA template fields editable post-creation + cascade | F2 | [x] | feat/task-104-running-mma-field-edits | | 2026-03-20 | merged via PR #250 |
| T105 | Cascade slot parameter changes SA (3 scopes) | F2 | [x] | feat/task-105-cascade-slot-params | | 2026-03-20 | merged via PR #244 |
| T106 | Cascade add/remove exercise slot SA | F2 | [x] | feat/task-106-cascade-add-remove-slot | | 2026-03-20 | merged via PR #246 |
| T107 | Mixed template creation + section management SAs | F2 | [x] | feat/task-107-mixed-template-sa | | 2026-03-19 | merged via PR #238 |
| T108 | Collapsible exercise form + comboboxes | F2 | [x] | feat/task-108-collapsible-exercise-form | | 2026-03-20 | merged via PR #253 |
| T109 | Edit exercise form comboboxes | F2 | [x] | feat/task-109-edit-exercise-comboboxes | | 2026-03-20 | merged via PR #251 |
| T110 | Frequency mode selector + day picker component | F2 | [x] | feat/task-110-frequency-mode-selector | | 2026-03-20 | merged via PR #252 |
| T111 | Routine create/edit forms: frequency mode + category combobox | F2 | [x] | feat/task-111-routine-forms | | 2026-03-20 | merged via PR #256, #260 |
| T112 | Today page quick links to template editing | F2 | [x] | feat/task-112-today-quick-links | | 2026-03-20 | merged via PR #254 |
| T113 | Schedule grid multi-entry per day | F3 | [x] | feat/task-113-schedule-grid-multi | | 2026-03-20 | merged via PR #257 |
| T114 | Today API array response + multi-session display | F3 | [x] | feat/task-114-today-multi-session | | 2026-03-20 | merged via PR #245 |
| T115 | Calendar multi-workout per day + period labels | F3 | [x] | feat/task-115-calendar-multi-workout | | 2026-03-20 | merged via PR #258 |
| T116 | Cascade scope selector UI on all edit operations | F3 | [x] | feat/task-116-cascade-scope-selector-ui | | 2026-03-20 | merged via PR #263 |
| T117 | Mixed template creation form UI | F3 | [x] | feat/task-117-mixed-template-form | | 2026-03-19 | merged via PR #241 |
| T118 | Routine scope filtering for frequency modes | F3 | [x] | feat/task-118-routine-scope-filtering | | 2026-03-20 | merged via PR #259 |
| T119 | Header/padding audit + standardization pass | F3 | [x] | feat/task-119-header-padding-audit | | 2026-03-20 | merged via PR #261 |
| T120 | Clone mesocycle: copy period, time_slot, template_sections | F3 | [x] | feat/task-120-clone-meso-copy-periods | | 2026-03-20 | merged via PR #262 |
| T121 | Mixed template display on Today page | F4 | [x] | feat/task-121-mixed-today-display | | 2026-03-20 | merged via PR #247 |
| T122 | Mixed template logging form + composite save SA | F4 | [x] | feat/task-122-mixed-logging | | 2026-03-20 | merged via PR #249 |
| T123 | Calendar + schedule integration for mixed templates | F4 | [x] | feat/task-123-calendar-schedule-mixed | | 2026-03-20 | merged via PR #264 |
| T124 | Calendar day detail quick links to template editing | F4 | [x] | feat/task-124-calendar-day-quick-links | | 2026-03-20 | merged via PR #265 |
| T125 | Cascade auto-dismiss | F5.1 | [x] | feat/task-125-cascade-auto-dismiss | | 2026-03-21 | |
| T126 | Schema: distance/duration + group_id/group_rest | F5.1 | [x] | feat/task-126-schema | | 2026-03-21 | |
| T127 | Types/queries update for distance/duration + supersets | F5.2 | [x] | feat/task-127-types-queries | | 2026-03-21 | |
| T128 | Running template SA: distance/duration + cascade | F5.3 | [x] | feat/task-128-running-sa | | 2026-03-21 | |
| T129 | Running distance/duration UI inputs | F5.4 | [x] | feat/task-129-running-ui | | 2026-03-21 | |
| T130 | Distance/duration display on today + logging | F5.3 | [x] | feat/task-130-today-display | | 2026-03-21 | |
| T131 | Running snapshot: distance/duration | F5.3 | [x] | feat/task-131-snapshot | | 2026-03-21 | |
| T132 | Superset SA: create/break/updateGroupRest | F5.3 | [x] | feat/task-132-superset-sa | | 2026-03-21 | |
| T133 | Superset UI: grouping, selection, CRUD | F5.4 | [x] | feat/task-133-superset-ui | | 2026-03-21 | |
| T134 | Superset display in logging + today + snapshot | F5.5 | [x] | feat/task-134-superset-display | | 2026-03-21 | |
| T135 | Number input zero fix | P1 | [x] | | | | |
| T136 | Cascade toast notification | P1 | [x] | | | | |
| T137 | Template copy server action | P1 | [x] | | | | |
| T138 | Template add picker + copy browse UI | P2 | [x] | | | | |
| T139 | Batch cascade scope (SA + UI) | P2 | [x] | | | | |
| T140 | Mixed template plumbing fixes | P3.1 | [x] | feat/task-140-mixed-plumbing | | 2026-03-22 | merged via PR #289 |
| T143 | Mixed template section editing UI | P3.2 | [x] | feat/task-143-section-editing | | 2026-03-22 | merged via PR #296 |
| T144 | Day detail multi-workout query + API | P3.3 | [x] | feat/task-144-day-detail-multi | | 2026-03-22 | merged via PR #300 |
| T146 | DayDetailPanel expandable cards | P3.3 | [x] | feat/task-146-expandable-cards | | 2026-03-22 | merged via PR #305 |
| T147 | Copy/move exercise slot SAs | P3.4 | [x] | feat/task-147-copy-move-sa | | 2026-03-23 | merged via PR #320 |
| T148 | Target picker modal | P3.4 | [x] | feat/task-148-target-picker | | 2026-03-23 | merged via PR #330 |
| T149 | Slot context menu copy/move actions | P3.4 | [x] | feat/task-149-context-menu | | 2026-03-25 | merged via PR #345 |
| T150 | Superset group transfer prompt | P3.4 | [x] | feat/task-150-superset-transfer | | 2026-03-25 | merged via PR #346 |
| T151 | `slot_week_overrides` schema | P3.5a | [x] | feat/task-151-override-schema | | 2026-03-24 | merged via PR #335 |
| T152 | Week override CRUD SAs | P3.5b | [x] | feat/task-152-override-crud | | 2026-03-24 | merged via PR #336 |
| T153 | Week override merge — today + calendar | P3.5b | [x] | feat/task-153-override-merge | | 2026-03-25 | merged via PR #343 |
| T155 | Snapshot week_number + template copy overrides | P3.5b | [x] | feat/task-155-snapshot-overrides | | 2026-03-25 | merged via PR #344 |
| T157 | Plan Weeks grid UI | P3.5c | [x] | feat/task-157-plan-weeks-grid | | 2026-03-25 | merged via PR #342 |
| T158 | Cascade override warning | P3.5c | [x] | | | | |
| T159 | `athlete_profile` schema + migration | CS1.1 | [x] | | | | |
| T160 | Profile queries + actions | CS1.1 | [x] | | | | |
| T161 | Active mesocycle query (coaching) | CS1.2 | [x] | | | | |
| T162 | Recent sessions query (coaching) | CS1.2 | [x] | | | | |
| T163 | Summary generator | CS1.2 | [x] | | | | |
| T164 | Summary route handler | CS1.3 | [x] | | | | |
| T165 | Coaching page (server component) | CS2 | [x] | | | | |
| T166 | Profile form component | CS2 | [x] | | | | |
| T167 | Subjective state form component | CS2 | [x] | | | | |
| T168 | Summary preview component | CS2 | [x] | | | | |
| T169 | Client orchestrator component | CS2 | [x] | | | | |
| T170 | Nav link (coaching) | CS2 | [x] | | | | |
| T171 | Today API date param | RL1 | [x] | | | | |
| T172 | Today page searchParams | RL1 | [x] | | | | |
| T173 | DayDetailPanel "Log Workout" button | RL1 | [x] | | | | |
| T174 | Retroactive date banner | RL2 | [x] | | | | |
| T175 | Post-save redirect | RL2 | [x] | | | | |
| T176 | E2E: retroactive logging flow | RL2 | [x] | | | | |
| T177 | Elevation gain schema columns | EG1.1 | [x] | | | | |
| T178 | Elevation gain in save + snapshot | EG1.2 | [x] | | | | |
| T179 | Running template form elevation gain | EG2 | [x] | | | | |
| T180 | Running logging form elevation gain | EG2 | [x] | | | | |
| T181 | Elevation gain display in today + calendar | EG2 | [x] | | | | |
| T182 | `schedule_week_overrides` schema | SW1 | [x] | | | | |
| T183 | Effective schedule query | SW2 | [x] | | | | |
| T184 | Wire effective schedule into today + day detail | SW3 | [x] | | | | |
| T185 | Wire effective schedule into calendar projection | SW3 | [x] | | | | |
| T186 | Move workout server action | SW2 | [x] | | | | |
| T187 | Undo schedule move actions | SW2 | [x] | | | | |
| T188 | Move workout modal | SW4 | [x] | | | | |
| T189 | Day detail panel integration | SW4 | [x] | | | | |
| T190 | Resistance autofill on load + reps parsing | AL1 | [x] | | | | |
| T191 | Running + MMA autofill on load | AL1 | [x] | | | | |
| T192 | Mixed modality autofill on load | AL2 | [x] | | | | |
| T193 | "Log as Planned" whole-workout button | AL2 | [x] | | | | |
| T194 | Per-exercise "As Planned" button | AL2 | [x] | | | | |
| T195 | Copy-down button | AL2 | [x] | | | | |
| T196 | Time utilities (derivePeriod, getEndTime, checkOverlap) | TS1 | [ ] | | | | |
| T197 | Schema migration (3-phase: add columns, backfill, enforce) | TS1 | [ ] | | | | |
| T198 | Refactor assignTemplate + removeAssignment (time-first, row-ID) | TS2 | [ ] | | | | |
| T199 | Refactor moveWorkout (time-first, row-ID source) | TS2 | [ ] | | | | |
| T200 | Refactor schedule queries (time-first sorting, duration) | TS2 | [ ] | | | | |
| T201 | Schedule grid time-first UI | TS3 | [ ] | | | | |
| T202 | Move modal time-first UI | TS3 | [ ] | | | | |
| T203 | Time display across views (calendar, today, detail) | TS3 | [ ] | | | | |
| T204 | Google OAuth route handlers + client | GC1 | [ ] | | | | |
| T205 | Google credential queries + disconnect | GC1 | [ ] | | | | |
| T206 | Settings page (GCal connect/disconnect) | GC1 | [ ] | | | | |
| T207 | Sync orchestration layer + event builder | GC2 | [ ] | | | | |
| T208 | Sync hooks in schedule actions | GC2 | [ ] | | | | |
| T209 | Completion sync on workout logging | GC2 | [ ] | | | | |
| T210 | Re-sync + sync status display | GC2 | [ ] | | | | |
| T211 | Rotation cycle columns schema | ROT1.1 | [ ] | | | | |
| T212 | Cycle-aware effective schedule resolution | ROT1.2 | [ ] | | | | |
| T213 | Cycle-aware calendar projection | ROT1.2 | [ ] | | | | |
| T214 | Assign rotation server action | ROT2 | [ ] | | | | |
| T215 | Modify assignTemplate + removeAssignment for rotation | ROT2 | [ ] | | | | |
| T216 | Rotation editor modal | ROT2 | [ ] | | | | |
| T217 | Schedule grid rotation display + entry point | ROT2 | [ ] | | | | |
| T218 | Active weeks query | ROT3 | [ ] | | | | |
| T219 | WeekProgressionGrid active weeks filter | ROT3 | [ ] | | | | |
| T220 | TemplateWeekGrid active weeks filter | ROT3 | [ ] | | | | |
| T221 | Wire active weeks into template pages | ROT3 | [ ] | | | | |
| T222 | Smart clone — slot value inheritance | ROT4 | [ ] | | | | |
| T223 | Smart clone — template value inheritance | ROT4 | [ ] | | | | |
| T224 | Smart clone — rotation preservation | ROT4 | [ ] | | | | |
