# Normal vs Deload Tabs
**Status:** ready
**Epic:** Weekly Schedule
**Depends:** specs/7-day-assignment-grid.md

## Description
As a coach, I can configure separate Normal and Deload schedule tabs for a mesocycle so that deload weeks use entirely different templates rather than lighter loads on the same templates.

## Acceptance Criteria
- [ ] The schedule UI shows a "Normal" tab and a "Deload" tab when the mesocycle has `has_deload=true` — per ADR-003
- [ ] The Deload tab is hidden entirely when the mesocycle has `has_deload=false`; no deload schedule rows exist for that mesocycle
- [ ] The Normal tab is always visible and active by default
- [ ] Switching between tabs shows the schedule grid for the selected variant without a full page reload
- [ ] The Normal tab displays and edits `weekly_schedule` rows with `variant='normal'`
- [ ] The Deload tab displays and edits `weekly_schedule` rows with `variant='deload'`
- [ ] Normal and Deload schedules are fully independent — assigning a template on the Normal tab does not affect the Deload tab and vice versa
- [ ] The template picker on the Deload tab shows all templates scoped to the current mesocycle (deload templates are regular `workout_templates` scoped to the same mesocycle)
- [ ] A day can have a different template assigned on the Deload tab than on the Normal tab
- [ ] A day can be assigned on the Normal tab but unassigned (rest) on the Deload tab, and vice versa
- [ ] All 7 days are shown on both tabs
- [ ] All mutations on the Deload tab create/update/delete `weekly_schedule` rows with `variant='deload'`
- [ ] All mutations on the Normal tab create/update/delete `weekly_schedule` rows with `variant='normal'`
- [ ] All mutations are performed via Server Actions — per ADR-004
- [ ] The active tab is visually indicated

## Edge Cases
- Mesocycle with `has_deload=false`: Deload tab must not appear; any attempt to create `variant='deload'` rows for this mesocycle is rejected
- Mesocycle with `has_deload=true` but no deload schedule rows yet: Deload tab shows all 7 days as unassigned
- Switching tabs while an assignment action is in progress: pending action completes before tab switch takes effect (or is cancelled cleanly)
- A template used on the Normal tab can also be used on the Deload tab (same template, different variant rows)
- Deload tab with all 7 days unassigned is valid (full deload rest week)

## Test Requirements
- Unit: `has_deload=false` → no Deload tab rendered, no deload rows accepted
- Unit: `has_deload=true` → Deload tab rendered
- Unit: mutations on Normal tab produce `variant='normal'` rows; mutations on Deload tab produce `variant='deload'` rows
- Integration: assign template on Deload tab → `weekly_schedule` row created with `variant='deload'`
- Integration: Normal and Deload assignments are independent — changing one does not affect the other
- Integration: attempt to create `variant='deload'` row on mesocycle with `has_deload=false` → rejected
- E2E: toggle between Normal and Deload tabs, assign different templates per day on each, verify independence
