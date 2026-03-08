# ADR-007: Drizzle v2 defineRelations API

## Status
Accepted

## Context
Drizzle ORM has two relation definition APIs. The expense-tracker sibling app — the closest reference for this project's stack — uses the original `relations()` function introduced in early Drizzle versions. Drizzle's current documentation and v2 release recommend a new `defineRelations` API with improved type inference and configuration. The fitness app is a greenfield project and can adopt either pattern.

## Options Considered
- **Option A — Old `relations()` API**: matches the expense-tracker sibling exactly; patterns can be copied directly; API is stable and widely documented in older examples
- **Option B — New `defineRelations` API (v2)**: current library recommendation; improved type inference; cleaner syntax for complex relation configurations; documentation is the active target

## Decision
Option B: use the `defineRelations` API from Drizzle v2. Relations are defined in `lib/db/relations.ts` alongside the schema in `lib/db/schema.ts`.

## Rationale
New code should follow the library's current recommendation rather than a pattern from a sibling app that predates the API change. The old `relations()` API continues to work but is not the direction Drizzle is investing in. Adopting `defineRelations` now avoids a future migration and keeps the fitness app's Drizzle usage aligned with current documentation, community examples, and future library updates.

## Consequences
- (+) Follows current library direction — less risk of deprecated API removal
- (+) Better type inference on relation queries in v2
- (+) Active documentation target — easier to find help for v2 API
- (-) Cannot directly copy relation definitions from expense-tracker (API shape is different)
- (-) Early v2 patterns may have fewer community examples than the original `relations()` API

## Implementation Notes
- Relations are defined in `lib/db/relations.ts` using `defineRelations(schema, (r) => ({ ... }))`
- Do NOT copy the `relations()` import/pattern from the expense-tracker sibling — the v2 API shape is different
- Drizzle query builder uses the relations config for `with:` eager loading — requires the relations to be passed to `drizzle()` init
- See current Drizzle v2 docs at https://orm.drizzle.team/docs/relations for the exact API shape
