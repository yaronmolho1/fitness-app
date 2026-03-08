# ADR-001: SQLite over PostgreSQL

## Status
Accepted

## Context
This app is single-user, self-hosted on a VPS that already runs PostgreSQL for sibling apps (expense-tracker, tutor-ai). The fitness app needs a reliable, persistent database. The Docker app stack gives each app its own database — there is no shared DB constraint. The question is whether to use the existing PostgreSQL setup or choose a simpler embedded alternative.

## Options Considered
- **Option A — PostgreSQL**: consistent with sibling apps; battle-tested; already running on the VPS; supports full-text search and concurrent access
- **Option B — SQLite**: embedded, zero ops, no separate DB container; file-based storage with well-understood backup semantics; WAL mode provides read concurrency

## Decision
SQLite with WAL mode enabled via `journal_mode=WAL` pragma. Database file stored at `/app/data/db.sqlite`, persisted via a named Docker volume.

## Rationale
A single-user app has no concurrent write contention, which eliminates SQLite's primary weakness entirely. Running embedded eliminates the DB container, the network hop, and the connection pool. The OS page cache accelerates repeated reads on a low-traffic personal app far more than a PostgreSQL buffer pool would. File-based backups are trivially simple. The operational complexity savings are decisive for a personal tool with no multi-user or scaling requirements. Migrating to PostgreSQL later is viable if the app ever goes multi-user.

## Consequences
- (+) Zero ops overhead — no DB container to manage, no connection pool to configure
- (+) Fast reads for frequently accessed data hit OS page cache
- (+) Backups are a single file copy: `cp /app/data/db.sqlite backup.sqlite`
- (+) No network latency between app and database layer
- (-) No built-in full-text search (SQLite FTS5 extension not planned for V1)
- (-) Single writer at a time under WAL mode — acceptable for single user, not acceptable for multi-user
- (-) SQLite file is not shareable across Docker services without coordination

## Implementation Notes
Apply these 4 PRAGMAs at every connection init (in `lib/db/index.ts`):
- `PRAGMA journal_mode = WAL` — enables concurrent reads during writes
- `PRAGMA busy_timeout = 5000` — waits up to 5s before returning SQLITE_BUSY
- `PRAGMA synchronous = NORMAL` — safe with WAL; faster than FULL
- `PRAGMA foreign_keys = ON` — enforces FK constraints (SQLite disables them by default)
