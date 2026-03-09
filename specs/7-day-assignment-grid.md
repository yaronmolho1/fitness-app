# 7-Day Assignment Grid
**Status:** ready
**Epic:** Weekly Schedule
**Depends:** specs/create-resistance-templates.md

## Description
As a coach, I can assign workout templates to days of the week (Mon–Sun) for a mesocycle so that each week is fully mapped with a repeating weekly pattern.

## Acceptance Criteria
- [ ] The schedule grid displays all 7 days of the week (Monday through Sunday, day_of_week 0–6)
- [ ] Each day cell shows either the assigned template name or an empty/rest state
- [ ] A template can be assigned to a day by selecting from a list of templates belonging to the current mesocycle
- [ ] Only templates scoped to the current mesocycle appear in the assignment picker
- [ ] Assigning a template to a day creates a `weekly_schedule` row with `mesocycle_id`, `day_of_week`, `template_id`, and `variant='normal'`
- [ ] A day can have at most one template assigned per variant — assigning a second template to the same day+variant replaces the existing assignment
- [ ] An existing template assignment can be removed from a day, leaving that day unassigned (rest)
- [ ] Removing an assignment deletes the corresponding `weekly_schedule` row; the day reverts to unassigned state
- [ ] The grid is scoped to a specific mesocycle; navigating to a different mesocycle shows that mesocycle's schedule
- [ ] The schedule grid is accessible from the mesocycle detail view
- [ ] All mutations (assign, remove) are performed via Server Actions — per ADR-004
- [ ] After a successful assign or remove, the grid reflects the new state without a full page reload
- [ ] The grid shows the normal week variant by default (variant='normal')
- [ ] Template IDs stored in `weekly_schedule` are foreign keys to `workout_templates`; only valid template IDs for the mesocycle are accepted
- [ ] Attempting to assign a template from a different mesocycle is rejected

## Edge Cases
- Assigning a template to a day that already has an assignment replaces the existing assignment (not a duplicate row)
- All 7 days left unassigned is valid (full rest week)
- All 7 days assigned is valid
- Assigning the same template to multiple days is allowed (e.g. same Push A on Monday and Thursday)
- Attempting to assign a deleted template is rejected with an error
- Attempting to assign a template to a completed mesocycle's schedule — blocked with error message
- `day_of_week` values outside 0–6 are rejected

## Test Requirements
- Unit: assigning a template to an unassigned day creates the correct `weekly_schedule` row
- Unit: assigning a template to an already-assigned day replaces the row (no duplicate)
- Unit: removing an assignment deletes the row
- Unit: template from a different mesocycle is rejected
- Integration: assign template via Server Action → row appears in `weekly_schedule` with correct mesocycle_id, day_of_week, template_id, variant='normal'
- Integration: replace assignment → old row gone, new row present
- Integration: remove assignment → row deleted, day shows as unassigned
- Integration: assign template to completed mesocycle → rejected
- E2E: full assign → view → replace → remove flow on a 7-day grid
