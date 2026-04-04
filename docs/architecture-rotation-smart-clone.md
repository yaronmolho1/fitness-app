# Architecture: Per-Week Template Rotation + Smart Clone

> Addendum to [architecture.md](architecture.md). Covers schema changes, resolution logic, and affected code paths for per-week template rotation on schedule slots and smart clone with latest-value inheritance.

## System Overview

Extends the existing schedule system to support N-week repeating template cycles per schedule slot. A single slot (e.g., Monday 07:00) can rotate through different running templates across weeks (VO2 max → Threshold → VO2 max → Tempo). Resolution is deterministic: `active_position = ((week_number - 1) % cycle_length) + 1`. Existing `schedule_week_overrides` layer on top — override always wins.

Additionally, mesocycle cloning is enhanced to carry forward the last work week's effective values as new base values, preventing progression regression.

See [ADR-012](adrs/012-per-week-template-rotation.md) for the decision rationale.

## Data Model

### Modified table: `weekly_schedule`

Two new columns, both with defaults for backward compatibility:

```
cycle_length    INTEGER NOT NULL DEFAULT 1    -- 1 = no rotation
cycle_position  INTEGER NOT NULL DEFAULT 1    -- 1-based position within cycle
```

Unique index changes:

```
-- OLD
UNIQUE(mesocycle_id, day_of_week, week_type, time_slot, template_id)

-- NEW
UNIQUE(mesocycle_id, day_of_week, week_type, time_slot, cycle_position)
```

Example — 4-week rotation on Monday 07:00 (normal weeks):

```
id | mesocycle_id | day_of_week | week_type | time_slot | template_id | cycle_length | cycle_position
---|-------------|-------------|-----------|-----------|-------------|-------------|---------------
10 | 1           | 0           | normal    | 07:00     | 5 (VO2 max) | 4           | 1
11 | 1           | 0           | normal    | 07:00     | 6 (Thresh)  | 4           | 2
12 | 1           | 0           | normal    | 07:00     | 5 (VO2 max) | 4           | 3
13 | 1           | 0           | normal    | 07:00     | 7 (Tempo)   | 4           | 4
```

Week 7 of the mesocycle → `((7-1) % 4) + 1 = 3` → row 12 → VO2 max.

### Unchanged tables
- `schedule_week_overrides` — matches by `time_slot`, overrides rotation-resolved template
- `slot_week_overrides` — per-week exercise slot progression, unchanged
- `template_week_overrides` — per-week template-level progression, unchanged

### ER changes

```
weekly_schedule (updated)
  + cycle_length: integer (default 1)
  + cycle_position: integer (default 1)
  
  UNIQUE(mesocycle_id, day_of_week, week_type, time_slot, cycle_position)
```

No new tables. No new relationships.

## Resolution Logic

### `getEffectiveScheduleForDay()` — `lib/schedule/override-queries.ts`

Current flow: fetch base rows → fetch overrides → merge by time_slot → sort.

New flow inserts one step after fetching base rows:

```
1. Fetch ALL base rows for (mesocycle, day_of_week, week_type)
2. NEW: Group by time_slot. For each group:
   - If cycle_length > 1: compute active_position = ((weekNumber - 1) % cycle_length) + 1
   - Keep only the row matching active_position
   - If cycle_length = 1: keep as-is (backward compat)
3. Fetch overrides for (mesocycle, week_number, day_of_week)
4. Merge by time_slot (override wins) — unchanged
5. Sort by time_slot — unchanged
```

The function signature stays the same — it already receives `weekNumber`.

The `EffectiveScheduleEntry` type adds optional fields:

```ts
export type EffectiveScheduleEntry = {
  // ... existing fields ...
  cycle_length?: number    // 1 if no rotation
  cycle_position?: number  // which position was resolved
}
```

### `getCalendarProjection()` — `lib/calendar/queries.ts`

Current flow: batch-loads all schedule rows into a Map keyed by `${day_of_week}-${week_type}`, then iterates dates.

Change: when iterating dates, after looking up base entries from the map, apply the same cycle filtering:

```
for each date:
  weekNumber = computeWeekNumber(meso.start_date, date)
  baseEntries = scheduleLookup.get(`${dow}-${weekType}`)
  
  NEW: filteredEntries = filterByCyclePosition(baseEntries, weekNumber)
  
  merge with overrides (unchanged)
```

### `getTodayWorkout()` — `lib/today/queries.ts`

No direct changes — it calls `getEffectiveScheduleForDay()` which handles rotation. The returned entries already have the correct template_id for the current week.

### Google Calendar sync — `lib/google/sync.ts`

No changes — `syncMesocycle` iterates dates and calls `getEffectiveScheduleForDay()` per day. Once that function is cycle-aware, sync automatically resolves the correct template.

## API Boundaries

### New Server Actions

| Action | Location | Responsibility |
|--------|----------|---------------|
| `assignRotation` | `lib/schedule/actions.ts` | Atomically insert/replace N rows for a cycle on a given (day, time_slot, week_type). Validates: all rows share same cycle_length, positions are contiguous 1..N, all template_ids exist in the mesocycle. Deletes existing rows for the same (mesocycle, day, week_type, time_slot) first. |

### Modified Server Actions

| Action | Change |
|--------|--------|
| `assignTemplate` | Add `cycle_length=1, cycle_position=1` to insert values (backward compat, no signature change) |
| `removeAssignment` | When removing a row that's part of a rotation (cycle_length > 1), remove ALL rows in the same slot group (same mesocycle, day, week_type, time_slot) |
| `cloneMesocycle` | (1) Copy `cycle_length` + `cycle_position` in schedule clone loop. (2) For each exercise slot, query `slot_week_overrides` at `week_number = source.work_weeks`, merge with base via `mergeSlotWithOverride()`, use merged values as new slot base. Same pattern for template-level overrides. |

### New Query

| Query | Location | Responsibility |
|-------|----------|---------------|
| `getActiveWeeksForTemplate` | `lib/schedule/queries.ts` | Given a template_id and mesocycle, compute which mesocycle week numbers the template appears in. Considers: rotation cycle positions, schedule_week_overrides. Returns `number[]` of active week numbers. |

### Modified Route Handlers

| Route | Change |
|-------|--------|
| `GET /api/today` | None — calls `getTodayWorkout()` which calls cycle-aware `getEffectiveScheduleForDay()` |
| `GET /api/calendar` | None — calls cycle-aware `getCalendarProjection()` |

## Component Changes

### `WeekProgressionGrid` — `components/week-progression-grid.tsx`

New optional prop: `activeWeeks?: number[]`. When provided, `initWeeks()` filters to only generate rows for weeks in the array. Week numbers remain actual mesocycle weeks (not renumbered). When absent, generates all weeks (backward compat).

### `TemplateWeekGrid` — `components/template-week-grid.tsx`

Same `activeWeeks` prop pattern as above.

### `ScheduleGrid` — `components/schedule-grid.tsx`

For slots with `cycle_length > 1`, show a rotation indicator (e.g., "4-week cycle" badge). Entry point for the rotation assignment UI — clicking the slot opens a modal that allows defining or editing the rotation cycle.

## Smart Clone: Effective Value Inheritance

### Current clone flow (exercise slots)

```
source slot → copy base values → insert as new slot
```

### New clone flow

```
source slot
  → query slot_week_overrides WHERE week_number = source.work_weeks
  → mergeSlotWithOverride(base_slot, override)  // existing function
  → use merged values as new slot base
  → insert new slot (no week overrides — starts fresh)
```

### Fields affected

| Override table | Fields inherited |
|---------------|-----------------|
| `slot_week_overrides` | weight, reps, sets, rpe, distance, duration, pace |
| `template_week_overrides` | distance, duration, pace, interval_count, interval_rest, planned_duration |

For template-level fields (running/MMA): query `template_week_overrides` at `week_number = source.work_weeks`, merge non-null values into the new template's base fields.

### Rotation preservation on clone

The schedule clone loop already iterates all `weekly_schedule` rows. Adding `cycle_length` and `cycle_position` to the cloned values preserves the rotation structure. The `templateIdMap` correctly remaps `template_id` for each rotation position.

## Migration Strategy

### Step 1: Schema migration (backward-compatible)

```sql
ALTER TABLE weekly_schedule ADD COLUMN cycle_length INTEGER NOT NULL DEFAULT 1;
ALTER TABLE weekly_schedule ADD COLUMN cycle_position INTEGER NOT NULL DEFAULT 1;

-- Drop old index, create new
DROP INDEX IF EXISTS weekly_schedule_meso_day_type_timeslot_template_idx;
CREATE UNIQUE INDEX weekly_schedule_meso_day_type_timeslot_position_idx
  ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, cycle_position);
```

All existing rows get `cycle_length=1, cycle_position=1` — zero behavior change.

### Step 2: Resolution logic (behavior-neutral for cycle_length=1)

Update `getEffectiveScheduleForDay()` and `getCalendarProjection()` with cycle filtering. For `cycle_length=1`, the filter is a no-op — existing behavior preserved.

### Step 3: Actions + UI (new capability)

Add `assignRotation` action, modify `removeAssignment`, add rotation UI to schedule grid.

### Step 4: Smart clone (independent of rotation)

Modify `cloneMesocycle` to inherit latest values and copy cycle fields. Can ship independently.

### Step 5: Plan-weeks filtering

Add `getActiveWeeksForTemplate` query, pass `activeWeeks` to grid components.

## Key Tradeoffs

| Optimized For | Sacrificed |
|---------------|-----------|
| Read-path simplicity (single filter step) | Write-path complexity (denormalized `cycle_length` across rows) |
| Zero-migration backward compat (DEFAULT values) | Schema purity (cycle_length duplicated per row) |
| Existing override system unchanged | Cannot override rotation pattern mid-mesocycle (must use schedule_week_overrides per-week) |
| Running-only V1 scope | Resistance/MMA rotation deferred |

## Open Questions

None — all resolved during PRD discovery.
