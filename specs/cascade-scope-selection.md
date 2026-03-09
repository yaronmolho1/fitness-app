# Cascade Scope Selection
**Status:** ready
**Epic:** Template Cascade
**Depends:** specs/create-resistance-templates.md, specs/7-day-assignment-grid.md

## Description
As a coach, when I edit a template, I can choose a propagation scope ("this mesocycle only", "this + all future", or "all phases") so that changes cascade to matching templates in target mesocycles without me updating each phase manually.

## Acceptance Criteria
- [ ] When saving edits to a template, the user is presented with a scope selection before the save is committed
- [ ] Three scope options are offered: "This mesocycle only", "This + all future mesocycles", "All phases"
- [ ] "This mesocycle only" applies the edit only to the template being edited; no other mesocycles are affected
- [ ] "This + all future mesocycles" applies the edit to the current template and all templates with the same `canonical_name` in mesocycles with `status IN ('active', 'planned')` that were created after the current mesocycle — per ADR-002
- [ ] "All phases" applies the edit to all templates with the same `canonical_name` in mesocycles with `status IN ('active', 'planned')` regardless of creation order — per ADR-002
- [ ] Cascade targets are found by querying `canonical_name` across mesocycles; only mesocycles with `status != 'completed'` are included — per ADR-002 and ADR-006
- [ ] Templates with existing logged workouts referencing them are skipped during cascade — per ADR-002
- [ ] The fields that cascade are the template's editable metadata fields (name, `canonical_name`, and any other template-level fields defined on `workout_templates`)
- [ ] Exercise slot changes (add/remove/edit slots) are also subject to cascade scope selection when saving slot edits
- [ ] After cascade, the user is shown a summary of how many templates were updated and in which mesocycles
- [ ] If no sibling templates exist for the selected scope (e.g. only one mesocycle with this `canonical_name`), the cascade proceeds silently with no error — it is equivalent to "this mesocycle only"
- [ ] The scope selection UI is a confirmation step, not a separate settings page — it appears inline when saving
- [ ] Cancelling the scope selection aborts the save entirely; no changes are persisted
- [ ] All cascade mutations are performed via a single Server Action — per ADR-004
- [ ] The cascade operation is atomic: either all target templates are updated or none are (transaction)

## Edge Cases
- Template has no siblings with the same `canonical_name` in other mesocycles: all three scopes behave identically (only the current template is updated); no error shown
- Template's `canonical_name` was manually edited and no longer matches siblings: cascade finds zero targets beyond the current template; user is not warned (the broken link is intentional per ADR-006)
- "This + all future" scope when the current mesocycle is the only active/planned one: behaves as "this mesocycle only"
- "All phases" scope when all other mesocycles with the same `canonical_name` are completed: only the current template is updated; completed mesocycles are skipped silently (see Completed Mesocycle Protection spec)
- A sibling template has existing logged workouts: that specific template is skipped; others in scope are still updated; the summary informs the user of skipped templates
- Cascade to a large number of mesocycles (e.g. 10+ phases): all are updated in a single atomic transaction
- User selects scope and then navigates away before confirming: no changes are persisted

## Test Requirements
- Unit: cascade query returns correct sibling templates for each scope ("this only", "this + future", "all phases")
- Unit: cascade query excludes mesocycles with `status='completed'`
- Unit: cascade query excludes templates with existing logged workouts
- Unit: no siblings found → only current template updated, no error
- Integration: edit template with "this mesocycle only" → only current template row updated
- Integration: edit template with "this + all future" → current + future sibling templates updated; past sibling templates unchanged
- Integration: edit template with "all phases" → all active/planned sibling templates updated
- Integration: sibling with logged workouts → skipped; summary shows skipped count
- Integration: cascade is atomic — partial failure rolls back all changes
- Integration: cancel scope selection → no changes persisted
- E2E: edit template name → select "all phases" scope → confirm → verify all sibling templates updated across mesocycles
