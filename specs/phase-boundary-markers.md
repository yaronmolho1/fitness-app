# Phase Boundary Markers
**Status:** ready
**Epic:** Calendar & Progression
**Depends:** specs/exercise-progression-chart.md

## Description
As a coach, I can see mesocycle start and end boundaries marked on the progression chart so that I can see how phase transitions affected progress.

## Acceptance Criteria
- [ ] The `GET /api/progression` response includes a `phases` array alongside the data series
- [ ] Each entry in `phases` includes: mesocycle id, mesocycle name, `start_date` (`YYYY-MM-DD`), and `end_date` (`YYYY-MM-DD`)
- [ ] Only mesocycles that have at least one data point in the progression series are included in the `phases` array
- [ ] The chart renders a vertical marker line at each mesocycle `start_date` that falls within the chart's time range
- [ ] The chart renders a vertical marker line at each mesocycle `end_date` that falls within the chart's time range
- [ ] Each boundary marker is labeled with the mesocycle name
- [ ] Start and end boundary markers are visually distinguishable from each other (e.g. different line style or label position)
- [ ] Boundary markers do not obscure the data series lines or data points
- [ ] When only one mesocycle has data, one pair of start/end markers is shown
- [ ] When multiple mesocycles have data, each mesocycle contributes its own pair of start/end markers

## Edge Cases
- Single mesocycle with data: one start marker and one end marker shown
- Two adjacent mesocycles: end marker of first mesocycle and start marker of second mesocycle may be on the same or adjacent dates — both are rendered without overlap issues
- Mesocycle with `end_date` beyond today (active/planned): end marker is still rendered at the configured end date
- Exercise with data in only one session of a mesocycle: that mesocycle's boundaries are still shown
- No logged data for the selected exercise: no phase markers shown (empty state)

## Test Requirements
- Unit: `phases` array includes only mesocycles with at least one data point in the series
- Unit: `phases` entries include correct `start_date` and `end_date` for each mesocycle
- Integration: `GET /api/progression` response includes `phases` array with correct mesocycle boundary dates
- Integration: mesocycle with no matching data points is excluded from `phases`
- E2E: progression chart renders vertical boundary markers at mesocycle start and end dates
- E2E: each boundary marker displays the mesocycle name label
- E2E: multiple mesocycles → multiple pairs of boundary markers rendered correctly
