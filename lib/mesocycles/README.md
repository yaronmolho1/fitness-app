# mesocycles/

Mesocycle lifecycle management — creation, status transitions, date calculation.

## Files
- `actions.ts` — `createMesocycle()` from FormData, `activateMesocycle()` with one-active constraint, `completeMesocycle()` status gate
- `utils.ts` — `calculateEndDate()` computes end date from start + work weeks + optional deload week
