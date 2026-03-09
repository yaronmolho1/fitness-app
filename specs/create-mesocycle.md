# Create Mesocycle
**Status:** ready
**Epic:** Mesocycle Lifecycle
**Depends:** specs/app-shell-navigation.md

## Description
As a coach, I can define a training block with a name, start date, number of work weeks, and a deload week toggle so that I have a structured container for my training phase.

## Acceptance Criteria
- [ ] A form is accessible from the app shell to create a new mesocycle
- [ ] Form includes a `name` field (text, required)
- [ ] Form includes a `start_date` field (date picker, required)
- [ ] Form includes a `work_weeks` field (positive integer, required)
- [ ] Form includes a `has_deload` toggle (boolean, defaults to false)
- [ ] Submitting the form invokes a Server Action (per ADR-004)
- [ ] On success, a new row is inserted into the `mesocycles` table with the provided field values
- [ ] `name` is stored as text; must be non-empty after trimming whitespace
- [ ] `start_date` is stored as a text string in `YYYY-MM-DD` format (e.g. `"2026-03-15"`) — not a timestamp
- [ ] `work_weeks` must be a positive integer (≥ 1)
- [ ] `has_deload` is stored as a boolean (0/1 in SQLite)
- [ ] `status` is set to `"planned"` on creation — never any other value
- [ ] `id` is an auto-increment integer — no UUIDs
- [ ] Validation errors are returned to the form without a full page reload
- [ ] A `name` that is empty or whitespace-only is rejected with a validation error
- [ ] A `work_weeks` value of 0 or negative is rejected with a validation error
- [ ] A `work_weeks` value that is not an integer is rejected with a validation error
- [ ] A missing or invalid `start_date` is rejected with a validation error
- [ ] On success, the user is navigated to the newly created mesocycle's detail view (or the mesocycle list)
- [ ] The newly created mesocycle appears in the mesocycle list

## Edge Cases
- `name` is all whitespace — rejected, treated as empty
- `work_weeks` = 0 — rejected
- `work_weeks` is a decimal (e.g. 4.5) — rejected; must be a whole number
- `start_date` is in the past — allowed; no restriction on past start dates
- `has_deload` not explicitly set — defaults to false
- Duplicate name — allowed; no uniqueness constraint on mesocycle name
- Very large `work_weeks` (e.g. 52) — accepted; no upper bound enforced in V1

## Test Requirements
- Unit: Server Action rejects missing `name`, missing `start_date`, `work_weeks` ≤ 0, non-integer `work_weeks`
- Unit: Server Action inserts correct row with `status = "planned"`, `start_date` as `YYYY-MM-DD` text, `has_deload` defaulting to false
- Unit: `id` is auto-increment integer (not UUID)
- Integration: form submission with valid data creates a mesocycle row and returns success
- Integration: form submission with invalid data returns field-level errors without inserting a row
