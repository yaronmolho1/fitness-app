# Smart Clone — Latest Progression Inheritance

**Status:** ready
**Epic:** Per-Week Template Rotation
**Depends:** specs/clone-mesocycle.md, specs/intra-phase-progression.md, specs/template-week-overrides.md, specs/schedule-rotation-cycle.md

## Description

When cloning a mesocycle, the new template base values should automatically reflect the latest progression — the last work week's effective values (base merged with overrides) rather than the original base values. The clone also preserves any rotation cycle structure from the source schedule.

## Acceptance Criteria

### Resistance slot value inheritance

1. **Given** a source mesocycle with 8 work weeks where exercise slot base weight is 60kg and slot_week_override for week 8 sets weight to 80kg, **When** the mesocycle is cloned, **Then** the new slot's base weight is 80kg.

2. **Given** a slot_week_override for week 8 that sets weight to 80kg but leaves reps as null, **When** the mesocycle is cloned, **Then** the new slot's base weight is 80kg and base reps come from the original base value (null override = fall back to base).

3. **Given** a source mesocycle where no slot_week_overrides exist for any week, **When** the mesocycle is cloned, **Then** the new slot's base values are identical to the source slot's base values (unchanged behavior).

4. **Given** a source slot with overrides for weight, reps, sets, and RPE at the last work week, **When** cloned, **Then** all four fields on the new slot reflect the last week's effective values.

### Running/MMA template value inheritance

5. **Given** a running template with base distance 7km and template_week_override for the last work week setting distance to 14km, **When** the mesocycle is cloned, **Then** the new template's base distance is 14km.

6. **Given** a running template_week_override that sets distance and pace but leaves duration null, **When** cloned, **Then** the new template inherits distance and pace from the override and duration from the original base.

7. **Given** an MMA template with base planned_duration of 60 and template_week_override for the last work week setting planned_duration to 90, **When** cloned, **Then** the new template's base planned_duration is 90.

8. **Given** a mixed template with sections, **When** cloned, **Then** each section's base fields are updated from the last work week's section-level template_week_override (matched by section_id).

### Inherited fields

9. **Given** a resistance slot being cloned, **When** last-week overrides exist, **Then** the following fields are inherited: weight, reps, sets, rpe, distance, duration, pace.

10. **Given** a running or MMA template being cloned, **When** last-week overrides exist, **Then** the following fields are inherited: distance, duration, pace, interval_count, interval_rest, planned_duration.

### Override source week

11. **Given** a source mesocycle with 8 work_weeks, **When** cloning, **Then** the system queries overrides at week_number = 8 (source's work_weeks value) regardless of the new mesocycle's work_weeks setting.

12. **Given** a source mesocycle with 8 work_weeks where the user overrides clone work_weeks to 12, **When** cloning, **Then** overrides are still read from week 8 of the source — not week 12.

### Clean start

13. **Given** a cloned mesocycle with inherited base values, **When** the new mesocycle is created, **Then** no slot_week_overrides or template_week_overrides are created — the new mesocycle starts with clean base values and an empty override grid.

### Rotation preservation

14. **Given** a source mesocycle with a 4-week rotation on Monday 07:00, **When** cloned, **Then** the new mesocycle has the same 4 schedule rows with matching cycle_length and cycle_position values, with template_ids remapped to the new mesocycle's templates.

15. **Given** a source with both rotating and non-rotating schedule entries, **When** cloned, **Then** rotating entries preserve their cycle fields and non-rotating entries have cycle_length=1, cycle_position=1.

### Schedule week overrides NOT copied

16. **Given** a source mesocycle with schedule_week_overrides (moved workouts), **When** cloned, **Then** the overrides are NOT copied — the new mesocycle starts with the base schedule (existing behavior from specs/schedule-week-overrides.md AC9, unchanged).

### Transaction atomicity

17. **Given** a clone operation, **When** any step fails (template copy, slot inheritance, schedule copy), **Then** the entire transaction rolls back — no partial data persisted (existing behavior, unchanged).

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Source slot has overrides for some weeks but not the last work week | No override for last week → new base = original base (same as current clone) |
| Source slot override at last week has all fields null | All null = no effective override → new base = original base |
| Source has 0 work_weeks | No override to query → new base = original base |
| Source template has no sections (standalone running/MMA) | Template-level override queried with section_id = null |
| Source template has sections but no section-level overrides | Section base values copied as-is |
| Deload week overrides exist on source | Not inherited — deload overrides are not used as progression source |
| Clone with has_deload overridden to false | Deload schedule rows not copied (existing behavior) |
| Source template deleted after clone starts but before it reads overrides | Transaction isolation ensures consistent reads within the clone transaction |
| Multiple slots in a rotation reference the same template | Template is cloned once; both rotation positions reference the same new template_id |

## Test Requirements

- AC1-2: Integration — clone with last-week slot override produces new slot with merged base values
- AC3: Integration — clone without overrides produces identical base values (regression)
- AC4: Integration — all four resistance fields (weight, reps, sets, RPE) inherited
- AC5-6: Integration — running template clone inherits distance/pace from last-week override
- AC7: Integration — MMA template clone inherits planned_duration
- AC8: Integration — mixed template section-level overrides inherited per section
- AC11-12: Integration — override source is always source.work_weeks regardless of new work_weeks
- AC13: Integration — cloned mesocycle has zero slot_week_overrides and zero template_week_overrides
- AC14-15: Integration — cloned schedule rows preserve cycle_length and cycle_position
- AC16: Integration — schedule_week_overrides not copied (regression from existing spec)
- AC17: Integration — transaction rollback on mid-clone failure

## Dependencies

- `specs/clone-mesocycle.md` — base clone behavior (transaction, template/slot/schedule copying)
- `specs/intra-phase-progression.md` — slot_week_overrides merge function
- `specs/template-week-overrides.md` — template_week_overrides structure
- `specs/schedule-rotation-cycle.md` — cycle_length/cycle_position fields on weekly_schedule

## Out of Scope

- User-selectable source week for inheritance (always uses last work week)
- Inheriting deload week values
- Copying slot_week_overrides to the new mesocycle
- Copying template_week_overrides to the new mesocycle
- Auto-progression (computing next mesocycle's values algorithmically)

## Open Questions

None — all resolved during PRD discovery.
