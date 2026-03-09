# Routine Item CRUD
**Status:** ready
**Epic:** Daily Routines
**Depends:** specs/create-mesocycle.md

## Description
As a coach, I can create, read, update, and delete routine items with a custom set of input fields, frequency target, and flexible scope, so each routine tracks exactly the data I care about and appears only when relevant.

## Acceptance Criteria

### Create
- [ ] Coach can create a routine item with the following fields:
  - `name` (required, non-empty string)
  - `category` (optional; free-text label e.g. mobility, recovery, measurement, conditioning)
  - `input_fields` (required; multi-select, at least 1 chosen from: `weight`, `length`, `duration`, `sets`, `reps`)
  - `frequency_target` (required; positive integer — target completions per week)
  - `scope_type` (required; one of: `global`, `per_mesocycle`, `date_range`, `skip_on_deload`)
- [ ] At least one input field must be selected; submitting with zero selected shows a validation error
- [ ] Multiple input fields can be selected per item (e.g. "Shoulder Mobility" = duration + sets + reps)
- [ ] Input field semantics:
  - `weight` — numeric (kg), for body weight or load tracking
  - `length` — numeric (cm), for body measurements (waist, arms, etc.)
  - `duration` — numeric (minutes), for timed activities
  - `sets` — integer count
  - `reps` — integer count
- [ ] When `scope_type = global`: no additional scope fields required; item is always active
- [ ] When `scope_type = per_mesocycle`: a `mesocycle_id` FK is required; item is active only during that mesocycle's date range
- [ ] When `scope_type = date_range`: `start_date` and `end_date` (calendar date strings `YYYY-MM-DD`) are required; item is active only within that inclusive range
- [ ] When `scope_type = skip_on_deload`: no additional scope fields; item is active at all times except during deload weeks (per ADR-003)
- [ ] Submitting with missing required fields shows a validation error per field; item is not created
- [ ] `date_range` scope: `end_date` must be on or after `start_date`; validation error if not
- [ ] `per_mesocycle` scope: `mesocycle_id` must reference an existing mesocycle; error if not found
- [ ] Created item appears in the routine items list immediately after save

### Read
- [ ] All routine items are listed, showing name, category, input fields summary (e.g. "duration, sets, reps"), frequency target, and scope summary
- [ ] Scope summary is human-readable (e.g. "Global", "Mesocycle: Hypertrophy Block 1", "Mar 1 – Apr 30", "Skip on deload")
- [ ] List is accessible from the coach planning UI (not mobile-only)

### Update
- [ ] Coach can edit any field of an existing routine item, including adding/removing input fields
- [ ] Changing `scope_type` clears previously set scope-specific fields (e.g. switching from `per_mesocycle` to `global` removes the mesocycle FK)
- [ ] Changing input fields does not affect existing `routine_logs` records — logs retain whatever values were recorded at the time (immutable per architecture)
- [ ] Same validation rules apply on update as on create
- [ ] Updated item reflects changes immediately in the list

### Delete
- [ ] Coach can delete a routine item
- [ ] Deleting a routine item does not delete associated `routine_logs` records (historical data preserved)
- [ ] Deleted item no longer appears in the routine items list or in the daily check-off view

### General
- [ ] The routines module is domain-isolated: routine item CRUD does not directly join or mutate tables outside the Routines domain (per ADR-008)
- [ ] All mutations via Server Actions (per ADR-004)

## Edge Cases
- Creating a `date_range` item where `start_date = end_date` is valid (single-day scope)
- Creating a `per_mesocycle` item for a completed mesocycle is allowed (historical scoping)
- Deleting a mesocycle that has `per_mesocycle`-scoped routine items: behavior defined at implementation (cascade delete or orphan — document the choice)
- `frequency_target = 0` is invalid; must be >= 1
- Very long `name` strings: UI must not break layout; enforce a reasonable max length
- `skip_on_deload` items on a mesocycle with `has_deload = false`: item is always active (no deload weeks exist to skip)
- Removing an input field (e.g. removing `sets` from an item) after logs exist with `sets` data: old logs keep their data; future check-offs no longer show that field
- Selecting all 5 input fields is valid but unusual

## Test Requirements
- Unit: validate at least 1 input field selected
- Unit: validate scope-type field requirements (global needs no extras, per_mesocycle needs mesocycle_id, date_range needs start+end, skip_on_deload needs no extras)
- Unit: validate `end_date >= start_date` for date_range scope
- Unit: validate `frequency_target >= 1`
- Integration: create item with multiple input fields (e.g. duration + sets + reps) → verify all fields persisted
- Integration: update item to add/remove input fields → verify change persisted, existing logs unaffected
- Integration: update scope_type from `per_mesocycle` to `global` → verify mesocycle_id is cleared
- Integration: delete item → verify item gone from list, `routine_logs` for that item still exist
- Integration: create with invalid `mesocycle_id` → verify error returned, no row inserted
