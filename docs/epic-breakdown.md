# Epic Breakdown — V1

> Derived from [PRD](prd.md) and [Architecture](architecture.md). Stories ordered by dependency chain — blockers first.

## Critical Path

```
DB Schema → Auth → App Shell → Create Mesocycle → Resistance Templates ──┐
                             → Exercise CRUD → Exercise Search & Filter ─┴→ Exercise Slots ─┐
                             → Mesocycle Status ────────────────────────────────────────────┐│
                                                   Resistance Templates → Schedule Grid ────┤│
                                                                                            ↓↓
                                                                View Today's Planned Workout
                                                                            ↓
                                                             Pre-filled Resistance Logging
                                                                            ↓
                                                                    Log Immutability
                                                                            ↓
                                                             Exercise Progression Chart
                                                                            ↓
                                                              Phase Boundary Markers
```

**Parallel tracks** (can run alongside critical path):
- Running/MMA templates → after Create Mesocycle
- Daily Routines → after Create Mesocycle
- Exercise Deletion Protection → after Exercise CRUD
- Template Cascade → after Templates + Schedule + Status
- Mesocycle Cloning → after Slots + Schedule
- Calendar views → after Schedule

## Epics Overview

| # | Epic | Stories | Blocked By |
|---|------|---------|------------|
| 1 | Foundation | 3 | — |
| 2 | Exercise Library | 3 | Foundation |
| 3 | Mesocycle Lifecycle | 3 | Foundation |
| 4 | Workout Templates | 6 | Exercises, Mesocycles |
| 5 | Weekly Schedule | 3 | Templates |
| 6 | Template Cascade | 2 | Templates, Schedule, Status |
| 7 | Mesocycle Cloning | 2 | Slots, Schedule |
| 8 | Daily Routines | 3 | Mesocycles |
| 9 | Today's Workout | 3 | Schedule, Status |
| 10 | Workout Logging | 9 | Today's Workout, Slots, Templates |
| 11 | Calendar & Progression | 6 | Schedule, Logging |

---

## Epic: Foundation

Infrastructure every feature depends on: database, auth, app shell.

---

### Foundation > DB Schema & Migrations
**Depends:** none
**Description:** SQLite with WAL mode, Drizzle ORM v2 `defineRelations`, all 10 tables from the data model, PRAGMAs, and initial migration.

### Foundation > Auth System
**Depends:** DB Schema & Migrations
**Description:** Login page, JWT cookie auth via `jose`, middleware route protection for `(app)` routes, logout — env-based single-user credentials.

### Foundation > App Shell & Navigation
**Depends:** Auth System
**Description:** Root layout with responsive navigation (desktop sidebar, mobile bottom bar), `(app)`/`(auth)` route groups, `GET /api/health` endpoint.

---

## Epic: Exercise Library

Global reference dataset. Must exist before workout templates can reference exercises.

---

### Exercise Library > Exercise CRUD
**Depends:** App Shell & Navigation
**Description:** Create, read, update, delete exercises with name, modality (resistance/running/MMA), muscle group, and equipment fields.

### Exercise Library > Exercise Search & Filter
**Depends:** Exercise CRUD
**Description:** Searchable exercise list with modality filter for fast lookup when building templates.

### Exercise Library > Exercise Deletion Protection
**Depends:** Exercise CRUD
**Description:** Block deletion of exercises used in any template's exercise slots with clear error message.

---

## Epic: Mesocycle Lifecycle

Training phase containers — templates, schedules, and logs are all scoped to a mesocycle.

---

### Mesocycle Lifecycle > Create Mesocycle
**Depends:** App Shell & Navigation
**Description:** Define a training block with name, start date, number of work weeks, and deload week toggle.

### Mesocycle Lifecycle > Auto-calculate End Date
**Depends:** Create Mesocycle
**Description:** End date derived from start + work weeks + optional deload week — no manual date math.

### Mesocycle Lifecycle > Mesocycle Status Management
**Depends:** Create Mesocycle
**Description:** Status lifecycle (planned → active → completed) with rules: only one active at a time, completed is terminal.

---

## Epic: Workout Templates

The core planning unit. Templates define workouts; exercise slots define exercises within resistance templates. Running and MMA/BJJ have modality-specific fields.

---

### Workout Templates > Create Resistance Templates
**Depends:** Create Mesocycle
**Description:** Create/edit named resistance workout templates (Push A, Pull B) scoped to a mesocycle with `canonical_name` slug for cross-phase linking. Templates are containers — exercise references live in Exercise Slots. Both template metadata and `canonical_name` are editable after creation (renaming breaks cross-phase linking intentionally).

### Workout Templates > Exercise Slots
**Depends:** Create Resistance Templates, Exercise Search & Filter
**Description:** Add exercises to resistance templates with per-slot targets: sets, reps, weight, RPE, rest period, and text guidelines. Exercise picker uses searchable list from Exercise Search & Filter.

### Workout Templates > Main vs Complementary Marking
**Depends:** Exercise Slots
**Description:** Mark exercise slots as main or complementary so primary lifts are visually distinct in planning and logging UIs.

### Workout Templates > Running Templates
**Depends:** Create Mesocycle
**Description:** Create running workout templates with run type, target pace, HR zone, interval count/rest, and coaching cues as first-class fields.

### Workout Templates > MMA/BJJ Template Support
**Depends:** Create Mesocycle
**Description:** MMA/BJJ modality on workout templates — occurrence-based with duration field, no exercise slots.

### Workout Templates > Drag-Reorder Exercises
**Depends:** Exercise Slots
**Description:** Drag-and-drop reordering of exercise slots within a template to control workout sequencing.

---

## Epic: Weekly Schedule

Maps templates to days of the week. Drives the calendar view and today's workout lookup.

---

### Weekly Schedule > 7-Day Assignment Grid
**Depends:** Create Resistance Templates
**Description:** Assign workout templates to days (Mon–Sun) for a mesocycle, creating the repeating weekly pattern.

### Weekly Schedule > Normal vs Deload Tabs
**Depends:** 7-Day Assignment Grid
**Description:** Separate schedule configurations for normal and deload weeks — deload uses entirely different templates, not just lighter loads.

### Weekly Schedule > Explicit Rest Days
**Depends:** 7-Day Assignment Grid
**Description:** Days with no template assigned display as explicit rest days in the schedule and calendar views.

---

## Epic: Template Cascade

The killer feature. Template edits propagate across phases automatically via `canonical_name` matching.

---

### Template Cascade > Cascade Scope Selection
**Depends:** Create Resistance Templates, 7-Day Assignment Grid
**Description:** When editing a template, choose propagation scope (this phase / this + all future / all phases) — changes cascade to matching `canonical_name` templates in target mesocycles.

### Template Cascade > Completed Mesocycle Protection
**Depends:** Cascade Scope Selection, Mesocycle Status Management
**Description:** Cascade never modifies templates in completed mesocycles — past programming is always preserved.

---

## Epic: Mesocycle Cloning

One-step duplication of a full mesocycle structure into a new phase. The fast path for building the next training block.

---

### Mesocycle Cloning > Clone Mesocycle
**Depends:** Exercise Slots, 7-Day Assignment Grid
**Description:** One-step create-and-clone: atomically copies all workout templates, exercise slots, and weekly schedules from a source mesocycle into a new one.

### Mesocycle Cloning > Canonical Name Preservation
**Depends:** Clone Mesocycle
**Description:** Cloned templates retain the same `canonical_name` slugs with new IDs, preserving cross-phase linking for progression queries and cascade.

---

## Epic: Daily Routines

Parallel to workout training — daily habit tracking (mobility, stretches, cold exposure) with flexible scoping and quick check-off.

---

### Daily Routines > Routine Item CRUD
**Depends:** Create Mesocycle
**Description:** Create routine items with category, custom input fields (weight, length, duration, sets, reps — multi-select), frequency target, and flexible scope (global, per-mesocycle, date-range, skip-on-deload).

### Daily Routines > Daily Routine Check-off
**Depends:** Routine Item CRUD
**Description:** View today's active routines and fill in configured input fields (= done) or explicitly skip — takes seconds. No entry = not yet logged.

### Daily Routines > Routine Streaks & Counts
**Depends:** Daily Routine Check-off
**Description:** Display weekly completion count or streak per routine item for motivation.

---

## Epic: Today's Workout

The athlete's entry point. Open the app → see what to do today. Bridges planning to logging.

---

### Today's Workout > View Today's Planned Workout
**Depends:** 7-Day Assignment Grid, Mesocycle Status Management
**Description:** Mobile-first view showing today's planned workout with all targets (exercises, sets, reps, weight, pace) from the active mesocycle's schedule.

### Today's Workout > Rest Day Display
**Depends:** View Today's Planned Workout, Daily Routine Check-off
**Description:** On rest days show "Rest Day" with today's daily routines so the app is useful every day.

### Today's Workout > Already-Logged Summary
**Depends:** View Today's Planned Workout, Pre-filled Resistance Logging
**Description:** If today's workout is already logged, show a completion summary instead of the log form to prevent re-logging.

---

## Epic: Workout Logging

Immutable records of what actually happened. Pre-filled from plan, logged in <2 minutes, frozen on save.

---

### Workout Logging > Pre-filled Resistance Logging
**Depends:** View Today's Planned Workout, Exercise Slots
**Description:** Every set pre-filled with planned weight/reps from the template — athlete only changes what differs from plan.

### Workout Logging > Actual Set Input
**Depends:** Pre-filled Resistance Logging
**Description:** Input actual reps, weight, and RPE per set so history reflects reality.

### Workout Logging > Add/Remove Sets
**Depends:** Pre-filled Resistance Logging
**Description:** Add extra sets or remove planned sets if the athlete did more or fewer than planned.

### Workout Logging > Workout Rating & Notes
**Depends:** Pre-filled Resistance Logging
**Description:** Rate workout (1–5) and add free-text notes to capture subjective feel alongside objective data.

### Workout Logging > Log Immutability
**Depends:** Pre-filled Resistance Logging
**Description:** Saved workouts are immutable — template snapshot JSON + normalized rows created atomically in one transaction, no updates after insert.

### Workout Logging > Running Logging
**Depends:** View Today's Planned Workout, Running Templates
**Description:** Log actual distance, average pace, and average HR for all run types.

### Workout Logging > Interval Logging
**Depends:** Running Logging
**Description:** For interval sessions, log actual pace and average HR per interval rep with optional per-interval notes.

### Workout Logging > Running Rating & Notes
**Depends:** Running Logging
**Description:** Rate the run (1–5) and add overall notes to capture subjective feel.

### Workout Logging > MMA/BJJ Logging
**Depends:** View Today's Planned Workout, MMA/BJJ Template Support
**Description:** Log duration, feeling, and notes for combat sessions — training load without technique detail.

---

## Epic: Calendar & Progression

Read-only analytical views over plan + log data. The coach's tools for plan validation and outcome review.

---

### Calendar & Progression > Projected Calendar
**Depends:** 7-Day Assignment Grid
**Description:** Month view showing planned workouts per day, color-coded by modality (resistance/running/MMA), derived from schedule + mesocycle dates.

### Calendar & Progression > Deload Week Distinction
**Depends:** Projected Calendar, Normal vs Deload Tabs
**Description:** Deload weeks visually distinct from work weeks on the calendar so phase structure is obvious.

### Calendar & Progression > Completed Day Markers
**Depends:** Projected Calendar, Log Immutability
**Description:** Days with logged workouts marked as completed vs still-projected — coach sees adherence at a glance.

### Calendar & Progression > Day Detail Drill-in
**Depends:** Projected Calendar
**Description:** Click any calendar day to see full workout detail (exercises, targets, logged actuals if completed) inline.

### Calendar & Progression > Exercise Progression Chart
**Depends:** Log Immutability
**Description:** Select an exercise → chart of planned vs actual weight/volume across mesocycles via `canonical_name` cross-phase linking.

### Calendar & Progression > Phase Boundary Markers
**Depends:** Exercise Progression Chart
**Description:** Mesocycle start/end boundaries marked on progression charts to show how phase transitions affected progress.
