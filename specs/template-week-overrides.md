# Template Week Overrides for Running/MMA

## Description

Extend the per-week progression system to running and MMA/BJJ templates so coaches can plan distance/duration/pace or session duration variations across mesocycle weeks — matching the existing resistance "Plan Weeks" capability.

## Acceptance Criteria

### Schema

1. **Given** the system needs template-level week overrides, **When** the migration runs, **Then** a `template_week_overrides` table is created with columns: `id`, `template_id` (FK to workout_templates, cascade delete), `section_id` (nullable FK to template_sections, cascade delete), `week_number` (integer), `distance` (real), `duration` (integer), `pace` (text), `planned_duration` (integer), `is_deload` (integer, default 0), `created_at` (timestamp).

2. **Given** the `template_week_overrides` table, **When** a row is inserted, **Then** a unique index on `(template_id, section_id, week_number)` prevents duplicate entries for the same template+section+week.

### Running templates (standalone)

3. **Given** a standalone running template in a mesocycle with work_weeks > 0, **When** the template row is expanded, **Then** a "Plan Weeks" button appears.

4. **Given** the "Plan Weeks" button on a running template is clicked, **When** the grid dialog opens, **Then** it shows one row per work week plus an optional deload row, with columns: distance, duration, pace.

5. **Given** the running week grid, **When** Week 1 row loads with no overrides, **Then** fields are pre-filled from the template's base values (target_distance, target_duration, target_pace).

6. **Given** a coach enters different values for Week 2, **When** they save, **Then** a `template_week_overrides` row is upserted with `template_id` set and `section_id` null.

7. **Given** a running override with a null field, **When** displayed, **Then** that field falls back to the template's base value.

### MMA templates (standalone)

8. **Given** a standalone MMA template in a mesocycle with work_weeks > 0, **When** the template row is expanded, **Then** a "Plan Weeks" button appears.

9. **Given** the "Plan Weeks" button on an MMA template is clicked, **When** the grid dialog opens, **Then** it shows one row per work week plus optional deload row, with a single column: planned_duration.

10. **Given** a coach enters a different duration for Week 3, **When** they save, **Then** a `template_week_overrides` row is upserted with the `planned_duration` value.

### Mixed template sections

11. **Given** a running section within a mixed template, **When** the section is expanded, **Then** a "Plan Weeks" button appears for that section.

12. **Given** a running section's "Plan Weeks" grid, **When** overrides are saved, **Then** `template_week_overrides` rows are created with both `template_id` and `section_id` set.

13. **Given** an MMA section within a mixed template, **When** the section is expanded, **Then** a "Plan Weeks" button appears for that section.

### Deload defaults

14. **Given** a running template with deload enabled, **When** the deload row has no overrides, **Then** it pre-fills with: 80% distance, 100% duration, base pace (running deload reduces volume, not intensity).

15. **Given** an MMA template with deload enabled, **When** the deload row has no overrides, **Then** it pre-fills with: 70% of base planned_duration.

### Completed mesocycle guard

16. **Given** a completed mesocycle, **When** the "Plan Weeks" grid opens for a running/MMA template, **Then** all fields are read-only.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Running template with no base values (all null) | Grid shows empty fields; user can still enter per-week values from scratch |
| MMA template with no planned_duration | Grid shows empty duration field per week |
| Mesocycle with 1 work week | Grid shows Week 1 only (plus deload if enabled) |
| Override with all fields cleared | Override row is deleted; falls back to base values |
| Template deleted | All associated template_week_overrides cascade-deleted |
| Section deleted from mixed template | All overrides for that section_id cascade-deleted |
| Mesocycle work_weeks reduced | Overrides for weeks beyond new count should be deleted |
| Standalone running template (section_id = null) | Unique index treats null section_id as distinct — SQLite handles this correctly |

## Test Requirements

- AC1: Integration — migration creates table with correct schema
- AC2: Integration — unique constraint rejects duplicate template+section+week
- AC3-4: Integration — running template shows Plan Weeks button and grid with correct columns
- AC5: Integration — grid pre-fills from base template values
- AC6: Integration — saving override creates correct row with null section_id
- AC8-9: Integration — MMA template shows Plan Weeks with duration-only grid
- AC11-12: Integration — mixed section overrides have both template_id and section_id
- AC14-15: Unit — deload default calculations for running (80% distance) and MMA (70% duration)
- AC16: Integration — completed mesocycle renders read-only grid

## Dependencies

- `specs/intra-phase-progression.md` — extends the concept to non-resistance modalities
- `specs/running-templates.md` — base running template fields
- `specs/mma-bjj-template-support.md` — base MMA template fields
- `specs/mixed-modality-templates.md` — mixed template sections

## Out of Scope

- Running interval-specific per-week overrides (interval_count, interval_rest per week)
- HR zone per-week overrides
- Auto-progression rules (auto-fill patterns)
- Today view / calendar integration for running/MMA week overrides (separate follow-up)
- Logging snapshot integration for running/MMA week overrides (separate follow-up)

## Open Questions

- Should deload defaults for running/MMA be configurable or hardcoded for V1?
- When mesocycle work_weeks changes, should we auto-cleanup orphaned overrides via trigger or application logic?
