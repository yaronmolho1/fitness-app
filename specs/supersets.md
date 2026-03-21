---
status: ready
epic: Workout Templates
depends: exercise-slots, cascade-slot-edits
---

# Supersets (Exercise Grouping)

## Description

Group N exercises into supersets with configurable rest between exercises (intra-group) and after the full round (group rest). Supports supersets, tri-sets, and giant sets.

## Acceptance Criteria

1. **Given** the exercise_slots table, **When** I inspect columns, **Then** `group_id` (integer, nullable) and `group_rest_seconds` (integer, nullable) exist.
2. **Given** 2+ contiguous ungrouped slots in the same template, **When** I create a superset, **Then** they share a group_id and group_rest_seconds is set.
3. **Given** slots are not contiguous in order, **When** I try to create a superset, **Then** I get a validation error.
4. **Given** a slot already has a group_id, **When** I try to include it in a new superset, **Then** I get a validation error.
5. **Given** a superset exists, **When** I click "Break Superset", **Then** group_id and group_rest_seconds are nulled on all member slots.
6. **Given** a superset exists, **When** I edit the group rest time, **Then** group_rest_seconds updates on all member slots.
7. **Given** slots with same group_id, **When** rendered in slot list, **Then** they appear in a visual container with left border accent.
8. **Given** 2 exercises in group, **Then** label is "Superset"; 3 = "Tri-set"; 4+ = "Giant set".
9. **Given** a superset, **When** displayed, **Then** intra-rest (rest_seconds) shows between exercises, group_rest_seconds shows after group.
10. **Given** the slot list, **When** I click "Group" toggle, **Then** checkboxes appear on ungrouped slots.
11. **Given** 2+ checkboxes selected, **When** I click "Create Superset", **Then** a prompt for group rest appears.
12. **Given** a grouped slot is dragged out of its group, **Then** it auto-ungroups (group_id = null).
13. **Given** a workout with supersets, **When** displayed on today page or logging form, **Then** exercises are visually grouped with label.
14. **Given** I log a resistance workout with supersets, **When** I inspect template_snapshot, **Then** group_id and group_rest_seconds are included per slot.
15. **Given** a mixed template with a resistance section, **When** I create a superset in that section, **Then** it works the same as pure resistance templates.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Single slot selected for superset | Validation error: need 2+ slots |
| Slots from different templates | Validation error: all must be same template |
| group_rest_seconds = 0 | Valid — zero rest after superset round |
| Breaking superset with 2 slots | Both revert to individual slots with their own rest_seconds |
| Completed mesocycle | All superset CRUD actions blocked |
| Reorder slot within group | Stays in group, order updates |

## Test Requirements

- AC1: integration — verify columns exist after migration
- AC2-4: integration — createSuperset validation + happy path
- AC5: integration — breakSuperset nulls fields
- AC6: integration — updateGroupRest updates all members
- AC7-11: component — slot-list visual grouping and interaction
- AC12: component — drag-reorder ungroup behavior
- AC13: component — today/logging grouped display
- AC14: integration — snapshot includes group fields
- AC15: integration — works within mixed template resistance sections

## Dependencies

- `specs/exercise-slots.md` — extends slot schema
- `specs/cascade-slot-edits.md` — superset cascade deferred to follow-up

## Out of Scope

- Cascade superset changes across phases (deferred)
- Rest timer functionality
- Circuit training mode (timed rounds)
