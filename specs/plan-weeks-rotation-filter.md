# Plan Weeks Rotation Filter

**Status:** ready
**Epic:** Per-Week Template Rotation
**Depends:** specs/schedule-rotation-cycle.md, specs/intra-phase-progression.md, specs/template-week-overrides.md

## Description

When a template participates in a rotation cycle, the "Plan Weeks" grid should only show weeks where that template actually appears — not all mesocycle weeks. Week numbers remain actual mesocycle week numbers (not renumbered). Templates without rotation continue to show all weeks as before.

## Acceptance Criteria

### Active weeks computation

1. **Given** a template assigned to cycle position 1 of a 4-week rotation in a 12-week mesocycle, **When** the active weeks are computed, **Then** the result is [1, 5, 9] — every 4th week starting from position 1.

2. **Given** a template assigned to positions 1 AND 3 of a 4-week rotation in a 12-week mesocycle, **When** the active weeks are computed, **Then** the result is [1, 3, 5, 7, 9, 11] — weeks matching either position.

3. **Given** a template assigned every week (cycle_length=1, no rotation), **When** the active weeks are computed, **Then** the result includes all work weeks [1, 2, 3, ..., 12] — unchanged behavior.

4. **Given** a template that appears in both a rotation slot AND a non-rotating slot on different days, **When** the active weeks are computed, **Then** the result is all work weeks (the non-rotating slot makes it present every week).

5. **Given** a schedule_week_override that replaces a rotation-resolved template with a different template for week 5, **When** the active weeks for the ORIGINAL template are computed, **Then** week 5 is excluded from its active weeks.

6. **Given** a schedule_week_override that ADDS the template to a week where it wouldn't normally appear (override points to this template), **When** the active weeks are computed, **Then** that week IS included.

### Resistance slot grid (WeekProgressionGrid)

7. **Given** a resistance template in a rotation with active weeks [1, 3, 5, 7], **When** the "Plan Weeks" grid opens for an exercise slot, **Then** the grid shows 4 rows labeled Week 1, Week 3, Week 5, Week 7.

8. **Given** the filtered grid, **When** Week 1 row loads, **Then** it is pre-filled with the slot's base values (same as before).

9. **Given** the filtered grid, **When** the user enters overrides for Week 3, **Then** a slot_week_override is saved with week_number=3 (actual mesocycle week, not renumbered).

10. **Given** a resistance template with no rotation (all weeks active), **When** the "Plan Weeks" grid opens, **Then** it shows all work weeks as before — backward compatible.

### Running/MMA template grid (TemplateWeekGrid)

11. **Given** a running template in a rotation with active weeks [2, 6, 10], **When** the "Plan Weeks" grid opens, **Then** the grid shows 3 rows labeled Week 2, Week 6, Week 10.

12. **Given** the filtered grid for a running template, **When** the user enters distance/pace for Week 6, **Then** a template_week_override is saved with week_number=6.

### Deload row

13. **Given** a mesocycle with deload enabled, **When** the template has its own deload schedule entry, **Then** the deload row appears in the grid regardless of rotation (deload is separate from rotation cycle).

14. **Given** a mesocycle with deload enabled, **When** the template does NOT appear in the deload schedule, **Then** no deload row is shown in the grid.

### Grid count accuracy

15. **Given** a template appearing once per 4-week cycle in a 12-week mesocycle, **When** the grid opens, **Then** exactly 3 work-week rows are shown.

16. **Given** a template appearing once per 4-week cycle in a 13-week mesocycle, **When** the grid opens, **Then** 4 rows are shown (weeks 1, 5, 9, 13 — the cycle wraps).

17. **Given** a template appearing twice per 4-week cycle (positions 1 and 3) in an 8-week mesocycle, **When** the grid opens, **Then** 4 rows are shown (weeks 1, 3, 5, 7).

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Template not in any schedule slot | Grid shows all weeks (no rotation context to filter by) — degrades gracefully |
| Template in rotation but cycle_length > work_weeks | Grid shows only weeks that fall within work_weeks (e.g., 4-week cycle in 3-week meso → positions 1-3 only) |
| Existing overrides for weeks that become inactive after rotation change | Orphaned overrides are harmless — they persist in DB but don't display in the filtered grid |
| Override exists for a week where template doesn't appear | Override has no effect at display time (template not scheduled that week); not shown in grid |
| Template appears in multiple slots on different days with different rotation cycles | Active weeks = union of all appearances across all slots |

## Test Requirements

- AC1-2: Unit — active weeks computation for single and multi-position rotation
- AC3: Unit — cycle_length=1 returns all work weeks
- AC4: Unit — template in both rotating and non-rotating slots returns all weeks
- AC5-6: Unit — schedule_week_overrides correctly include/exclude weeks
- AC7: Integration — WeekProgressionGrid renders only active week rows with correct labels
- AC9: Integration — saving override uses actual week_number (not renumbered index)
- AC10: Integration — no-rotation template shows all weeks (regression)
- AC11-12: Integration — TemplateWeekGrid renders only active week rows for running/MMA
- AC13-14: Integration — deload row appears based on deload schedule presence, not rotation
- AC15-17: Unit — grid row count matches expected for various cycle/work_weeks combinations

## Dependencies

- `specs/schedule-rotation-cycle.md` — rotation data model and resolution logic
- `specs/intra-phase-progression.md` — resistance slot "Plan Weeks" grid structure
- `specs/template-week-overrides.md` — running/MMA "Plan Weeks" grid structure

## Out of Scope

- Renumbering weeks (week numbers are always actual mesocycle weeks)
- Showing inactive weeks as greyed-out rows (only active weeks shown)
- Auto-cleaning orphaned overrides for weeks no longer in the rotation

## Open Questions

None — all resolved during PRD discovery.
