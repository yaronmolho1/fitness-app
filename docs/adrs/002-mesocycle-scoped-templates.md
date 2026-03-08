# ADR-002: Mesocycle-Scoped Templates (Option B+)

## Status
Accepted

## Context
Workout templates must be versioned so that plan changes cascade forward while logged history stays intact. The core tension: a user editing "Push A" week 6 should not corrupt what was actually logged in week 2, but should automatically propagate to weeks 7 onward. Multiple versioning strategies were considered, ranging from temporal validity windows to full inheritance hierarchies.

## Options Considered
- **Option A — Temporal versioning**: templates gain `valid_from` / `valid_to` date ranges; queries select the version active on a given date
- **Option B — Clone-per-phase**: each mesocycle gets its own copy of every template; linked by a `canonical_name` string slug for batch operations
- **Option C — Template inheritance**: a base template with per-phase overrides stored in a separate table
- **Option D — Hybrid (B + canonical_name batch edits)**: clone-per-phase with `canonical_name` enabling "edit all future copies at once" UX — selected as Option B+

## Decision
Option B+: templates are cloned per mesocycle, uniquely identified by auto-increment ID, and linked across phases by a `canonical_name` slug (e.g. `"push-a"`). A cascade edit finds sibling templates by querying `canonical_name` across active and planned mesocycles.

## Rationale
Oracle-validated. Temporal versioning requires complex date-range queries and becomes ambiguous when a user edits a template mid-phase. Clone-per-phase gives natural version boundaries at the mesocycle level — the same granularity users think in. The `canonical_name` string is sufficient to identify "the same logical template" across phases without a separate `template_groups` join table. Cascade UX lets the user pick the propagation scope (this phase / this + future / all), which makes the behavior transparent and controllable.

## Consequences
- (+) Clean cascade UX with clear version boundaries at phase level
- (+) Logged workouts remain immutable — they reference their snapshot, not the live template
- (+) Simple schema — no temporal query complexity, no inheritance join tables
- (+) Clone-on-create copies `canonical_name` to new templates automatically
- (-) Template storage grows linearly with the number of mesocycles (one copy per phase per template name)
- (-) `canonical_name` has no referential integrity — a typo breaks the cross-phase link (mitigated by deriving slug from template name at creation time)

## Implementation Notes
- `canonical_name` slugs are derived at template creation: lowercase, hyphenated, no special chars (e.g. "Push A" → `"push-a"`)
- Cascade query pattern: `SELECT * FROM workout_templates WHERE canonical_name = ? AND mesocycle_status IN ('active', 'planned')`
- Clone-on-create copies `canonical_name` verbatim — no slug transformation on clone
- Cascade never touches mesocycles with `status = 'completed'` or templates referenced by existing logs
