---
status: ready
epic: Running Templates
depends: running-templates, running-logging, interval-logging, run-distance-duration
---

# Elevation Gain for Running Workouts

## Description

Add an elevation gain field (meters, integer) across running templates and logging so coaches can plan hilly runs and athletes can record actual ascent — both at the overall workout level and per interval rep.

## Acceptance Criteria

1. **Given** the `workout_templates` table, **When** I inspect columns, **Then** `target_elevation_gain` (integer, nullable) exists.
2. **Given** the `template_sections` table, **When** I inspect columns, **Then** `target_elevation_gain` (integer, nullable) exists.
3. **Given** the `slot_week_overrides` table, **When** I inspect columns, **Then** `elevation_gain` (integer, nullable) exists for per-week override of target elevation.
4. **Given** the `template_week_overrides` table, **When** I inspect columns, **Then** `elevation_gain` (integer, nullable) exists for per-week section override.
5. **Given** I'm creating or editing a running template, **When** the form renders, **Then** I see a "Target Elevation Gain (m)" input field — visible for all run types.
6. **Given** I enter 150 in the elevation gain field and submit, **When** the template is saved, **Then** `target_elevation_gain = 150` is stored.
7. **Given** I edit a running template's `target_elevation_gain` inline, **When** I confirm, **Then** the cascade scope selector appears and updates propagate across selected phases.
8. **Given** a running template with `target_elevation_gain = 200`, **When** I view Today's planned workout, **Then** "200m" ascent appears in planned info.
9. **Given** I'm logging a running workout, **When** the logging form renders, **Then** I see an "Elevation Gain (m)" input field for the overall workout — visible for all run types.
10. **Given** I enter 180 in the elevation gain field and save, **When** I inspect `logged_workouts`, **Then** the `template_snapshot` JSON includes `actual_elevation_gain: 180`.
11. **Given** `run_type = interval`, **When** the interval logging section renders, **Then** each interval rep row includes an "Elevation Gain (m)" input field.
12. **Given** I log an interval run with per-rep elevation data, **When** I inspect the interval data JSON, **Then** each rep object includes `interval_elevation_gain` (integer or null).
13. **Given** I log a running workout, **When** I inspect `template_snapshot` JSON, **Then** `target_elevation_gain` from the planned template is included in the snapshot.
14. **Given** I create a mixed template with a running section, **When** I fill in the section form, **Then** the elevation gain input is available.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Elevation gain left empty | Stored as null — valid for all contexts |
| Negative elevation gain (template or log) | Validation error: "Elevation gain must be non-negative" |
| Zero elevation gain | Stored as 0 — valid (flat route) |
| Decimal elevation gain (e.g. 150.5) | Rounded to nearest integer or rejected — integer field |
| Non-interval run with elevation gain | Stored as total workout elevation |
| Interval run with per-rep elevation gain | Stored per rep in interval data JSON array |
| All interval reps have elevation blank | Save succeeds; `interval_elevation_gain` is null in each rep object |
| Template has no target_elevation_gain | Planned reference shows field as blank; logging form still renders elevation input |

## Test Requirements

- AC1-4: integration — verify columns exist after migration
- AC5: component — form renders elevation gain input with correct label and unit
- AC6: integration — create/update running template stores target_elevation_gain
- AC7: integration — cascade propagates elevation gain field
- AC8: component — display target elevation gain in today/logging planned info
- AC9: component — logging form renders elevation gain input for all run types
- AC10: integration — save running workout stores actual_elevation_gain in snapshot
- AC11-12: component + integration — interval rep rows include elevation gain; JSON structure correct
- AC13: integration — template_snapshot includes target_elevation_gain

## Dependencies

- `specs/running-templates.md` — extends running template fields
- `specs/running-logging.md` — extends logging form and snapshot
- `specs/interval-logging.md` — extends per-rep data structure
- `specs/run-distance-duration.md` — parallel pattern (same tables, same form areas)
- `specs/cascade-scope-selection.md` — cascade behavior for new field

## Out of Scope

- Elevation loss / total descent
- Elevation profile (per-km breakdown)
- GPS/auto-detection of elevation
- Unit conversion (feet)

## Open Questions

- None — follows established patterns from distance/duration fields.
