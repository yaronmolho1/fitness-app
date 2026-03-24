# Intra-Phase Progression

## Description

Allow coaches to set different target values (weight, reps, sets, RPE, distance, duration, pace) for each week within a mesocycle so that each workout instance shows that specific week's progression targets rather than repeating the same base values across all weeks.

## Acceptance Criteria

### Per-week override storage

1. **Given** an exercise slot with base values (e.g., 60kg × 3×8 @ RPE 7), **When** the coach opens a "Plan Weeks" interface for that slot, **Then** a grid is displayed showing one row per work week (1 through N based on mesocycle `work_weeks`) plus an optional deload row if the mesocycle has deload enabled.

2. **Given** the per-week grid for an exercise slot, **When** Week 1 row loads, **Then** it is pre-filled with the slot's base values and all fields are editable.

3. **Given** the per-week grid, **When** the coach enters different values for Week 2 (e.g., 62.5kg × 3×8 @ RPE 7), **Then** those values are persisted as an override for that slot + week combination.

4. **Given** a per-week override row, **When** a field is left empty or cleared, **Then** that field falls back to the base slot value at display time.

5. **Given** a mesocycle with deload enabled, **When** the per-week grid loads, **Then** a deload row appears after the last work week, visually distinguished from work weeks.

6. **Given** the deload row in the grid, **When** no values have been entered, **Then** the deload row is pre-filled with a percentage of the base values (default: 60% weight, 50% sets, 100% reps, RPE −2).

7. **Given** the deload row, **When** the coach manually edits any field, **Then** the manual value takes precedence over the calculated default.

### Resistance slot overrides

8. **Given** a resistance exercise slot, **When** per-week overrides are configured, **Then** the overrideable fields are: weight, sets, reps, and RPE.

### Running/cardio section overrides

9. **Given** a running section within a mixed template, **When** per-week overrides are configured, **Then** the overrideable fields are: target distance, target duration, and target pace.

### Today view integration

10. **Given** an exercise slot with per-week overrides for Week 3, **When** the athlete opens the Today view on a date that falls in Week 3 of the mesocycle, **Then** the workout card shows the Week 3 override values (merged with base for any un-overridden fields).

11. **Given** an exercise slot with no override for the current week, **When** the Today view loads, **Then** the base slot values are displayed (unchanged from current behavior).

### Calendar day detail integration

12. **Given** a projected (future) day in the calendar that falls in Week 2, **When** the day detail panel opens, **Then** the exercise targets shown reflect Week 2's overrides merged with base values.

### Logging snapshot integration

13. **Given** a workout being logged on a date in Week 3, **When** the workout is saved, **Then** the template snapshot includes a `week_number` field indicating which week of the mesocycle this workout falls in.

14. **Given** a workout being logged with per-week overrides active, **When** the template snapshot is created, **Then** the snapshot captures the effective (merged) values for that specific week — not the base slot values.

### Cascade interaction

15. **Given** an exercise slot with existing per-week overrides, **When** the coach edits the base slot value (e.g., changes base weight from 60kg to 65kg), **Then** the system warns that overrides exist and asks whether to keep existing overrides or clear them.

16. **Given** a template with per-week overrides that is copied to another mesocycle, **When** the copy completes, **Then** the per-week overrides are also copied to the new template's corresponding slots.

### Backward compatibility

17. **Given** existing exercise slots with no per-week overrides, **When** the Today view or calendar loads, **Then** behavior is identical to the current system — base values displayed for every week.

18. **Given** the progression chart, **When** viewing logged data that includes `week_number` in the snapshot, **Then** the chart continues to work as before — planned values come from the snapshot (which now reflects the effective per-week values at log time).

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Mesocycle with 1 work week (no progression possible) | Grid shows Week 1 only (plus deload if enabled); still allows override for deload |
| Coach deletes an exercise slot that has overrides | All associated per-week overrides are cascade-deleted |
| Mesocycle work_weeks changed after overrides exist | Overrides for weeks beyond new work_weeks are deleted; overrides within range are preserved |
| Override with all fields null (user cleared everything) | Override row is deleted; slot falls back entirely to base values |
| Running template (not mixed) with per-week overrides | Running-specific fields (distance, duration, pace) are overrideable at the template level |
| MMA template with per-week overrides | Only planned_duration is overrideable |
| Override weight set to 0 | Valid — 0 is a legitimate value (e.g., bodyweight exercises); distinguished from null (fallback to base) |
| Slot in a completed mesocycle | Per-week grid is read-only; overrides viewable but not editable |
| Template copy with cascade scope "all phases" and overrides exist | Only base slot values cascade; overrides are specific to the source mesocycle's week structure |

## Test Requirements

- AC1: Integration — "Plan Weeks" UI shows correct number of rows matching mesocycle work_weeks + deload
- AC2: Integration — Week 1 row pre-fills with base slot values
- AC3: Integration — saving Week 2 overrides persists correctly and is retrievable
- AC4: Integration — null override field returns base value when merged
- AC5: Integration — deload row appears only when mesocycle has_deload is true
- AC6: Unit — deload default calculation: 60% weight, 50% sets, RPE −2
- AC8: Integration — resistance slot override saves/loads weight, sets, reps, RPE
- AC9: Integration — running section override saves/loads distance, duration, pace
- AC10: Integration — Today view on Week 3 date shows Week 3 merged values
- AC12: Integration — calendar day detail shows correct week-specific values
- AC13: Integration — logged workout snapshot includes week_number field
- AC14: Integration — snapshot contains effective merged values, not base values
- AC15: Visual — editing base slot with existing overrides triggers confirmation dialog
- AC16: Integration — template copy includes per-week overrides
- AC17: Integration — slots without overrides display base values (regression test)

## Dependencies

- `specs/exercise-slots.md` — base slot structure that overrides extend
- `specs/exercise-progression-chart.md` — snapshot format change (week_number addition)
- `specs/projected-calendar.md` — calendar day detail must merge overrides
- `specs/mixed-modality-templates.md` — running/MMA sections within mixed templates need section-level overrides

## Out of Scope

- Auto-progression rules (auto-fill "+2.5kg/week") — future enhancement
- Cross-phase override templates (reuse week patterns across mesocycles)
- Per-set overrides (different weight per set within a week) — current set structure is uniform per slot
- Progression chart enhancements to visualize intra-phase trends

## Open Questions

- Should deload percentage defaults (60% weight, 50% sets, RPE −2) be configurable per mesocycle or hardcoded for V1?
- For running templates (non-mixed), should overrides live at the template level (distance/duration/pace on workout_templates) or require a section wrapper?
- When cascading base slot edits across phases, should overrides in target mesocycles be preserved or cleared?
