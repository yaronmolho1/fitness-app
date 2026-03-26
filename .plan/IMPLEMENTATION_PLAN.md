# Implementation Plan

> 158 tasks across 30 waves. Completed waves (0–14, UI-1–3, R1–3, F1–F5) archived in [ARCHIVE_COMPLETED.md](ARCHIVE_COMPLETED.md).
> Active: P1–P2, P3, CS, RL waves below. Each task = one TDD cycle.

## Archived Waves (134 tasks, all complete)

| Wave Range | Description | Tasks |
|------------|-------------|-------|
| 0–4 | Infrastructure, DB, Auth, Shell, Exercises | T0001–T017 |
| 5–8 | Mesocycles, Templates, Slots, Cascade, Routines | T018–T044 |
| 9–14 | Today, Logging, Calendar, Progression, Analytics | T045–T073 |
| UI-1–3 | Theme, Nav, Forms, Visual Polish | T074–T082 |
| R1–R3 | Layout, Mobile Logging, Consistency | T083–T094 |
| F1–F5 | Schema Enhancements, Logic, UI, Completion, Supersets | T095–T134 |

See [ARCHIVE_COMPLETED.md](ARCHIVE_COMPLETED.md) for full details.

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

---

## Wave EG1: Elevation Gain — Schema + Backend

> Adds elevation_gain across all running-related tables, snapshot, and per-interval data. Follows distance/duration pattern exactly.

### Sub-wave EG1.1 — Schema Migration

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T177 | Elevation gain schema columns: add `target_elevation_gain` (integer, nullable) to `workout_templates` and `template_sections`. Add `elevation_gain` (integer, nullable) to `slot_week_overrides` and `template_week_overrides`. Generate + apply migration. | small | Running Templates | — | elevation-gain |

### Sub-wave EG1.2 — Backend Logic

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T178 | Elevation gain in save + snapshot: add `interval_elevation_gain` (number \| null) to `IntervalRepData` type. Add `actualElevationGain` (number \| null) to `SaveRunningWorkoutInput`. Include `target_elevation_gain` from template and `actual_elevation_gain` from input in `template_snapshot` JSON. Include `interval_elevation_gain` per rep in interval data. Validate non-negative integer when provided. | small | Workout Logging | T177 | elevation-gain |

## Wave EG2: Elevation Gain — UI

> Template form + logging form + display. All depend on schema + backend.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T179 | Running template form elevation gain: add "Target Elevation Gain (m)" NumericInput (integer, min 0) to running-template-form.tsx after target_duration. Initialize from template data. Include in create/update SA calls. Wire cascade for inline edits. Also add to mixed template section form for running sections. | small | Running Templates | T177 | elevation-gain |
| T180 | Running logging form elevation gain: add "Elevation Gain (m)" NumericInput (integer, min 0) to running-logging-form.tsx after HR field. For interval runs, add per-rep "Elevation (m)" input in interval section. Pass `actualElevationGain` + per-rep `interval_elevation_gain` to save SA. Show `target_elevation_gain` in planned reference section when available. | small | Workout Logging | T178 | elevation-gain |
| T181 | Elevation gain display in today + calendar: show target elevation gain (e.g. "200m ascent") in today's planned workout info and day detail panel running workout cards when `target_elevation_gain` is set. Follow distance display pattern. | small | Running Templates | T177 | elevation-gain |

## Wave EG Dependency Graph

```
T177 (schema) → T178 (save + snapshot)
             → T179 (template form)
             → T181 (today + calendar display)
T178 ────────→ T180 (logging form)
```

## Wave EG Critical Path

T177 → T178 → T180 (schema → save logic → logging form, estimated: S + S + S = ~4-6h)

## Wave EG Gap Analysis

No gaps found. Spec follows established patterns from `run-distance-duration` (AC1-4 mirror distance/duration columns, AC5-14 mirror form + snapshot patterns). All referenced tables and components exist.

## Wave EG Risk Areas

- **T178 (snapshot)**: Snapshot JSON gets one more field. No `version` bump needed since field is additive and nullable. Existing logged workouts unaffected.
- **T180 (logging form)**: Interval rep rows already have 3 inputs (pace, HR, notes). Adding elevation makes 4 — may need layout adjustment on narrow mobile screens.

## Wave EG Scope Summary

| Scope | Count | Est. Hours Each | Total |
|-------|-------|-----------------|-------|
| Small | 5 | 1-2h | ~8h |
| **Total** | **5** (T177-T181) | | **~8h** |
