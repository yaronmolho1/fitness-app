# Explicit Rest Days
**Status:** ready
**Epic:** Weekly Schedule
**Depends:** specs/7-day-assignment-grid.md

## Description
As a coach, I can see rest days explicitly in the schedule and calendar views so that days with no template assigned are visible in the plan rather than simply absent.

## Acceptance Criteria
- [ ] A day with no `weekly_schedule` row (or a row with `template_id=NULL`) for the current mesocycle and variant is displayed as a rest day in the schedule grid
- [ ] Rest days are visually distinct from assigned days in the schedule grid (e.g. labelled "Rest" or shown with a distinct empty state)
- [ ] All 7 days are always shown in the schedule grid regardless of how many have template assignments
- [ ] A rest day in the schedule grid shows no template name
- [ ] In the calendar view, days that fall on a rest day (per the weekly schedule) are displayed as rest days, not as blank/missing entries
- [ ] Rest day display in the calendar is consistent with the schedule grid — same days are rest in both views
- [ ] A rest day can be converted to an assigned day by selecting a template from the assignment picker
- [ ] An assigned day can be converted back to a rest day by removing the template assignment
- [ ] Rest day state is derived from the absence of a `weekly_schedule` row (or `template_id=NULL`) — there is no separate "rest day" record
- [ ] Rest days apply independently per variant: a day can be a rest day on the Normal schedule but assigned on the Deload schedule

## Edge Cases
- All 7 days unassigned: entire week shows as rest days — valid state
- A mesocycle with no schedule rows at all: all 7 days shown as rest days in the grid
- Calendar view for a week where the mesocycle has not started yet: days still show rest vs assigned based on the schedule
- Deload tab with `has_deload=false`: no deload rest day display (Deload tab is hidden entirely per Normal vs Deload Tabs spec)
- A day that is a rest day on the Normal schedule but has a deload assignment: each variant's rest state is shown independently when viewing that variant's tab

## Test Requirements
- Unit: day with no `weekly_schedule` row renders as rest day
- Unit: day with `weekly_schedule` row present renders as assigned (not rest)
- Integration: remove template assignment from a day → day displays as rest in schedule grid
- Integration: assign template to a rest day → day displays as assigned
- Integration: calendar view reflects rest days from schedule grid for the same mesocycle and variant
- E2E: view schedule with mixed assigned and rest days; remove an assignment and verify rest day display; reassign and verify it reverts
