# schedule/

Weekly schedule assignment, overrides, and time-slot utilities for mesocycle day slots.

## Files
- `actions.ts` — `assignTemplate` (assign a single template to a day/week_type slot: deletes all existing rows for that slot first — handling rotation→single conversion — then inserts with `cycle_length=1`; derives period from time_slot), `removeAssignment` (rotation-aware delete: if `cycle_length > 1` deletes all cycle positions for the slot, otherwise deletes the single row), `updateScheduleEntry` (update time_slot and/or duration on an existing entry; re-derives period), `assignRotation` (replace a slot with a rotating multi-template sequence of 2–8 contiguous `cycle_position` entries; wrapped in `db.transaction()` for atomicity); all validate mesocycle status and template ownership; revalidate `/mesocycles`; fire-and-forget Google Calendar sync via `syncScheduleChange`
- `queries.ts` — `getScheduleForMesocycle` (weekly_schedule rows joined with template names), `getTemplatesForMesocycle` (templates for picker, ordered by `display_order` then id); exports `ScheduleEntry` (id, day_of_week, template_id, template_name, period, time_slot, duration) and `TemplateOption` types
- `override-queries.ts` — `getEffectiveScheduleForDay` resolves a day's schedule by merging base `weekly_schedule` with `schedule_week_overrides`; exports `EffectiveScheduleEntry` type
- `override-actions.ts` — `moveWorkout` (move workout between days/periods via override pairs), `undoScheduleMove` (delete overrides by override_group + mesocycle), `resetWeekSchedule` (delete all overrides for a mesocycle + week); all validate mesocycle not completed; revalidate paths; fire-and-forget Google Calendar sync on affected dates
- `time-utils.ts` — `timeSlotSchema` (HH:MM Zod validator), `durationSchema` (positive int minutes), `derivePeriod()` (time → morning/afternoon/evening), `getEndTime()` (start + duration with midnight wrap), `checkOverlap()` (detect time-range collisions); exports `Period` type

## Tests
- `*.test.ts` — co-located unit tests for each module
- `__tests__/override-actions.characterize.test.ts` — characterization tests capturing pre-refactor moveWorkout behavior (T199 safety net)
- `__tests__/override-actions.test.ts` — integration tests for time-aware moveWorkout with DB fixtures
