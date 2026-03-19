# Cascade Slot-Level Edits
**Status:** partial
**Epic:** Template Cascade
**Depends:** specs/cascade-scope-selection.md, specs/exercise-slots.md

## Description
Extend the existing 3-scope cascade system (this only / this + future / all phases) to cover exercise slot parameter changes, slot add/remove, and running template field edits — not just template name.

## Acceptance Criteria

### Cascade slot parameter changes
- [ ] When editing an exercise slot's sets, reps, weight, RPE, or rest_seconds, the cascade scope selector appears after save
- [ ] "This only" applies the change to the current template's slot only (existing behavior)
- [ ] "This + future" finds sibling templates (same canonical_name) in current and future mesocycles, finds the matching slot by exercise canonical position (order + exercise_id), and applies the same parameter change
- [ ] "All phases" does the same across all non-completed mesocycles
- [ ] Slots in templates with logged workouts are skipped (immutability preserved)
- [ ] Completed mesocycles are always skipped
- [ ] Summary shows: N updated, N skipped (logged), N skipped (completed)

### Cascade add exercise slot
- [ ] When adding an exercise slot to a template, cascade scope selector appears
- [ ] "This + future" / "All phases" adds the same exercise slot (same exercise_id, same parameters, same order position) to sibling templates
- [ ] If the target template already has a slot at that order position, the new slot is appended at the end
- [ ] Adding to a template with different slot structure (e.g., diverged after clone) appends rather than insert-at-position

### Cascade remove exercise slot
- [ ] When removing an exercise slot, cascade scope selector appears
- [ ] "This + future" / "All phases" removes the matching slot (by exercise_id + order) from sibling templates
- [ ] If the target template doesn't have a matching slot (diverged), it is skipped with a note in the summary
- [ ] Remaining slots are re-ordered to fill gaps

### Cascade running template fields
- [ ] Running template fields (run_type, target_pace, hr_zone, interval_count, interval_rest, coaching_cues) become editable post-creation
- [ ] An "Edit" button appears on running template rows (alongside the existing name edit)
- [ ] Editing running fields triggers the cascade scope selector
- [ ] MMA/BJJ template `planned_duration` is also editable with cascade

### Cascade guidelines field
- [ ] Exercise slot `guidelines` field changes cascade alongside other slot parameters
- [ ] Template `notes` field (already in schema) becomes editable in the UI with cascade support

### Slot matching strategy
- [ ] Sibling slot matching uses `exercise_id` + relative `order` as the primary key for matching across templates
- [ ] If exercise_id doesn't match at the same order position, fall back to exercise_id match at any position
- [ ] If no match found, the target template is skipped for that operation

## Edge Cases
- Template A in Phase 1 has exercises [Bench, Squat, OHP]; Phase 2 diverged to [Bench, Deadlift, OHP]. Editing Bench cascades correctly; Squat edit skips Phase 2.
- Adding a slot when the target template has a different number of slots: append at end
- Removing the last slot in a template via cascade: allowed (template becomes empty)
- Editing reps from "8" to "10" + weight from 80 to 85 in one save: both changes cascade as a unit

## Test Requirements
- Slot parameter cascade applies to correct sibling templates
- Logged workout templates are skipped during cascade
- Completed mesocycles are skipped
- Add slot cascade appends correctly when order conflicts
- Remove slot cascade handles diverged templates gracefully
- Running field edit + cascade works end-to-end
- Summary counts (updated/skipped) are accurate
- Slot matching by exercise_id works across reordered templates
