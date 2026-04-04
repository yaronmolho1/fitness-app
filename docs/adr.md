# Architecture Decision Records

Architecture decisions for the fitness tracking app. Each ADR captures the context, options considered, and rationale for a locked technical decision.

| # | Decision | Status |
|---|----------|--------|
| [001](adrs/001-sqlite.md) | SQLite over PostgreSQL | Accepted |
| [002](adrs/002-mesocycle-scoped-templates.md) | Mesocycle-Scoped Templates (Option B+) | Accepted |
| [003](adrs/003-deload-separate-schedule.md) | Deload as Separate Weekly Schedule | Accepted |
| [004](adrs/004-hybrid-api.md) | Hybrid API: Server Actions + Route Handlers | Accepted |
| [005](adrs/005-snapshot-plus-normalized.md) | JSON Snapshot + Normalized Tables for Logged Workouts | Accepted |
| [006](adrs/006-canonical-name.md) | canonical_name for Cross-Phase Template Linking | Accepted |
| [007](adrs/007-drizzle-v2-define-relations.md) | Drizzle v2 defineRelations API | Accepted |
| [008](adrs/008-modular-architecture.md) | Modular Architecture for Ecosystem Extensibility | Accepted |
| [009](adrs/009-time-slot-first-scheduling.md) | Time-Slot-First Scheduling (Replacing Period-Based Keying) | Accepted |
| [010](adrs/010-google-calendar-one-way-push.md) | Google Calendar Integration — One-Way Push with OAuth | Accepted |
| [011](adrs/011-exercise-slot-transfer.md) | Exercise Slot Transfer Between Templates | Proposed |
| [012](adrs/012-per-week-template-rotation.md) | Per-Week Template Rotation on Schedule Slots | Proposed |

## Reading Order

New to the codebase? Read in this order:

1. **ADR-001** — Why SQLite instead of the VPS's existing PostgreSQL
2. **ADR-002** — The core template versioning strategy (most complex decision)
3. **ADR-004** — Why mutations use Server Actions while reads use Route Handlers
4. **ADR-005** — Why logged workouts store both a JSON snapshot and normalized rows
5. **ADR-006** — How `canonical_name` links templates across mesocycles
6. **ADR-003**, **ADR-007**, **ADR-008** — Supporting decisions

See [docs/architecture.md](architecture.md) for the full system overview and component diagram.
