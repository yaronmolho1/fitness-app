# Exercise Slots
**Status:** ready
**Epic:** Workout Templates
**Depends:** specs/create-resistance-templates.md, specs/exercise-search-filter.md

## Description
As a coach, I can add exercises to resistance templates with per-slot targets (sets, reps, weight, RPE, rest, guidelines) so that my athlete-self knows exactly what to do for each exercise in a workout.

## Acceptance Criteria
- [ ] An exercise slot can be added to a resistance template by selecting an exercise from the exercise picker
- [ ] The exercise picker uses the searchable, filterable exercise list from the Exercise Search & Filter story
- [ ] Only exercises with `modality = resistance` are shown in the exercise picker when adding slots to a resistance template
- [ ] Each exercise slot stores: `exercise_id` (FK to exercises), `template_id` (FK to workout_templates), `target_sets`, `target_reps`, `target_weight`, `target_rpe`, `rest_seconds`, `guidelines` (text), `sort_order` (integer)
- [ ] `target_sets` is a positive integer; required field
- [ ] `target_reps` is a positive integer; required field
- [ ] `target_weight` is a non-negative number (kg or lb — unit is display-only, no conversion in V1); optional field
- [ ] `target_rpe` is a number between 1 and 10 inclusive; optional field
- [ ] `rest_seconds` is a non-negative integer (seconds); optional field
- [ ] `guidelines` is free text; optional field; no length limit enforced in V1
- [ ] `sort_order` is an integer assigned automatically on add (appended to end of current list)
- [ ] All exercise slots for a template are displayed in `sort_order` ascending order
- [ ] A slot can be removed from a template; removal is permanent with a confirmation prompt
- [ ] A slot's target fields (`target_sets`, `target_reps`, `target_weight`, `target_rpe`, `rest_seconds`, `guidelines`) are individually editable inline or via an edit form
- [ ] The same exercise can be added to the same template more than once (e.g. two sets of squats with different rep schemes)
- [ ] A template with no exercise slots shows a prompt to add the first exercise
- [ ] The number of slots per template is not artificially limited in V1
- [ ] All mutations (add slot, update slot, remove slot) are performed via Server Actions — per ADR-004
- [ ] Slot IDs are auto-increment integers — no UUIDs — per architecture conventions
- [ ] After adding, editing, or removing a slot, the template's slot list reflects the change without a full page reload
- [ ] Removing an exercise from the global exercise library while it is referenced by a slot is blocked (handled by Exercise Deletion Protection story); slots are never left with a dangling `exercise_id`

## Edge Cases
- Adding a slot with `target_sets = 0` or negative — rejected
- Adding a slot with `target_reps = 0` or negative — rejected
- `target_rpe` outside 1–10 range — rejected
- `target_weight` negative — rejected
- `rest_seconds` negative — rejected
- Adding a slot to a template that belongs to a completed mesocycle — allowed (templates in completed mesocycles are still readable; editing is a separate concern handled by cascade protection)
- Removing the last slot from a template — allowed; template becomes an empty container
- `sort_order` gaps after removal — gaps are acceptable; display order is determined by `sort_order` ascending, not by contiguous values
- Exercise picker opened with no exercises in the library — shows empty state with link to exercise library

## Test Requirements
- Unit: slot field validation (sets/reps must be positive integers, RPE 1–10, weight/rest non-negative)
- Unit: `sort_order` assigned as max existing + 1 when appending a new slot
- Integration: add slot via Server Action → slot appears in template with correct field values and sort_order
- Integration: update slot target fields → changes persisted and reflected in UI
- Integration: remove slot → slot removed, remaining slots retain their sort_order values
- Integration: add same exercise twice to same template → both slots created with distinct IDs and sort_orders
- Integration: exercise picker filters to resistance-modality exercises only
- E2E: add multiple slots to a template, verify display order matches sort_order, edit a slot's targets, remove a slot
