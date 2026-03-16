# Projected Calendar
**Status:** done
**Epic:** Calendar & Progression
**Depends:** specs/7-day-assignment-grid.md

## Description
As a coach, I can view a month calendar showing which workout is planned for each day, color-coded by modality, so that I can validate my plan at a glance.

## Acceptance Criteria
- [ ] `GET /api/calendar` Route Handler returns projected calendar data — per ADR-004
- [ ] The endpoint accepts a `month` query parameter (format: `YYYY-MM`) to specify which month to display
- [ ] The response includes one entry per calendar day in the requested month
- [ ] Each day entry includes: date (text, `YYYY-MM-DD`), template name, modality, and mesocycle id
- [ ] Days with no template assigned (rest days) are included in the response with a null template and null modality
- [ ] Calendar projection is derived by iterating each day in the month, computing which week of which mesocycle it falls in, and reading the corresponding `weekly_schedule` row
- [ ] The weekly schedule is applied by matching `day_of_week` (0=Monday … 6=Sunday) to the calendar date's day of week
- [ ] Only mesocycles whose date range overlaps the requested month are included in the projection
- [ ] When multiple mesocycles overlap a single month, each day is assigned to the mesocycle whose date range contains that date
- [ ] Days that fall outside all mesocycle date ranges are returned as rest days (no template)
- [ ] The UI renders a month grid with 7 columns (Mon–Sun) and the correct number of rows for the month
- [ ] Each day cell displays the template name when a workout is assigned
- [ ] Resistance workouts are color-coded with the resistance modality color
- [ ] Running workouts are color-coded with the running modality color
- [ ] MMA/BJJ workouts are color-coded with the MMA modality color
- [ ] Rest days display no color coding and no template name
- [ ] The three modality colors are visually distinct from each other and from the rest-day state
- [ ] The calendar includes navigation controls to move to the previous and next month
- [ ] The current month is the default view on initial load
- [ ] The calendar is accessible from the main navigation

## Edge Cases
- Month with no mesocycles active: all days render as rest days
- Month where a mesocycle starts mid-month: days before the start date are rest days; days from start date onward follow the schedule
- Month where a mesocycle ends mid-month: days after the end date are rest days; days up to the end date follow the schedule
- Two mesocycles with adjacent date ranges in the same month: each day is assigned to the correct mesocycle with no gap or overlap
- Mesocycle with no `weekly_schedule` rows: all days within that mesocycle's range render as rest days
- A day that falls on a `day_of_week` with no template assigned in the schedule: renders as rest day
- February in a leap year: 29 days rendered correctly
- Month boundary: first and last days of the month are included

## Test Requirements
- Unit: projection logic maps each date to the correct mesocycle and `day_of_week` row
- Unit: days outside all mesocycle ranges return null template
- Unit: multiple mesocycles in one month — each day resolves to the correct mesocycle
- Unit: mesocycle starting mid-month — days before start are rest days
- Unit: mesocycle ending mid-month — days after end are rest days
- Integration: `GET /api/calendar?month=YYYY-MM` returns correct shape with one entry per day
- Integration: modality field on each day entry matches the assigned template's modality
- Integration: rest days have null template and null modality in response
- E2E: month grid renders with correct template names and modality colors per day
- E2E: navigating to previous/next month updates the grid
