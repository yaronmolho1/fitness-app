# ADR-006: canonical_name for Cross-Phase Template Linking

## Status
Accepted

## Context
Mesocycle-scoped templates (ADR-002) give each phase its own copy of every template, identified by a unique auto-increment ID. This breaks the connection between "Push A in Mesocycle 1" and "Push A in Mesocycle 2" — there is no foreign key linking them. Two things need this cross-phase connection: (1) cascade edits (propagate a change to all future copies), and (2) progression queries (chart the same exercise's history across phases).

## Options Considered
- **Option A — template_groups table**: a new join table where each row represents a named group; templates FK into this table; cross-phase queries join through it
- **Option B — canonical_name slug on workout_templates**: a text slug (e.g. `"push-a"`) stored directly on each template; cross-phase queries filter `WHERE canonical_name = ?` across the relevant mesocycles

## Decision
Option B: a `canonical_name` text column on `workout_templates`. The slug is derived from the template name at creation time and copied verbatim when templates are cloned into a new mesocycle.

## Rationale
A join table adds schema complexity and a mandatory join on every cross-phase query without providing meaningful additional capability for a single-user app. The `canonical_name` slug is sufficient — querying `WHERE canonical_name = 'push-a' AND mesocycle_status IN ('active', 'planned')` is a simple, readable query with no joins. The user creates all data, so referential integrity enforcement on the string is unnecessary. Clone-on-create copies the slug automatically, so the user never manually manages cross-phase links.

## Consequences
- (+) No extra table, no extra join in cross-phase queries
- (+) Human-readable slug makes debugging and raw SQL queries easy
- (+) Clone-on-create propagates the slug automatically — zero user effort
- (-) No referential integrity — a manual slug edit would silently break cross-phase linking
- (-) Case sensitivity and formatting must be normalized at slug creation (lowercase, hyphenated) to avoid spurious mismatches
- (-) Renaming a template across all phases requires updating the slug on all copies, not just the group record

## Implementation Notes
- Slug format: lowercase, hyphens only, no special chars — generated from template name at create time
  - Example: `"Push A (Main)"` → `"push-a-main"`
- Slug is set once at creation and should not change; template display name can be updated independently
- Cross-phase cascade query: `WHERE canonical_name = :slug AND mesocycleId IN (SELECT id FROM mesocycles WHERE status != 'completed')`
- On clone-on-create: copy `canonical_name` from source template row to new row without modification
