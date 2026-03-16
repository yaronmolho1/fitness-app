# calendar/

GET `/api/calendar?month=YYYY-MM` — returns projected and completed workout days for a month.

## Files
- `route.ts` — validates `month` param (YYYY-MM format), delegates to `getCalendarProjection`
- `route.test.ts` — unit tests for the calendar route handler

## Subdirectories
- `day/` — GET `/api/calendar/day?date=YYYY-MM-DD` — returns rest/projected/completed detail for a single day via `getDayDetail`
