# today/

Query module for the "today" workout lookup — resolves the active mesocycle, schedule slot, and exercise slots for a given date.

## Files
- `queries.ts` — `getTodayWorkout` (lookup chain: active meso → day_of_week → schedule → template + slots), `isDeloadWeek` (date math for deload detection); exports `TodayResult` union type (`workout | rest_day | no_active_mesocycle`)
- `queries.test.ts` — unit tests covering no active meso, rest day, workout with slots, and deload week detection
