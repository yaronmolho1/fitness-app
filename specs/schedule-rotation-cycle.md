# Schedule Rotation Cycle

**Status:** ready
**Epic:** Per-Week Template Rotation
**Depends:** specs/7-day-assignment-grid.md, specs/time-based-scheduling.md, specs/schedule-week-overrides.md, specs/running-templates.md

## Description

Allow a single schedule slot (day + time) to rotate through different running templates across weeks using a repeating N-week cycle. A 4-week cycle on Monday 07:00 could assign VO2 max → Threshold → VO2 max → Tempo, repeating across the mesocycle. Existing schedule week overrides layer on top — override always wins.

## Acceptance Criteria

### Rotation definition

1. **Given** an active or planned mesocycle with running templates, **When** the user opens the schedule grid and selects a slot, **Then** they can choose between "Assign template" (single, every week) or "Assign rotation" (cycle of templates).

2. **Given** the user selects "Assign rotation," **When** the rotation editor opens, **Then** they can set the cycle length (2-8) and pick a template for each cycle position.

3. **Given** a rotation with cycle length 4, **When** the user assigns templates to positions 1-4 and saves, **Then** 4 rows are created in the schedule for that slot — all sharing the same day, time, and week_type but with distinct cycle positions 1-4.

4. **Given** a rotation being saved, **When** any cycle position references a template not belonging to this mesocycle, **Then** the save is rejected with an error.

5. **Given** a rotation with cycle length 4, **When** the user assigns the same template to positions 1 and 3, **Then** it is accepted — the same template appearing in multiple cycle positions is valid.

6. **Given** an existing rotation on a slot, **When** the user saves a new rotation on the same slot, **Then** all previous rows for that slot (same mesocycle, day, week_type, time_slot) are deleted and replaced atomically.

7. **Given** an existing rotation on a slot, **When** the user switches back to a single-template assignment, **Then** all rotation rows for that slot are deleted and replaced with a single row (cycle_length=1, cycle_position=1).

### Resolution

8. **Given** a 4-week rotation on Monday 07:00, **When** the today view loads for a date in week 1 of the mesocycle, **Then** the template at cycle position 1 is displayed.

9. **Given** the same rotation, **When** the today view loads for week 5, **Then** cycle position `((5-1) % 4) + 1 = 1` resolves — the template at position 1 is displayed again (cycle repeats).

10. **Given** the same rotation, **When** the today view loads for week 3, **Then** cycle position `((3-1) % 4) + 1 = 3` resolves — the template at position 3 is displayed.

11. **Given** a slot with no rotation (cycle_length=1), **When** the today view loads for any week, **Then** the single assigned template is displayed for every week (backward compatible).

### Override interaction

12. **Given** a rotation that resolves to "VO2 max" for week 7, **When** a schedule_week_override exists for that slot on week 7 pointing to "Long Run," **Then** the override wins — "Long Run" is displayed for week 7.

13. **Given** a rotation that resolves to "VO2 max" for week 7, **When** a schedule_week_override with null template_id exists for that slot on week 7, **Then** the slot shows as rest for week 7.

14. **Given** a rotation on a slot, **When** a schedule_week_override moves a workout FROM that slot, **Then** the source slot becomes rest for that week (existing move behavior, unchanged).

### Deload week

15. **Given** a mesocycle with deload enabled, **When** the deload week's schedule is resolved, **Then** the deload schedule uses its own separate weekly_schedule rows (week_type='deload') — rotation on normal weeks does not affect deload.

### Calendar projection

16. **Given** a 4-week rotation on Monday 07:00 in a 12-week mesocycle, **When** the calendar month view renders, **Then** each Monday shows the correct rotation-resolved template for that week's position in the cycle.

### Google Calendar sync

17. **Given** a mesocycle with rotation and Google Calendar connected, **When** events are synced, **Then** each Monday's event reflects the rotation-resolved template for that week (VO2 max for week 1, Threshold for week 2, etc.).

### Schedule grid display

18. **Given** a slot with a rotation, **When** the schedule grid renders, **Then** the slot shows a visual indicator (e.g., "4-week cycle" badge) distinguishing it from single-template slots.

19. **Given** a slot with a rotation, **When** the user clicks on it, **Then** a summary of the rotation is shown (all positions with their templates) and an "Edit Rotation" action is available.

### Removal

20. **Given** a slot with a rotation, **When** the user removes the assignment, **Then** all rows for that slot (all cycle positions) are deleted — partial removal of individual positions is not supported.

### Completed mesocycle guard

21. **Given** a completed mesocycle with a rotation, **When** the user views the schedule, **Then** the rotation is visible but cannot be edited.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Cycle length exceeds mesocycle work_weeks (e.g., 4-week cycle in 3-week meso) | Allowed — positions beyond work_weeks simply never activate; user may intend to extend meso later |
| Cycle length of 1 | Equivalent to a single-template assignment — valid but redundant |
| All cycle positions assigned the same template | Valid — equivalent to no rotation but with explicit weekly structure |
| Mesocycle work_weeks changed after rotation exists | Rotation persists unchanged; weeks beyond work_weeks won't resolve (harmless) |
| Multiple rotations on same day, different time slots | Each time_slot has its own independent rotation |
| Rotation on deload week_type | Technically possible (same schema) but not exposed in V1 UI — deload uses single assignment |
| Move workout (schedule_week_override) from a rotation slot | Override creates rest at source + workout at target for that week; rotation resumes for other weeks |
| Template deleted that appears in a rotation | CASCADE DELETE removes the schedule row(s) referencing that template; remaining rotation positions may have gaps — user should be warned before deleting |

## Test Requirements

- AC1-2: Component — rotation editor UI renders with cycle length selector and template pickers
- AC3: Integration — saving rotation creates correct number of rows with matching cycle_length and contiguous cycle_positions
- AC4: Integration — rotation save rejects template_id not in mesocycle
- AC5: Integration — same template in multiple positions is accepted
- AC6: Integration — replacing rotation deletes old rows and inserts new ones atomically
- AC7: Integration — switching from rotation to single assignment produces one row with cycle_length=1
- AC8-10: Integration — effective schedule resolution returns correct template based on week number and cycle math
- AC11: Integration — cycle_length=1 resolution matches pre-rotation behavior (regression)
- AC12-13: Integration — schedule_week_override overrides rotation-resolved template
- AC15: Integration — deload week uses deload schedule rows, not rotation
- AC16: Integration — calendar projection shows correct rotation-resolved templates across a month
- AC17: Integration — GCal sync resolves rotation per week
- AC20: Integration — removing rotation deletes all cycle position rows

## Dependencies

- `specs/7-day-assignment-grid.md` — base schedule structure
- `specs/time-based-scheduling.md` — time_slot/duration on schedule entries
- `specs/schedule-week-overrides.md` — override merging behavior (AC12-14)
- `specs/running-templates.md` — running template types that rotate
- `specs/google-calendar-sync.md` — sync must resolve rotation

## Out of Scope

- Rotation for resistance or MMA templates (running only in V1)
- Visual drag-and-drop cycle editor
- Mid-mesocycle cycle length changes (must delete and recreate)
- Auto-progression across cycle positions
- Rotation on deload week_type

## Open Questions

None — all resolved during PRD discovery.
