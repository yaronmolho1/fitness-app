# ADR-005: JSON Snapshot + Normalized Tables for Logged Workouts

## Status
Accepted

## Context
When a workout is logged, two competing requirements must be satisfied simultaneously. First, the log must forever show exactly what was planned at the time of logging — even if the template is later edited or deleted. Second, logged data must be queryable with SQL for analytics: progression charts, volume tracking, personal records. These requirements pull in opposite directions: snapshots preserve fidelity but resist querying; normalized tables are queryable but become stale if they reference mutable templates.

## Options Considered
- **Option A — Snapshot JSON only**: store a single JSON blob containing the full template at log time; display is trivial; SQL analytics require JSON parsing which is awkward and slow for aggregations
- **Option B — Normalized tables only**: store logged data in relational rows (`logged_exercises`, `logged_sets`); queryable but cannot reconstruct the exact planned state after the template has been edited
- **Option C — Both**: at log time, create a `template_snapshot` JSON on `logged_workouts` and also insert normalized rows into `logged_exercises` and `logged_sets`; both created atomically in one transaction

## Decision
Option C: dual storage. The `template_snapshot` JSON (with a `version` field for future migration compatibility) is stored on `logged_workouts`. Simultaneously, normalized rows are inserted into `logged_exercises` and `logged_sets` for analytics queries.

## Rationale
For a single user whose data volume is small, the storage duplication is entirely acceptable. The snapshot gives a stable display source that never breaks when templates evolve. The normalized tables give clean SQL query targets for progression charts and volume tracking — no JSON parsing in hot analytical paths. The atomic transaction ensures the two representations are always consistent. The `version` field on the snapshot type allows schema evolution without re-parsing old records.

## Consequences
- (+) Snapshot ensures logged workout display is immutable and always accurate, regardless of future template edits
- (+) Normalized tables enable simple, efficient SQL aggregations for progression and volume analytics
- (+) Atomic transaction keeps both representations perfectly in sync
- (+) `version` field on snapshot type enables future migration from old snapshot formats
- (-) Data duplication — each logged workout stores the template twice (once as JSON, once as rows)
- (-) Log write path is more complex (must create snapshot + normalized rows in one transaction)
- (-) Storage grows faster than normalized-only approach (acceptable for single user)

## Implementation Notes
- The log write transaction must create `logged_workouts` (with snapshot JSON), then `logged_exercises`, then `logged_sets` in sequence
- Snapshot type must include `version: number` field (start at `1`); increment on any breaking shape change
- If snapshot type changes in future: migration script reads `version`, transforms old shape to new shape in place
- Logged records must never be UPDATEd or DELETEd — enforce at application layer (no DB-level trigger needed for single user)
