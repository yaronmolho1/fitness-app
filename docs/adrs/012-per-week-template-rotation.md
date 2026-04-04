# ADR-012: Per-Week Template Rotation on Schedule Slots

## Status
Proposed

## Context
Running training uses block periodization — different workout types (VO2 max, threshold, tempo) rotate across weeks. The current `weekly_schedule` assigns one template per slot and repeats it every week. Athletes must either flatten distinct run types into a single generic template (losing identity) or abuse `schedule_week_overrides` to manually swap each week.

Additionally, cloning a mesocycle resets base template values to originals rather than carrying forward the latest progression (e.g., distance that progressed from 7km to 14km resets to 7km on clone).

## Options Considered

### Option A — Add cycle columns to `weekly_schedule`
Add `cycle_length INTEGER NOT NULL DEFAULT 1` and `cycle_position INTEGER NOT NULL DEFAULT 1` directly to the existing table. A non-rotating slot has `cycle_length=1, cycle_position=1` (zero migration risk — DEFAULT handles all existing rows). A 4-week rotation produces 4 rows sharing the same `(day_of_week, time_slot)` but with positions 1-4.

Unique index changes from `(mesocycle_id, day_of_week, week_type, time_slot, template_id)` to `(mesocycle_id, day_of_week, week_type, time_slot, cycle_position)`.

Resolution: `active_position = ((week_number - 1) % cycle_length) + 1`.

- (+) Zero migration risk — existing rows get defaults
- (+) Resolution is a single filter step in `getEffectiveScheduleForDay` (already receives `weekNumber`)
- (+) Calendar projection, GCal sync, clone all work with minimal changes — they already iterate schedule rows
- (+) Existing `schedule_week_overrides` override by `time_slot` — override wins over rotation automatically
- (−) `cycle_length` is denormalized across rows sharing the same slot — must be kept in sync
- (−) Unique index no longer includes `template_id` — same template at two positions is allowed but two positions with same number is blocked

### Option B — New `schedule_rotation` table
Create a separate `schedule_rotation` table with `(schedule_entry_id, cycle_position, template_id)`. The `weekly_schedule` entry becomes a "slot" and the rotation table holds per-position assignments.

- (+) Fully normalized — cycle_length is implicit from row count, no denormalization
- (+) Clean separation of rotation from base schedule
- (−) Every schedule query needs a JOIN — `getEffectiveScheduleForDay`, calendar projection, today queries, GCal sync all need changes
- (−) Clone logic needs to map both schedule IDs and rotation IDs
- (−) More migration complexity — need to create the table and seed it for existing entries

### Option C — JSON array column on `weekly_schedule`
Store `rotation JSON` as `text({ mode: 'json' }).$type<{position: number, template_id: number}[]>()` on each schedule row.

- (+) Single row per slot regardless of cycle length
- (+) No unique index change needed
- (−) Cannot query rotation positions with SQL — must parse JSON in application
- (−) Breaks the relational model — template_id FK becomes meaningless for rotated slots
- (−) JSON columns are harder to validate and migrate

## Decision
**Option A** — add `cycle_length` and `cycle_position` columns to `weekly_schedule`.

The denormalization trade-off (cycle_length repeated across rows) is acceptable because: (1) the write path is controlled by a single `assignRotation` action that sets all rows atomically, (2) reads outnumber writes significantly, and (3) the alternative JOIN adds complexity to every read path for a feature that most slots won't use.

## Consequences

### Schema
- Add `cycle_length INTEGER NOT NULL DEFAULT 1` and `cycle_position INTEGER NOT NULL DEFAULT 1` to `weekly_schedule`
- Drop old unique index, create new: `(mesocycle_id, day_of_week, week_type, time_slot, cycle_position)`
- Migration is backward-compatible — all existing rows get defaults

### Resolution logic
- `getEffectiveScheduleForDay()` adds one filter step: compute `active_position`, keep only matching rows from baseRows
- Calendar projection adds same filter in its iteration loop
- GCal sync is unchanged — it calls `getEffectiveScheduleForDay` which handles rotation

### Schedule actions
- New `assignRotation()` action: atomically inserts N rows for a cycle
- `removeAssignment()`: if removing a rotation entry, remove all positions in the same slot group
- `assignTemplate()`: unchanged for non-rotating slots (cycle_length=1, cycle_position=1)

### Clone
- Copy `cycle_length` and `cycle_position` when cloning schedule rows
- For "smart clone": query `slot_week_overrides` at `week_number = source.work_weeks`, merge with base via `mergeSlotWithOverride()`, use merged values as new slot base

### Plan-weeks filtering
- New query `getActiveWeeksForTemplate()`: compute which mesocycle weeks a template appears in based on rotation + overrides
- `WeekProgressionGrid` and `TemplateWeekGrid` accept `activeWeeks` prop to filter their week rows
