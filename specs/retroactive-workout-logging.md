# Retroactive Workout Logging

**Status:** ready
**Epic:** Workout Logging
**Depends:** specs/view-todays-planned-workout.md, specs/already-logged-summary.md, specs/day-detail-drill-in.md, specs/projected-calendar.md, specs/pre-filled-resistance-logging.md, specs/running-logging.md, specs/mma-bjj-logging.md, specs/completed-day-markers.md

## Description

Allow users to log workouts for past dates via the calendar. Currently only today's workout can be logged (Today API hardcoded to current date, calendar day detail is read-only). The backend already accepts arbitrary `logDate` values — this feature threads a `date` query parameter through the Today view's UI and API to unlock retroactive logging from the calendar's DayDetailPanel.

## Acceptance Criteria

### 1. Calendar Entry Point (DayDetailPanel)

1. **Given** a DayDetailPanel is open for a projected workout where the date ≤ today, **When** the user views the workout card, **Then** a "Log Workout" action button is shown on the card.

2. **Given** the "Log Workout" button is visible on a projected workout card for date `D`, **When** the user taps it, **Then** the app navigates to `/?date=D` (YYYY-MM-DD format).

3. **Given** a DayDetailPanel is open for a projected workout where the date is strictly after today, **When** the user views the workout card, **Then** no "Log Workout" action is shown.

4. **Given** a DayDetailPanel is open for a completed (already logged) workout, **When** the user views the workout card, **Then** no "Log Workout" action is shown.

5. **Given** a DayDetailPanel is open for a rest day, **When** the user views the panel, **Then** no "Log Workout" action is shown.

6. **Given** a multi-session day (e.g. morning + evening) where one session is logged and one is projected, **When** the user views the panel, **Then** only the unlogged projected card shows the "Log Workout" action.

### 2. Today View Date Parameter

7. **Given** the user navigates to `/?date=2026-03-20`, **When** the page renders, **Then** the TodayWorkout component fetches `/api/today?date=2026-03-20`.

8. **Given** a `GET /api/today?date=2026-03-20` request where 2026-03-20 is a valid past date, **When** the route handler executes, **Then** it returns the scheduled workout data for that date (same structure as today's response).

9. **Given** a `GET /api/today` request with no `date` param, **When** the route handler executes, **Then** it returns today's workout data (current behavior preserved).

10. **Given** a `GET /api/today?date=invalid` request with a malformed date, **When** the route handler executes, **Then** it returns HTTP 400.

11. **Given** a `GET /api/today?date=2027-01-01` request where the date is in the future, **When** the route handler executes, **Then** it returns HTTP 400.

### 3. Retroactive Date Banner

12. **Given** the user navigates to `/?date=2026-03-20` and today is 2026-03-25, **When** the Today view renders, **Then** a colored banner is shown reading "Logging for 20/Mar/2026" with a "Back to Calendar" link.

13. **Given** the user navigates to `/` with no date param, **When** the Today view renders, **Then** no retroactive banner is shown (current behavior preserved).

14. **Given** the user navigates to `/?date=D` where D equals today's date, **When** the Today view renders, **Then** no retroactive banner is shown (treated as normal today flow).

### 4. Logging Forms Use Date Parameter

15. **Given** the Today view is loaded with `?date=2026-03-20` and the API returns a scheduled workout, **When** the logging form renders, **Then** all form types (resistance, running, MMA, mixed) submit with `logDate = '2026-03-20'`.

16. **Given** a past date with a scheduled resistance workout in week 3 of the mesocycle, **When** the logging form renders, **Then** exercise targets reflect week 3's progression overrides (not the current week's).

### 5. Post-Save Behavior

17. **Given** the user saves a retroactive workout for date `D` in month `M`, **When** the save succeeds, **Then** a toast notification is shown ("Workout logged for dd/Mon") and the app navigates to `/calendar?month=M`.

18. **Given** the user saves today's workout via the normal Today flow (no date param), **When** the save succeeds, **Then** the existing inline confirmation is shown with no redirect (current behavior preserved).

19. **Given** a retroactive workout was saved for a previously projected date, **When** the user returns to the calendar, **Then** the day cell shows the completed marker (checkmark) instead of projected.

### 6. Guardrails

20. **Given** a past date that falls outside any active mesocycle's date range, **When** the API is called, **Then** it returns `no_active_mesocycle` and no logging form renders.

21. **Given** a past date that is a rest day in the active mesocycle, **When** the API is called, **Then** it returns `rest_day` and no logging form renders.

22. **Given** a workout already logged for date `D` on the active mesocycle, **When** the user navigates to `/?date=D`, **Then** the already-logged summary is shown instead of the logging form.

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| E1 | Past date outside any mesocycle range | API returns `no_active_mesocycle`; "No active training phase" message |
| E2 | Past date is a rest day | API returns `rest_day`; rest day display, no log button |
| E3 | Past date already logged | API returns `already_logged`; summary shown, no form |
| E4 | Past date in deload week | `isDeloadWeek` resolves correctly; deload badge shown on form |
| E5 | Past date with progression overrides | `getWeekNumber` + `fetchOverrideMap` resolve correct week targets |
| E6 | Future date typed manually in URL bar | API returns 400 |
| E7 | Invalid date format in URL | API returns 400 |
| E8 | Empty date param (`/?date=`) | Treated as no param; defaults to today |
| E9 | Multi-session day (AM + PM) | Both sessions render; each logged independently |
| E10 | Template modified after the target date | Logging form shows current live template (snapshot frozen at save time per existing design) |
| E11 | Date param equals today | Normal today flow; no banner |
| E12 | Today's projected workout via calendar | "Log Workout" button shown (today is a valid date) |
| E13 | Mesocycle deactivated/completed since target date | `getTodayWorkout` returns `no_active_mesocycle`; retroactive logging requires active meso |
| E14 | Multi-session day: log one, try saving another | **Pre-existing limitation**: `hasExistingLog` checks `log_date + mesocycle_id` (not per-template), so saving a second session for the same date is blocked. The query layer (`getTodayWorkout`) correctly checks per-template, so the UI shows the second session as available but save fails. Separate fix recommended. |

## Test Requirements

- AC1–6 (calendar entry): Unit — action button visibility logic based on day type + date comparison
- AC7–9 (API param): Unit — date parsing, validation, fallback to today
- AC10–11 (API validation): Unit — 400 response for invalid/future dates
- AC12–14 (banner): Unit — banner render logic based on date comparison
- AC15–16 (form date): Integration — full retroactive fetch returns correct workout data with week-specific overrides
- AC17–18 (post-save): Integration — save with past logDate succeeds; redirect behavior differs for retroactive vs today
- AC19 (calendar update): E2E — log retroactive workout, verify calendar day transitions from projected to completed
- AC20–22 (guardrails): Integration — boundary validation for meso range, rest days, duplicates
- E14 (multi-session bug): Integration — document as known limitation with test that verifies current behavior

## Dependencies

- `specs/view-todays-planned-workout.md` — extends Today page to accept date param; lookup chain reused unchanged
- `specs/already-logged-summary.md` — already-logged detection works for any date, no changes needed
- `specs/day-detail-drill-in.md` — DayDetailPanel is the entry point; adds action affordance to projected cards
- `specs/projected-calendar.md` — calendar status transitions from projected → completed after save
- `specs/pre-filled-resistance-logging.md` — resistance form reused as-is
- `specs/running-logging.md` — running form reused as-is
- `specs/mma-bjj-logging.md` — MMA form reused as-is
- `specs/completed-day-markers.md` — checkmark rendering updates via revalidation

## Out of Scope

- **Schedule overrides ("Move Workout")** — separate spec; action sheet design reserves a slot for it
- **Retroactive logging for completed mesocycles** — requires active meso; separate consideration
- **Draft persistence** — form state lost on navigation; same as today (no draft storage)
- **Bulk retroactive logging** — one-at-a-time only; future enhancement
- **Routine check-off for past dates** — not in scope
- **`hasExistingLog` per-template fix** — pre-existing bug (E14); separate ticket

## Open Questions

- Should the action sheet pattern (used here for "Log Workout") be extracted as a shared component, anticipating the "Move Workout" feature? Or keep it simple with a standalone button for now?
