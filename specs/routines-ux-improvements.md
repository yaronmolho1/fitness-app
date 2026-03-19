# Routines UX Improvements
**Status:** planned
**Epic:** Daily Habits
**Depends:** specs/routine-item-crud.md

## Description
Improve routine item creation and management with frequency day selection (Google Calendar-style), category auto-suggest combobox, and cleaner frequency configuration.

## Acceptance Criteria

### Frequency mode selector
- [ ] The `frequency_target` integer input is replaced with a frequency mode selector offering three options: "Daily", "Specific days", "X times per week"
- [ ] **Daily**: routine appears every day (equivalent to frequency_target=7, but stores as `frequency_mode='daily'`)
- [ ] **Specific days**: shows a Sun–Sat day pill selector (Google Calendar style — 7 circular toggles). User selects which days the routine should appear. Stores selected days as a comma-separated string or JSON array in a new `frequency_days` column
- [ ] **X times per week**: shows a number input (1–7). This is the current behavior with `frequency_target`
- [ ] Default mode on new routine: "X times per week" with value 3

### Schema changes
- [ ] `routine_items` gains `frequency_mode` column (text, enum: 'daily' | 'specific_days' | 'weekly_target', NOT NULL, default 'weekly_target')
- [ ] `routine_items` gains `frequency_days` column (text, nullable, JSON array of day numbers 0–6 where 0=Sunday)
- [ ] Existing rows get `frequency_mode='weekly_target'` via migration default
- [ ] `frequency_target` remains for 'weekly_target' mode; null/ignored for other modes

### Day selector UI
- [ ] 7 circular day pills in a row: S M T W T F S
- [ ] Tapping toggles a day on/off (multi-select)
- [ ] Selected days have filled/primary styling; unselected are outline
- [ ] At least 1 day must be selected (validation)
- [ ] Mobile-friendly: pills are large enough for thumb taps (min 40px)

### Today page filtering
- [ ] 'daily' mode: routine appears every day (same as global scope)
- [ ] 'specific_days' mode: routine appears only on selected days (checked against today's day-of-week)
- [ ] 'weekly_target' mode: routine appears every day (existing behavior — completion count tracks toward target)
- [ ] Filtering combines with existing scope logic (global/mesocycle/date_range/skip_on_deload)

### Category combobox
- [ ] Category text input replaced with a combobox (same pattern as exercise equipment/muscle group)
- [ ] Populated with distinct category values from existing routine items
- [ ] Type-to-filter + select-or-create (user can enter new categories)
- [ ] Suggestions sorted alphabetically, null/empty excluded
- [ ] Both create and edit forms use the combobox

### Edit form consistency
- [ ] Edit routine form shows the same frequency mode selector with current values pre-filled
- [ ] Switching frequency mode clears the previous mode's data (e.g., switching from specific_days to weekly_target clears frequency_days)
- [ ] Category combobox in edit form matches create form behavior

## Edge Cases
- Existing routines with only `frequency_target`: migrated to `frequency_mode='weekly_target'`, UI shows number input with current value
- Daily mode + skip_on_deload: routine skipped during deload weeks even though mode is "daily"
- Specific days mode + today not in selected days: routine doesn't appear on Today page
- Switching from specific_days to weekly_target in edit: frequency_days cleared, frequency_target required
- Routine with specific_days=[1,3,5] (Mon/Wed/Fri): weekly completion count still tracks all logs in the week

## Test Requirements
- Frequency mode selector renders three options correctly
- Day selector allows multi-select with at least 1 required
- Schema migration adds columns with correct defaults
- Today page filters by day-of-week for specific_days mode
- Category combobox populates from existing routine items
- Edit form pre-fills frequency mode and days correctly
- Mode switching clears irrelevant fields
- Existing routines with frequency_target still display correctly after migration
