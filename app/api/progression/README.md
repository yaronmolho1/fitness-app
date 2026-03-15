# progression/

GET route handler for exercise progression data. Returns planned vs actual weight/volume time series.

## Files
- `route.ts` — `GET /api/progression?canonical_name=...&exercise_id=...`: validates params, delegates to `getProgressionData()`, returns JSON
