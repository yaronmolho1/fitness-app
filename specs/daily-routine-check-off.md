# Daily Routine Check-off
**Status:** in-progress
**Epic:** Daily Routines
**Depends:** specs/routine-item-crud.md

## Description
As an athlete, I can see today's active routines and quickly fill in values or skip each one, so tracking takes seconds.

## Acceptance Criteria

### Active Routine Filtering (which routines appear today)
- [ ] Only routine items whose scope makes them active for today's date are shown
- [ ] `global` scope items are always shown
- [ ] `per_mesocycle` scope items are shown only when the referenced mesocycle is the currently active mesocycle (status = `active`) and today falls within that mesocycle's date range
- [ ] `date_range` scope items are shown only when today's date falls within `start_date` and `end_date` (inclusive)
- [ ] `skip_on_deload` scope items are shown on all days except during deload weeks; deload week detection uses the same logic as ADR-003 (week offset from mesocycle start; last week of a mesocycle with `has_deload = true`)
- [ ] `skip_on_deload` items are shown normally when there is no active mesocycle (no deload context to skip)
- [ ] If no routine items are active today, the section shows an empty state (not an error)

### Input Fields per Item
- [ ] Each routine item displays only the input fields it was configured with (from its `input_fields` selection)
- [ ] Available field types and their inputs:
  - `weight` — numeric input (kg)
  - `length` — numeric input (cm)
  - `duration` — numeric input (minutes)
  - `sets` — integer input
  - `reps` — integer input
- [ ] Items with multiple fields show all configured fields inline (e.g. duration + sets + reps = 3 input fields)
- [ ] Field labels are visible so the athlete knows what each input is for

### Completion Model
- [ ] **Filling any field = done**: entering a value in any one of the item's input fields and submitting marks it as `done`
- [ ] Not all fields need to be filled — entering any subset counts as done (e.g. sets filled but reps left empty = done)
- [ ] **Explicit Skip**: a separate "Skip" button marks the item as `skipped` without entering values
- [ ] **No entry**: items with no interaction remain unlogged (no `routine_logs` row) — not the same as skipped
- [ ] Submitting values creates a `routine_logs` row with `status = 'done'` and the individual field values
- [ ] Skipping creates a `routine_logs` row with `status = 'skipped'` and all field values null
- [ ] A routine item can only be logged once per calendar day; attempting to log a second time for the same item+date is blocked

### Immutability
- [ ] `routine_logs` rows are immutable after insert — no edit or delete action is exposed in the UI
- [ ] No UPDATE or DELETE operations are issued against `routine_logs` at the application layer (per architecture immutability rule)

### Display
- [ ] The check-off view is optimized for mobile use (large tap targets, minimal scrolling)
- [ ] Items are grouped or ordered consistently (e.g. by category, then name) — exact ordering defined at implementation
- [ ] Already-logged items for today are visually distinct from pending items
- [ ] Logged items show their recorded values (e.g. "72.5 kg", "3 sets, 10 reps")
- [ ] Skipped items show "Skipped" status clearly

## Edge Cases
- No active mesocycle: `per_mesocycle` items are not shown; `skip_on_deload` items are shown (no deload to skip)
- Active mesocycle with `has_deload = false`: `skip_on_deload` items are always shown
- Athlete opens the check-off view at midnight (date boundary): items are filtered for the new calendar date
- Numeric value of `0` is valid for any field (e.g. 0 kg is a valid weight entry and counts as done)
- Negative numeric values are invalid; validation error shown
- Non-integer value for sets or reps: validation error (these are integer fields)
- Item with only 1 input field (e.g. weight only): single input + submit, minimal friction
- Item with all 5 input fields: all 5 inputs shown; filling any 1 = done
- `per_mesocycle` item whose mesocycle transitions to `completed` mid-day: item is no longer active

## Test Requirements
- Unit: scope filtering logic for each scope type given various dates and mesocycle states
- Unit: deload week detection — item with `skip_on_deload` is excluded during deload week
- Unit: `skip_on_deload` item shown when no active mesocycle exists
- Unit: completion logic — filling any single field marks as done
- Unit: completion logic — submitting with all fields empty is rejected (must fill at least 1 or explicitly skip)
- Integration: fill weight field only on a 3-field item → verify `routine_logs` row created with `status = 'done'`, weight value set, other values null
- Integration: skip item → verify `routine_logs` row created with `status = 'skipped'`, all values null
- Integration: attempt to log same item twice on same date → verify second attempt is rejected
- Integration: verify no UPDATE/DELETE issued on `routine_logs` table
- E2E (mobile viewport): fill in a value and submit → item shows as completed with recorded value
