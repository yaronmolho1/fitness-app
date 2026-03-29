# Workout Time Slots
**Status:** superseded
**Superseded by:** specs/time-based-scheduling.md, specs/schedule-time-display.md, specs/time-scheduling-migration.md
**Epic:** Schedule & Calendar
**Depends:** specs/7-day-assignment-grid.md, specs/projected-calendar.md

## Description
As a coach, I can assign a time period (morning/afternoon/evening) and optional clock time to scheduled workouts, enabling multiple sessions per day and future Google Calendar integration.

## Acceptance Criteria

### Schema changes
- [ ] `weekly_schedule` gains two new columns: `period` (text, NOT NULL, enum: 'morning' | 'afternoon' | 'evening') and `time_slot` (text, nullable, format "HH:MM")
- [ ] The old unique constraint on `(mesocycle_id, day_of_week, variant)` is replaced with `(mesocycle_id, day_of_week, variant, period)` to allow multiple entries per day
- [ ] Migration is generated via `drizzle-kit generate` (never `push`)
- [ ] Clone mesocycle copies `period` and `time_slot` values for all schedule entries

### Period selector UI
- [ ] When assigning a template to a schedule day, a period pill selector is shown with three options: Morning, Afternoon, Evening
- [ ] Period is required — one must be selected before saving the assignment
- [ ] Default selection is Morning for first workout, Evening for second workout on same day
- [ ] Pills use a toggle-group pattern (one active at a time, visually distinct)

### Optional time picker
- [ ] Below the period selector, a "Set time" toggle/link reveals an optional clock time picker
- [ ] Time picker is mobile-friendly (scroll wheels or similar, not a raw text input)
- [ ] When a clock time is entered, the period auto-derives: before 12:00 → morning, 12:00–16:59 → afternoon, 17:00+ → evening
- [ ] User can still manually override the period after auto-derivation
- [ ] Clearing the time reverts to manual period selection (keeps current period)
- [ ] Time picker supports 24h and 12h format based on locale

### Multiple workouts per day
- [ ] A single day can have N scheduled entries (not limited to 2)
- [ ] Each entry has its own template, period, and optional time
- [ ] Two entries on the same day cannot have the same period (unique constraint prevents morning + morning)
- [ ] Schedule grid UI shows multiple entries stacked within a day cell, ordered by period (morning → afternoon → evening)

### Calendar integration
- [ ] Calendar month grid shows multiple workouts per day as stacked pills/badges with period labels
- [x] Today's workout page shows all scheduled sessions for the day, grouped by period
- [x] Period label (e.g., "Morning", "6:30 AM") appears above each workout section on the Today page

### API changes
- [x] `GET /api/today` returns an array of workouts (not a single object) when multiple sessions exist
- [ ] `GET /api/calendar` includes period and time_slot in projected day data
- [ ] Schedule assignment SA accepts period (required) and time_slot (optional)

## Edge Cases
- Assigning two workouts to the same day with the same period → validation error, suggest changing period
- Clock time "12:00" → maps to afternoon (not morning)
- Schedule with only time_slot and no period → impossible (period is required, auto-derived if time given)
- Deload week: separate schedule can also have multiple entries per day

## Test Requirements
- Schema migration creates columns with correct types and constraints
- Clone preserves period and time_slot values
- Period auto-derivation from clock times at boundary values (11:59→morning, 12:00→afternoon, 16:59→afternoon, 17:00→evening)
- Schedule grid renders multiple entries per day correctly
- Today API returns array when multiple sessions scheduled
- Unique constraint prevents duplicate (day, variant, period) combinations
