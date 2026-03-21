---
status: ready
epic: Running Templates
depends: running-templates
---

# Run Distance/Duration on Templates

## Description

Add target distance (km) and duration (minutes) fields to running templates so users can plan workouts like "5km easy" or "30min tempo". Both fields visible, user picks which to fill. For interval runs, values are per-rep.

## Acceptance Criteria

1. **Given** the workout_templates table, **When** I inspect columns, **Then** `target_distance` (real, nullable) and `target_duration` (integer, nullable) exist.
2. **Given** the template_sections table, **When** I inspect columns, **Then** same two columns exist.
3. **Given** I'm creating a running template, **When** the form renders, **Then** I see "Target Distance (km)" and "Target Duration (min)" inputs.
4. **Given** run_type is "interval", **When** I see the labels, **Then** they show "(per rep)" suffix.
5. **Given** I enter 5.0 in distance and submit, **Then** the template is created with target_distance=5.0.
6. **Given** I edit a running template inline, **When** I change target_distance, **Then** the cascade scope selector appears.
7. **Given** I confirm cascade, **Then** target_distance updates across selected phases.
8. **Given** a running template with target_distance=10, **When** I view Today page, **Then** "10km" appears in planned info.
9. **Given** I'm logging a running workout with target_distance=5, **When** the logging form renders, **Then** planned target "5km" is shown in reference section.
10. **Given** I log a running workout, **When** I inspect template_snapshot JSON, **Then** target_distance and target_duration are included.
11. **Given** I create a mixed template with a running section, **When** I fill in the section form, **Then** distance/duration inputs are available.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Both distance and duration left empty | Template created with both null — valid |
| Both distance and duration filled | Both stored — no conflict |
| Negative distance | Validation error: "Distance must be positive" |
| Zero duration | Validation error: "Duration must be positive" |
| Non-interval run with distance | Stored as total session distance |
| Interval run with distance | Stored and labeled as per-rep distance |

## Test Requirements

- AC1-2: integration — verify columns exist after migration
- AC3-4: component — form renders inputs with correct labels
- AC5: integration — createRunningTemplate stores values
- AC6-7: integration — cascade propagates new fields
- AC8-9: component — display in today/logging views
- AC10: integration — snapshot includes fields
- AC11: component — mixed template section form

## Dependencies

- `specs/running-templates.md` — extends running template with new fields
- `specs/cascade-scope-selection.md` — cascade behavior for new fields

## Out of Scope

- Unit conversion (miles) — km only for V1
- Pace calculator from distance + duration
