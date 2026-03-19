# schedule/

Schedule assignment UI — period selection and time slot picking for weekly schedule entries.

## Files
- `period-selector.tsx` — `PeriodSelector` three-button toggle for morning/afternoon/evening period, optional time picker that auto-derives period; exports `derivePeriodFromTime` utility and `Period` type
- `period-selector.test.tsx` — 15 tests: `derivePeriodFromTime` boundary values, period button toggling, time picker show/hide/clear, auto-derivation on time input
