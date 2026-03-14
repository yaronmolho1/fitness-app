# schedule/

Server Actions for the `weekly_schedule` table — assign and remove workout templates on mesocycle day slots.

## Files
- `actions.ts` — `assignTemplate` (upsert a template onto a day/week_type slot), `removeAssignment` (idempotent delete); validates mesocycle status and template ownership; revalidates `/mesocycles`
- `actions.test.ts` — unit tests for both actions covering validation errors, ownership checks, completed-mesocycle guard, upsert behaviour, and idempotent removal
