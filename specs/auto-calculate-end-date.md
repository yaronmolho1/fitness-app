# Auto-calculate End Date
**Status:** in-progress
**Epic:** Mesocycle Lifecycle
**Depends:** specs/create-mesocycle.md

## Description
As a coach, I can see the end date auto-calculated from start date, work weeks, and deload toggle so that I don't have to do date math manually.

## Acceptance Criteria
- [ ] `end_date` is derived from `start_date`, `work_weeks`, and `has_deload` — it is never entered manually by the user
- [ ] Formula: `end_date = start_date + (work_weeks * 7) + (has_deload ? 7 : 0) - 1` days
  - A mesocycle starting on `2026-03-01` with 4 work weeks and no deload ends on `2026-03-28` (28 days total, last day inclusive)
  - A mesocycle starting on `2026-03-01` with 4 work weeks and a deload ends on `2026-04-04` (35 days total, last day inclusive)
- [ ] `end_date` is stored as a text string in `YYYY-MM-DD` format — not a timestamp
- [ ] `end_date` is computed and stored at creation time (Server Action, per ADR-004)
- [ ] `end_date` is recomputed and updated whenever `start_date`, `work_weeks`, or `has_deload` is changed on the mesocycle
- [ ] The calculated `end_date` is displayed to the user in the mesocycle creation form before submission (live preview)
- [ ] The calculated `end_date` is displayed on the mesocycle detail view
- [ ] The `end_date` field is read-only in the UI — no direct user input

## Edge Cases
- `has_deload = false` — deload week contributes 0 days; total duration = `work_weeks * 7` days
- `has_deload = true` — deload week contributes exactly 7 days; total duration = `(work_weeks + 1) * 7` days
- `work_weeks = 1`, `has_deload = false` — end date is 6 days after start date (7-day week, inclusive)
- `start_date` is a leap-year date (e.g. `2028-02-28`) — standard date arithmetic handles this correctly
- `start_date` is at a month boundary (e.g. `2026-01-28`) — end date correctly rolls into the next month
- Changing `work_weeks` after creation — `end_date` is recomputed and persisted

## Test Requirements
- Unit: formula produces correct `end_date` for `has_deload = false` (e.g. 4 weeks from `2026-03-01` → `2026-03-28`)
- Unit: formula produces correct `end_date` for `has_deload = true` (e.g. 4 work weeks + deload from `2026-03-01` → `2026-04-04`)
- Unit: formula handles month-boundary and leap-year dates correctly
- Unit: `end_date` stored as `YYYY-MM-DD` text, not a timestamp
- Integration: creating a mesocycle persists the correct `end_date` in the database
- Integration: updating `work_weeks` or `has_deload` on an existing mesocycle recomputes and persists the new `end_date`
