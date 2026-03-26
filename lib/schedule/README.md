# schedule/

Server Actions for the `weekly_schedule` table — assign and remove workout templates on mesocycle day slots.

## Files
- `actions.ts` — `assignTemplate` (upsert a template onto a day/week_type/period slot), `removeAssignment` (idempotent delete by day/week_type/period); validates mesocycle status and template ownership; revalidates `/mesocycles`
- `actions.test.ts` — unit tests for both actions covering validation errors, ownership checks, completed-mesocycle guard, upsert behaviour, and idempotent removal
- `queries.ts` — `getScheduleForMesocycle` (weekly_schedule rows joined with template names), `getTemplatesForMesocycle` (templates for picker); exports `ScheduleEntry` and `TemplateOption` types
- `queries.test.ts` — unit tests for both queries covering empty results, joined data, and week_type filtering
- `override-queries.ts` — `getEffectiveScheduleForDay` resolves a day's schedule by merging base `weekly_schedule` with `schedule_week_overrides`; exports `EffectiveScheduleEntry` type
