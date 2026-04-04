# Implementation Plan

> 193 tasks across 41 waves. Completed waves (0–14, UI-1–3, R1–3, F1–F5) archived in [ARCHIVE_COMPLETED.md](ARCHIVE_COMPLETED.md).
> Active: P1–P2, P3, CS, RL, EG, SW, AL, TS, GC, ROT waves below. Each task = one TDD cycle.

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

---

## Wave SW1: Schedule Week Overrides — Schema

> New table for per-week schedule overrides. Foundation for the move-workout feature.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T182 | `schedule_week_overrides` table: schema in lib/db/schema.ts. Columns: id (PK), mesocycle_id (FK → mesocycles, CASCADE), week_number (integer), day_of_week (integer 0-6), period (text enum morning/afternoon/evening), template_id (FK → workout_templates, nullable — null=rest/removed), time_slot (text, nullable), override_group (text, not null — links source+target of a move), created_at (timestamp). Unique on (mesocycle_id, week_number, day_of_week, period). Add defineRelations. Generate + apply migration. | small | Feature | — | schedule-week-overrides |

## Wave SW2: Schedule Week Overrides — Query + Mutation Layer

> Depends on SW1. Three parallel tracks.

### Track A: Effective Schedule Resolution

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T183 | Effective schedule query: `getEffectiveScheduleForDay(db, mesocycleId, weekNumber, dayOfWeek, weekType)` in `lib/schedule/override-queries.ts`. Per-slot resolution: check `schedule_week_overrides` for (mesocycle, week, day, period); if override exists use it (null template_id = rest), otherwise fall back to base `weekly_schedule`. Returns array of `EffectiveScheduleEntry` with `template_id`, `period`, `time_slot`, `is_override`, `override_group`. | medium | Feature | T182 | schedule-week-overrides |

### Track B: Move Action

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T186 | Move workout server action: `moveWorkout(input)` in `lib/schedule/override-actions.ts`. Validates: mesocycle not completed, source slot has a template, target slot period available, no logged workout for this template on affected dates. Scope: "this_week" creates 2 override rows (source=null, target=template_id); "remaining_weeks" creates pairs for weeks N through total_weeks, skipping weeks where the template is already logged. Groups rows with `override_group`. Single transaction. Revalidates paths. | medium | Feature | T182, T183 | schedule-week-overrides |

### Track C: Undo Actions

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T187 | Undo schedule move actions: `undoScheduleMove(overrideGroup, mesocycleId)` deletes all rows matching override_group + mesocycle. `resetWeekSchedule(mesocycleId, weekNumber)` deletes all overrides for that week. Both verify mesocycle not completed. Revalidate paths. | small | Feature | T182 | schedule-week-overrides |

## Wave SW3: Schedule Week Overrides — Integration

> Wire effective schedule resolution into existing query paths.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T184 | Wire effective schedule into today + day detail: Replace direct `weekly_schedule` query in `getTodayWorkout()` (lib/today/queries.ts, lines 411-425) and `getDayDetail()` (lib/calendar/day-detail.ts) with `getEffectiveScheduleForDay()`. Move `weekNumber` calculation earlier in `getTodayWorkout()`. | small | Feature | T183 | schedule-week-overrides |
| T185 | Wire effective schedule into calendar projection: In `getCalendarProjection()` (lib/calendar/queries.ts), batch-load all `schedule_week_overrides` for overlapping mesocycles. Build `overrideLookup` (Map by `mesocycle_id-week_number-day_of_week`). In per-date loop, resolve per-slot overrides before falling back to `scheduleLookup`. | medium | Feature | T183 | schedule-week-overrides |

## Wave SW4: Schedule Week Overrides — UI

> Depends on SW2 + SW3. Modal + day detail panel integration.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T188 | Move workout modal: `components/move-workout-modal.tsx`. Dialog with: 7-button day picker (Mon-Sun, source day disabled), period selector (morning/afternoon/evening, occupied periods shown with indicator), time_slot text input (pre-filled from source), scope radio ("This week only" / "This week + remaining"). Shows warning when target period has existing workout. Calls `moveWorkout()` on confirm. | medium | Feature | T186 | schedule-week-overrides |
| T189 | Day detail panel integration: Add "Move Workout" button on projected workout cards for active/planned mesocycles. Show "Overridden" badge on entries resolved from overrides. Add "Undo Move" action on overridden entries (calls `undoScheduleMove`). Wire `MoveWorkoutModal`. Pass `is_override` + `override_group` through from query layer. | medium | Feature | T188, T184, T185, T187 | schedule-week-overrides |

## Wave SW Dependency Graph

```
T182 (schema)
├── T183 (effective schedule query)
│   ├── T184 (wire into today + day detail)
│   ├── T185 (wire into calendar projection)
│   └── T186 (move action) → T188 (modal) ──┐
└── T187 (undo actions) ────────────────────┼── T189 (day detail integration)
                                             │
T184 ───────────────────────────────────────┘
T185 ───────────────────────────────────────┘
```

## Wave SW Critical Path

T182 → T183 → T186 → T188 → T189 (schema → query → move action → modal → integration)

## Wave SW Gap Analysis

- **Retroactive logging overlap**: RL wave's T173 adds "Log Workout" button to DayDetailPanel. T189 adds "Move Workout" alongside it. If RL is not yet implemented, T189 can still proceed — the move button is independent. When both land, they'll share the projected workout card action area.
- **Clone guard**: Clone mesocycle (T040) does not copy `schedule_week_overrides` automatically since the table didn't exist. No code change needed — just a test assertion in T182 or T189.

## Wave SW Risk Areas

- **T185 (calendar projection)**: Batch override loading adds complexity to already-complex `getCalendarProjection()`. Must ensure no performance regression for the common case (no overrides). Mitigated: empty override lookup is O(1) per date.
- **T186 (move action)**: "Remaining weeks" scope with logged workout checks requires date arithmetic per week to determine if a log exists. Must calculate actual dates from mesocycle start + week_number + day_of_week.
- **T189 (day detail integration)**: DayDetailPanel needs `is_override` and `override_group` from the query layer. This means the query response types need extending, which touches multiple files.

## Wave SW Scope Summary

| Scope | Count | Est. Hours Each | Total |
|-------|-------|-----------------|-------|
| Small | 3 | 1-2h | ~5h |
| Medium | 5 | 3-5h | ~20h |
| **Total** | **8** (T182-T189) | | **~25h** |

---

## Wave AL1: Smart Logging Autofill — Foundation

> Autofill inputs with planned values on form load. Two parallel tracks: resistance and running/MMA.

### Track A: Resistance Autofill

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T190 | Resistance autofill on load + reps parsing utility: modify `buildInitialSets()` in `workout-logging-form.tsx` to prefill weight and reps from `SlotData` values instead of empty strings. Add shared `parseRepsLowerBound(reps: string)` utility — extracts lower bound from ranges ("8-12" → 8, "8" → 8, "AMRAP" → null, "5-5" → 5). Handle null `weight` → empty input (not "0"). Add muted hint label "Target: X-Y" beneath reps input when reps is a range. Remove existing placeholder attrs (replaced by real values). RPE, rating, notes remain empty. | medium | Workout Logging | — | smart-logging-autofill |

### Track B: Running + MMA Autofill

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T191 | Running + MMA autofill on load: in `running-logging-form.tsx`, initialize `actual_distance` from `target_distance` and `actual_avg_pace` from `target_pace` when available (null → empty). Leave `actual_avg_hr` empty (no planned equivalent). In `mma-logging-form.tsx`, initialize `actual_duration_minutes` from `planned_duration` when available. Leave `feeling` unset and notes empty. | small | Workout Logging | — | smart-logging-autofill |

## Wave AL2: Smart Logging Autofill — Buttons + Mixed

> Depends on AL1. Four parallel tasks once resistance autofill lands.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T192 | Mixed modality autofill on load: wire per-section autofill in `mixed-logging-form.tsx`. Resistance sections autofill per T190 logic, running sections per T191, MMA sections per T191. Each section's initial state uses modality-appropriate prefill. | small | Workout Logging | T190, T191 | smart-logging-autofill |
| T193 | "Log as Planned" whole-workout button: add button below workout name in all logging forms. Visible only when no inputs have been modified from autofilled values. Track `isModified` state (set true on any weight/reps/actual field change; once true, stays true). Tapping scrolls to rating/notes section + shows Sonner toast "Review and save when ready." Normal save button completes the flow. Works across all modalities. | medium | Workout Logging | T190 | smart-logging-autofill |
| T194 | Per-exercise "As Planned" button: add small button in exercise header row (resistance) and section header (running/MMA in mixed). Tapping fills all sets with planned weight + lower-bound reps (via `parseRepsLowerBound`), restores set count to `target_sets` (removes extras, re-adds removed). Does NOT modify RPE. For running/MMA sections: fills actual fields with planned targets. | small | Workout Logging | T190 | smart-logging-autofill |
| T195 | Copy-down button: show right-aligned "Copy down" button after set 1's row when (a) exercise has 2+ sets and (b) user has edited set 1 after initial autofill load. Tapping copies set 1's current weight and reps to sets 2 through N. RPE unaffected (per-exercise). Button not shown when set 1 still matches autofill value. Track set-1-edited state per exercise. | small | Workout Logging | T190 | smart-logging-autofill |

## Wave AL Dependency Graph

```
T190 (resistance autofill + reps util) ── T192 (mixed autofill)
                                       ├── T193 (log as planned button)
                                       ├── T194 (per-exercise as planned)
                                       └── T195 (copy-down)
T191 (running + MMA autofill) ─────────── T192 (mixed autofill)
```

## Wave AL Critical Path

T190 → T193 (resistance autofill → log as planned button, estimated: M + M = ~8-12h)

## Wave AL Gap Analysis

- **Supersedes placeholder approach**: `pre-filled-resistance-logging.md` AC#15-16 specifies "pre-filled" but implementation uses placeholders. T190 resolves this gap by using real input values.
- **Save-time fallback retained**: `resolveSetFallbacks()` in `save-workout.ts` stays as safety net for edge cases (user clears an input and saves). No code removal needed.
- **Open questions**: 4 items noted in spec with recommendations. All have clear defaults — no blockers.

## Wave AL Risk Areas

- **T190 (resistance autofill)**: `buildInitialSets` is the core initialization path. Must ensure autofilled values are distinguishable from user edits for "Log as Planned" and copy-down state tracking. Consider storing initial values for comparison.
- **T193 (log as planned)**: `isModified` tracking across all form inputs adds state complexity. One-way flag (never resets) keeps it simple.

## Wave AL Scope Summary

| Scope | Count | Est. Hours Each | Total |
|-------|-------|-----------------|-------|
| Small | 3 | 1-2h | ~5h |
| Medium | 2 | 3-5h | ~8h |
| **Total** | **6** (T190-T195) | | **~13h** |

---

## Wave TS1: Time Scheduling — Foundation

> Schema migration + shared utilities. Everything downstream depends on this wave.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T196 | Time utilities: create `lib/schedule/time-utils.ts` with `derivePeriod(timeSlot)` (hour < 12 = morning, 12-16 = afternoon, 17+ = evening), `getEndTime(timeSlot, duration)` (returns HH:MM), `checkOverlap(entries, newTime, newDuration)` (range overlap detection). Export `Period` type. Update `timeSlotSchema` validation to be reusable. Unit tests for all functions including edge cases (midnight crossing, boundary hours 12:00/17:00). | small | Time Scheduling | — | time-based-scheduling |
| T197 | Schema migration (3-phase): Phase 1 — add `duration INTEGER` (nullable) to `weekly_schedule` + `schedule_week_overrides`, add `estimated_duration INTEGER` to `workout_templates`, add `timezone TEXT DEFAULT 'UTC'` to `athlete_profile`, create `google_credentials` + `google_calendar_events` tables. Phase 2 — backfill: time_slot from period (morning→07:00, afternoon→13:00, evening→18:00) where null, duration from template modality (resistance/mixed=90, running=target_duration or 60, MMA=planned_duration or 90). Phase 3 — table recreation: `time_slot` NOT NULL, `duration` NOT NULL, drop old unique indexes, create new `(mesocycle_id, day_of_week, week_type, time_slot, template_id)` + equivalent for overrides. Single Drizzle migration file with hand-edited backfill SQL. | medium | Time Scheduling | — | time-scheduling-migration |

## Wave TS2: Time Scheduling — Backend Refactor

> Refactor all schedule actions and queries from period-based to time-first model. Three parallel tracks.

### Track A: Schedule Actions

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T198 | Refactor `assignTemplate` + `removeAssignment` in `lib/schedule/actions.ts`: `assignTemplate` takes required `time_slot` (HH:MM) and `duration` (minutes), derives `period` via `derivePeriod()` before write, upserts on new unique constraint `(meso, day, weekType, time_slot, template_id)`. Remove `period` from input schema. `removeAssignment` takes row ID (integer) instead of composite key `(meso, day, weekType, period)`. Update Zod schemas, guards, and return types. | medium | Time Scheduling | T196, T197 | time-based-scheduling |

### Track B: Override Actions

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T199 | Refactor `moveWorkout` in `lib/schedule/override-actions.ts`: source identified by schedule entry row ID (not day+period). Target takes `time_slot` + `duration` (required) instead of `period`. Derive period for override rows. `undoScheduleMove` and `resetWeekSchedule` unchanged (operate on override_group/week — not affected by keying change). Update Zod schema: replace `source_day`+`source_period` with `schedule_id`, replace `target_period` with `target_time_slot`+`target_duration`. | medium | Time Scheduling | T196, T197 | move-workout-time-aware |

### Track C: Queries

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T200 | Refactor schedule queries for time-first model: (a) `getEffectiveScheduleForDay` in `lib/schedule/override-queries.ts` — change override matching from period-key to time_slot-key, add `duration` to `EffectiveScheduleEntry` type, sort results by `time_slot` ascending (not period order). (b) `getCalendarProjection` in `lib/calendar/queries.ts` — include `time_slot` + `duration` in `CalendarDay` type, override lookup key changes from `meso-week-day-period` to `meso-week-day-time_slot`, sort per-day entries by time_slot. (c) `getTodayWorkout` in `lib/today/queries.ts` — sort results by `time_slot` ascending, include duration in response. (d) `getScheduleForMesocycle` in `lib/schedule/queries.ts` — order by `time_slot` instead of period. Update `formatPeriodLabel` to show duration. | medium | Time Scheduling | T196, T197 | schedule-time-display |

## Wave TS3: Time Scheduling — UI

> Replace period-based UI with time-based inputs and display. Three parallel tracks.

### Track A: Schedule Grid

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T201 | Schedule grid time-first UI: replace 3 period buttons ("+ Morning/Afternoon/Evening") per day with single "+ Add Workout" button. On click: show inline form with template picker + time input (HH:MM, 24h) + duration input (minutes). Duration pre-fills from template's `estimated_duration`/`target_duration`/`planned_duration` (90min default for resistance). Show entries sorted chronologically with period section headers (derived). Overlap warning (yellow) when new entry's time range intersects existing entries. Remove `PERIODS` constant and `PERIOD_ORDER` from grid logic. | large | Time Scheduling | T198 | time-based-scheduling |

### Track B: Move Modal

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T202 | Move modal time-first UI: replace period radio selector with time input (HH:MM) + duration input (minutes). Pre-fill both from source workout's current values. Remove "target period occupied" / "all periods full" restrictions. Add overlap warning (non-blocking) when target time range intersects existing entries on target day. Wire to refactored `moveWorkout` SA (passes time_slot + duration instead of period). | medium | Time Scheduling | T199 | move-workout-time-aware |

### Track C: Display Views

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T203 | Time display across views: (a) Calendar grid pills — prefix with "HH:MM" (e.g., "07:00 Push A"), sort chronologically. (b) Day detail panel — show "HH:MM — Xmin" on each workout card, sort chronologically. (c) Today view — show start time + duration per session, sort chronologically (use `time_slot` from API), keep period group headers as visual separators. (d) `formatPeriodLabel` already handles time_slot — update to also show duration. | medium | Time Scheduling | T200 | schedule-time-display |

## Wave GC1: Google Calendar — OAuth + Connect

> Google OAuth flow + credential storage + settings page. Can run in parallel with TS2/TS3 (only depends on T197 schema).

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T204 | Google OAuth route handlers + client: create `lib/google/client.ts` with `createOAuth2Client()` and `getAuthenticatedClient()` (loads credentials from DB, sets up token refresh listener to persist new tokens). Create `GET /api/auth/google/route.ts` — generates CSRF state token (stored in httpOnly cookie), redirects to Google OAuth consent with `calendar` scope + `access_type=offline` + `prompt=consent`. Create `GET /api/auth/google/callback/route.ts` — validates state, exchanges code for tokens, reads primary calendar timezone via `CalendarList.get('primary')`, creates "Fitness" calendar via `Calendars.insert`, stores credentials + calendar_id in `google_credentials`, updates `athlete_profile.timezone`, redirects to `/settings`. Install `@googleapis/calendar` + `google-auth-library`. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` env vars. | large | Google Calendar | T197 | google-calendar-connect |
| T205 | Google credential queries + disconnect: create `lib/google/queries.ts` with `getGoogleCredentials()`, `isGoogleConnected()`, `getEventMapping(mesoId, templateId, date)`, `getEventsByMesocycle(mesoId)`. Create `lib/google/actions.ts` with `disconnectGoogle()` Server Action — deletes credentials row, optionally deletes Fitness calendar via API. Create `POST /api/google/disconnect/route.ts` as alternative endpoint. | small | Google Calendar | T204 | google-calendar-connect |
| T206 | Settings page: create `app/(app)/settings/page.tsx`. Google Calendar section: if disconnected, show "Connect Google Calendar" button (links to `/api/auth/google`). If connected, show: green connected badge, timezone (from athlete_profile), "Disconnect" button with confirmation dialog. Add settings link to nav. | medium | Google Calendar | T204, T205 | google-calendar-connect |

## Wave GC2: Google Calendar — Sync Layer

> Push sync layer + hooks into schedule actions + completion sync. Depends on GC1 + TS2.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T207 | Sync orchestration layer: create `lib/google/sync.ts` with `syncMesocycle(mesoId)` (project all workouts, batch-insert events), `syncScheduleChange(action, mesoId, affectedDates)` (diff existing mappings, insert/update/delete), `syncCompletion(mesoId, templateId, date)` (update event title with checkmark). Create `lib/google/types.ts` with `GCalEventParams`, `SyncResult`. Create event builder: `buildEventBody(params)` — sets title "{name} — Week N", start/end from time_slot+duration+timezone, description with exercise list + deep links (`{APP_URL}/?date=X` and `?date=X&action=log`), modality color, extendedProperties.private with mapping IDs. Use `@googleapis/calendar` for API calls. Batch insert (up to 50) for bulk operations. Handle 404/410 on update by recreating. | large | Google Calendar | T205 | google-calendar-sync |
| T208 | Sync hooks in schedule + mesocycle actions: after successful local write in `assignTemplate` (`lib/schedule/actions.ts`), `removeAssignment`, `moveWorkout` (`lib/schedule/override-actions.ts`), `undoScheduleMove`, `resetWeekSchedule` — call `syncScheduleChange()` fire-and-forget (`.catch(() => {})`). In mesocycle create/clone (`lib/mesocycles/clone-actions.ts`) — call `syncMesocycle(newMesoId)` after transaction commits. In mesocycle delete (`lib/mesocycles/delete-actions.ts`) — call batch delete for all mapped events. In mesocycle edit (date range change) — call `syncMesocycle()` to re-project (covers AC18: delete events outside new range, create for newly covered dates). `projectAffectedDates(mesoId, dayOfWeek, weekType)` helper computes which dates are affected by a base schedule change. Never block the local mutation on sync failure. | medium | Google Calendar | T207, T198, T199 | google-calendar-sync |
| T209 | Completion sync: in all workout logging actions (`lib/workouts/save-workout.ts`, `save-running-workout.ts`, `save-mma-workout.ts`, `save-mixed-workout.ts`), after successful save, call `syncCompletion(mesoId, templateId, logDate)`. Looks up `google_calendar_events` mapping for that template+date. If found and Google connected, updates event title to "✅ {name} — Week N". If mapping not found or Google not connected, skip silently. | medium | Google Calendar | T207 | google-calendar-sync |
| T210 | Re-sync + status display: create `POST /api/google/sync/route.ts` — calls `retryFailedSyncs()` which queries all `sync_status='failed'` mappings and retries. Create `GET /api/google/status/route.ts` — returns connection status + counts of synced/pending/failed events + last sync timestamp. Add re-sync button + status display to settings page (extends T206). | small | Google Calendar | T207, T206 | google-calendar-sync |

## Wave TS+GC Dependency Graph

```
T196 (time utils) ─────────────────────────── T198 (assign/remove refactor) → T201 (schedule grid UI)
                                            ├── T199 (move refactor) ────────→ T202 (move modal UI)
T197 (schema migration) ─┬── T200 (query refactor) ────────────────────────→ T203 (display views)
                          │
                          └── T204 (OAuth routes + client)
                              └── T205 (queries + disconnect) → T206 (settings page)
                                  └── T207 (sync layer) ──┬── T208 (sync hooks in actions)
                                                           ├── T209 (completion sync)
                                                           └── T210 (re-sync + status)
```

## Wave TS+GC Critical Path

T197 → T204 → T205 → T207 → T208 (schema → OAuth → queries → sync → hooks)
Estimated: M + L + S + L + M = ~20-30h

Alternative path (time scheduling only):
T197 → T198 → T201 (schema → action refactor → grid UI)
Estimated: M + M + L = ~12-18h

## Wave TS+GC Gap Analysis

1. **Existing `workout-time-slots.md` superseded**: Marked as superseded in spec file. Existing implementation (period selector, period column, 3-per-day constraint) is replaced by the new time-first model. No conflict — the new specs build on the foundation the old spec created.
2. **SW wave (T182-T189) completed with period-based keying**: T198-T200 refactor the code those tasks created. Dependency is sequential — T182-T189 must be complete before T198-T200 run. Confirmed complete per git log.
3. **CS wave `athlete_profile` (T159)**: T197 adds `timezone` column to `athlete_profile`. If T159 hasn't run yet, T197's migration must include the full table (not just ALTER). Current schema shows the table exists, so T159 is effectively complete.
4. **`estimated_duration` on resistance templates**: No UI for editing this field in template forms yet. T201 uses it for duration pre-fill but doesn't require it — defaults to 90min when null. Template form update can be a follow-up or folded into T201.
5. **`action=log` query param**: The today page doesn't currently handle an `action=log` param. T203 or a separate task should add this for the GCal deep link to work. Flagged as implementation detail in T203.

## Wave TS+GC Risk Areas

- **T197 (schema migration)**: Highest risk. SQLite table recreation required for NOT NULL enforcement. Hand-editing Drizzle's generated migration SQL is error-prone. Must test with a copy of production data. Backup DB before running.
- **T201 (schedule grid UI)**: Largest UI change. Replacing 3 period buttons with time/duration form in every day cell. `schedule-grid.tsx` is already a complex component. May need to extract `ScheduleEntryForm` sub-component.
- **T204 (OAuth)**: First external integration. Requires Google Cloud Console setup (manual step). Testing requires a real Google account. E2E testing of OAuth flow is inherently difficult — recommend manual testing + integration tests for token exchange logic.
- **T207 (sync layer)**: Must handle Google API errors gracefully without blocking local operations. Batch insert for mesocycle creation (potentially 30+ events) needs rate limit awareness. `@googleapis/calendar` handles some of this, but edge cases (partial batch failure) need careful handling.
- **T208 (sync hooks)**: Touches every schedule action. Must ensure fire-and-forget pattern doesn't introduce unhandled promise rejections. Async hooks in synchronous Server Actions need careful wiring.

## Wave TS+GC Scope Summary

| Scope | Count | Est. Hours Each | Total |
|-------|-------|-----------------|-------|
| Small | 3 (T196, T205, T210) | 1-3h | ~6h |
| Medium | 9 (T197, T198, T199, T200, T202, T203, T206, T208, T209) | 3-6h | ~40h |
| Large | 3 (T201, T204, T207) | 6-10h | ~24h |
| **Total** | **15** (T196-T210) | | **~70h** |

---

## Wave ROT1: Template Rotation — Schema + Resolution

> Schema migration for cycle columns + resolution logic update. Foundation for all rotation features. Depends on TS1 (T197) since it modifies `weekly_schedule` which TS1 also migrates. If TS1 hasn't shipped, merge into single migration.

### Sub-wave ROT1.1 — Schema

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T211 | Rotation cycle columns: add `cycle_length INTEGER NOT NULL DEFAULT 1` and `cycle_position INTEGER NOT NULL DEFAULT 1` to `weekly_schedule`. Drop old unique index `weekly_schedule_meso_day_type_timeslot_template_idx`, create new `weekly_schedule_meso_day_type_timeslot_position_idx` on `(mesocycle_id, day_of_week, week_type, time_slot, cycle_position)`. All existing rows get defaults — zero behavior change. Generate + apply migration. | small | Template Rotation | T197 | schedule-rotation-cycle |

### Sub-wave ROT1.2 — Resolution Logic

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T212 | Cycle-aware effective schedule resolution: modify `getEffectiveScheduleForDay()` in `lib/schedule/override-queries.ts`. After fetching base rows, group by `time_slot`. For each group with `cycle_length > 1`, compute `active_position = ((weekNumber - 1) % cycle_length) + 1`, keep only the matching row. For `cycle_length = 1`, keep as-is. Add `cycle_length` and `cycle_position` to `EffectiveScheduleEntry` type. Override merging unchanged — override wins over rotation-resolved template. | medium | Template Rotation | T211 | schedule-rotation-cycle |
| T213 | Cycle-aware calendar projection: modify `getCalendarProjection()` in `lib/calendar/queries.ts`. In per-date loop, after looking up base entries from `scheduleLookup`, filter by cycle position using same formula as T212. No changes to override merging. | small | Template Rotation | T211 | schedule-rotation-cycle |

## Wave ROT2: Template Rotation — Actions + UI

> Schedule actions for creating/removing rotations + schedule grid UI. Depends on ROT1.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T214 | Assign rotation server action: `assignRotation(input)` in `lib/schedule/actions.ts`. Input: mesocycle_id, day_of_week, week_type, time_slot, duration, positions (array of {cycle_position, template_id}). Validates: positions contiguous 1..N (2-8), all template_ids exist in mesocycle. Atomically deletes existing rows for same (meso, day, week_type, time_slot), inserts N rows with shared cycle_length. Revalidates paths. Fire-and-forget GCal sync if connected. | medium | Template Rotation | T212 | schedule-rotation-cycle |
| T215 | Modify assignTemplate + removeAssignment for rotation: in `assignTemplate`, add `cycle_length=1, cycle_position=1` to insert values (no signature change). In `removeAssignment`, if removed row has `cycle_length > 1`, delete ALL rows sharing same (meso, day, week_type, time_slot) — full rotation removal, not partial. | small | Template Rotation | T211 | schedule-rotation-cycle |
| T216 | Rotation editor modal: new `components/rotation-editor-modal.tsx`. Dialog with: cycle length selector (2-8, default 4), dynamic list of position rows (each with template picker filtered to running templates in this mesocycle). Same template selectable in multiple positions. Save calls `assignRotation` SA. Cancel discards. Edit mode: pre-fills from existing rotation rows. | medium | Template Rotation | T214 | schedule-rotation-cycle |
| T217 | Schedule grid rotation display + entry point: in `components/schedule-grid.tsx`, for slots with `cycle_length > 1`, show rotation badge (e.g., "4-week cycle"). Clicking opens rotation summary (list of positions → templates) with "Edit Rotation" and "Remove" actions. "Assign Rotation" option added to slot assignment menu (alongside existing "Assign template"). Completed mesocycle: rotation visible but not editable. | medium | Template Rotation | T216, T215 | schedule-rotation-cycle |

## Wave ROT3: Plan-Weeks Filtering

> Active weeks query + grid component filtering. Depends on ROT1 for rotation data model.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T218 | Active weeks query: `getActiveWeeksForTemplate(db, templateId, mesocycleId)` in `lib/schedule/queries.ts`. For each schedule entry referencing this template: compute which mesocycle weeks it appears in based on cycle_position + cycle_length + work_weeks. Union across all slots (same template may appear in multiple slots/positions). Factor in schedule_week_overrides: exclude weeks where override replaces this template, include weeks where override adds this template. Return sorted `number[]`. | medium | Template Rotation | T211 | plan-weeks-rotation-filter |
| T219 | WeekProgressionGrid active weeks filter: add optional `activeWeeks?: number[]` prop to `components/week-progression-grid.tsx`. When provided, `initWeeks()` generates rows only for weeks in the array (preserving actual week numbers, not renumbering). Deload row shown only if template has a deload schedule entry. When absent, generates all weeks (backward compat). | small | Template Rotation | T218 | plan-weeks-rotation-filter |
| T220 | TemplateWeekGrid active weeks filter: same `activeWeeks` prop pattern as T219, applied to `components/template-week-grid.tsx`. Running/MMA grids show only active weeks. Deload row logic same as T219. | small | Template Rotation | T218 | plan-weeks-rotation-filter |
| T221 | Wire active weeks into template detail pages: in template detail/editing views, call `getActiveWeeksForTemplate()` and pass result as `activeWeeks` prop to WeekProgressionGrid and TemplateWeekGrid. For templates with no schedule assignments, pass undefined (show all weeks). | small | Template Rotation | T218, T219, T220 | plan-weeks-rotation-filter |

## Wave ROT4: Smart Clone — Latest Value Inheritance

> Independent of rotation UI. Depends on ROT1 for cycle columns in schema.

| ID | Description | Scope | Epic | Deps | Spec |
|----|-------------|-------|------|------|------|
| T222 | Smart clone — slot value inheritance: modify `cloneMesocycle()` in `lib/mesocycles/clone-actions.ts`. For each source exercise slot, query `slot_week_overrides` at `week_number = source.work_weeks`. If found, merge with base using existing `mergeSlotWithOverride()` — use merged values (weight, reps, sets, rpe, distance, duration, pace) as new slot's base. If no override at last week, copy base as-is (current behavior). No slot_week_overrides created in new meso. | medium | Smart Clone | T211 | smart-clone-progression |
| T223 | Smart clone — template value inheritance: in same `cloneMesocycle()`, for each source template, query `template_week_overrides` at `week_number = source.work_weeks` (with section_id=null for standalone, per-section for mixed). Merge non-null fields (distance, duration, pace, interval_count, interval_rest, planned_duration) into new template's base values. For mixed templates, also query per-section overrides and merge into cloned sections. | medium | Smart Clone | T211 | smart-clone-progression |
| T224 | Smart clone — rotation preservation: in `cloneMesocycle()` schedule clone loop, copy `cycle_length` and `cycle_position` when cloning weekly_schedule rows. Template_id remapping via existing `templateIdMap` handles rotation positions correctly. | small | Smart Clone | T211 | smart-clone-progression |

## Wave ROT Dependency Graph

```
T197 (TS1 schema) → T211 (rotation schema)
                    ├── T212 (effective schedule resolution) → T214 (assignRotation SA) → T216 (rotation editor modal) → T217 (schedule grid display)
                    ├── T213 (calendar projection filter)
                    ├── T215 (assignTemplate + removeAssignment mods)                                                  ↗
                    ├── T218 (active weeks query) → T219 (WeekProgressionGrid filter) ──┐
                    │                             → T220 (TemplateWeekGrid filter) ──────┼── T221 (wire into template pages)
                    ├── T222 (slot value inheritance)
                    ├── T223 (template value inheritance)
                    └── T224 (rotation preservation on clone)
```

## Wave ROT Critical Path

T197 → T211 → T212 → T214 → T216 → T217 (schema → rotation schema → resolution → action → editor → grid display)
Estimated: M + S + M + M + M + M = ~20-28h

## Wave ROT Gap Analysis

1. **TS1 dependency**: T211 depends on T197 (time scheduling schema migration). If T197 hasn't shipped, T211's migration can be combined into T197. If T197 is already applied, T211 is a standalone ALTER TABLE + index recreation.
2. **Existing `assignTemplate` backward compat**: T215 adds `cycle_length=1, cycle_position=1` defaults. Existing callers don't pass these — Drizzle defaults handle it. No breaking change.
3. **GCal sync**: No rotation-specific sync tasks needed. `syncMesocycle` already calls `getEffectiveScheduleForDay()` per date — once T212 makes that function cycle-aware, sync resolves rotation automatically.
4. **`schedule_week_overrides` interaction**: T212 applies rotation filter BEFORE override merging — overrides always win. No change to override tables or actions needed.
5. **Template deletion in rotation**: CASCADE DELETE on `weekly_schedule.template_id` FK removes affected rotation rows. Remaining positions may have gaps. No spec coverage for warning the user — flagged as minor UX gap, non-blocking.

## Wave ROT Risk Areas

- **T211 (schema)**: Unique index change is a breaking migration if done wrong. Must drop old index before creating new one. SQLite ALTER TABLE limitations — may need table recreation if Drizzle generates incompatible SQL.
- **T212 (resolution)**: Hot path — `getEffectiveScheduleForDay` is called by today view, calendar projection, and GCal sync. Must ensure zero performance regression for `cycle_length=1` (the common case). Grouping by time_slot + filtering adds one loop iteration.
- **T218 (active weeks query)**: Most complex query — must union across multiple schedule slots, factor in overrides. Edge cases: template in both rotating and non-rotating slots, override adding/removing template for specific weeks.
- **T222-T223 (smart clone)**: Modifies the clone transaction which is already complex (3 nested ID maps). Must not break existing clone behavior when no overrides exist.

## Wave ROT Scope Summary

| Scope | Count | Est. Hours Each | Total |
|-------|-------|-----------------|-------|
| Small | 6 (T211, T213, T215, T219, T220, T224) | 1-3h | ~12h |
| Medium | 8 (T212, T214, T216, T217, T218, T221, T222, T223) | 3-6h | ~36h |
| **Total** | **14** (T211-T224) | | **~48h** |
