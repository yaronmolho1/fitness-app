# Architecture Documentation — Work Plan

## TL;DR

> **Quick Summary**: Write the formal architecture doc (`docs/architecture.md`) and 8 individual ADR files (`docs/adrs/001-*.md` through `008-*.md`) plus an ADR index file. All architecture decisions are already locked — this is documentation work, not design work.
> 
> **Deliverables**:
> - `docs/architecture.md` — System overview, component diagram, data model, API boundaries, auth, infrastructure, tradeoffs
> - `docs/adrs/001-sqlite.md` through `docs/adrs/008-modular-architecture.md` — Individual decision records
> - `docs/adr.md` — Index file pointing to individual ADRs (resolves conflict with existing work plan Task 0)
> 
> **Estimated Effort**: Short
> **Parallel Execution**: YES — 2 waves (architecture doc + ADRs in parallel)
> **Critical Path**: T1 + T2 (parallel) → done

---

## Context

### Original Request
Tech-design skill triggered to produce formal architecture documentation. The PRD exists (`docs/prd.md`), a comprehensive work plan exists (`.sisyphus/plans/fitness-app.md`), and all architecture decisions are locked. What's missing: a formal `docs/architecture.md` and individual ADR files.

### Interview Summary
**Key Discussions**:
- All major decisions already made in prior planning session (SQLite, Next.js 16, Drizzle v2, JWT auth, mesocycle-scoped templates)
- 3 open questions from PRD resolved during interview: interval storage (JSON array), uniform intervals (V1), one-step clone
- ADR-004 revised: Hybrid approach (Server Actions for mutations, Route Handlers for computed reads)

**Research Findings**:
- wger (5.7k stars): validates plan/log separation, actual+target storage pattern, progression config system
- FitTrackee (1k stars): materialized records table for PRs (V2 pattern)
- expense-tracker sibling: canonical Next.js pattern for the docker-app-stack
- Docker infrastructure: nginx proxy, shared app-network, per-app databases, standalone-first design

### Metis Review
**Identified Gaps** (addressed):
- Task 0 conflict: existing plan creates single `docs/adr.md` → resolved by creating individual ADR files + `docs/adr.md` as an index
- ADR-004 discrepancy: work plan uses Route Handlers everywhere, architecture doc documents hybrid → architecture doc is design intent, work plan is execution
- Port allocation: standalone=3000, orchestrated=3002 (expense-tracker=3001)
- Diagram format: Mermaid (GitHub-renderable)
- Interview decisions (interval storage, uniform intervals, clone flow): stay in architecture.md, NOT separate ADRs. Keep 8 ADRs.
- Architecture.md audience: executor agents + user review. Reference doc, not tutorial.

---

## Work Objectives

### Core Objective
Create authoritative architecture documentation that serves as the design reference for the fitness app implementation.

### Concrete Deliverables
- `docs/architecture.md` (200-350 lines)
- `docs/adrs/001-sqlite.md` through `docs/adrs/008-modular-architecture.md` (30-60 lines each)
- `docs/adr.md` (index file, ~30 lines)

### Definition of Done
- [ ] `wc -l docs/architecture.md` → 200-350 lines
- [ ] `ls docs/adrs/ | wc -l` → 8 files
- [ ] `grep -c "TODO\|PLACEHOLDER\|TBD" docs/architecture.md docs/adrs/*.md docs/adr.md` → 0
- [ ] All ADR numbers referenced in architecture.md have matching files
- [ ] No column-level schema detail in architecture.md (table-level only)

### Must Have
- System overview (1 paragraph)
- Mermaid component diagram showing major components and data flow
- Data model: 10 tables with relationships and purpose (NOT column definitions)
- API boundary map: Server Actions (mutations) vs Route Handlers (reads)
- Auth strategy: JWT, jose, Edge-compatible middleware
- Infrastructure: Docker, SQLite volume, nginx proxy, standalone + orchestrated modes
- Key tradeoffs: what was optimized vs sacrificed
- All 8 ADRs as individual files with context + options + decision + rationale

### Must NOT Have (Guardrails)
- NO column-level schema detail (Task 2 owns schema — architecture.md shows relationships only)
- NO API endpoint catalog (api-standards.md from Task 0 owns this)
- NO deployment runbook (dev-workflow.md from Task 0 owns this)
- NO speculative V2 architecture (ADR-008 documents extensibility hooks, not future features)
- NO code implementations in ADRs (illustrative snippets OK, no copy-pasteable code)
- NO comparison matrices in ADRs (1-2 sentences per alternative, not research papers)
- NO sequence diagrams beyond 2-3 key flows
- NO duplicate of PRD content (reference docs/prd.md)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: N/A (documentation only)
- **Automated tests**: NO
- **Framework**: N/A

### QA Policy
Every task includes agent-executed verification via grep/wc/file existence checks.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — both tasks in parallel):
├── Task 1: Write docs/architecture.md [writing]
└── Task 2: Write docs/adrs/001-*.md through 008-*.md + docs/adr.md index [writing]

Wave FINAL (After ALL tasks):
├── Task F1: Cross-reference validation [quick]
└── Task F2: Scope fidelity check [quick]

Critical Path: T1 + T2 (parallel) → F1 + F2 (parallel)
Max Concurrent: 2
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 | — | F1, F2 |
| 2 | — | F1, F2 |
| F1 | 1, 2 | — |
| F2 | 1, 2 | — |

### Agent Dispatch Summary

- **Wave 1**: 2 tasks — T1→`writing`, T2→`writing`
- **Final**: 2 tasks — F1→`quick`, F2→`quick`

---

## TODOs

- [ ] 1. Write `docs/architecture.md`

  **What to do**:
  Create the formal architecture document following the template below. This is a REFERENCE document — concise, scannable, no prose walls.

  **Section-by-section content guide**:

  **## System Overview** (1 paragraph)
  A personal fitness planning + logging app replacing a 4-sheet Excel system. Single user (coach + athlete contexts). Desktop for mesocycle planning/template editing/progression review. Mobile for post-workout logging. Core innovation: plan changes cascade automatically while logged history stays immutable. Built with Next.js 16, SQLite, deployed via Docker on VPS.

  **## Component Diagram** (Mermaid)
  Show these components and their interactions:
  ```
  Browser (Desktop/Mobile)
    ↕ HTTPS (nginx reverse proxy)
  Next.js App (App Router)
    ├── Server Components (data fetching, auth checks)
    ├── Client Components (forms, interactivity)
    ├── Server Actions (mutations: CRUD operations)
    ├── Route Handlers (computed reads: /api/calendar, /api/progression, /api/today, /api/health)
    └── Middleware (JWT validation, route protection)
  SQLite Database (WAL mode, volume-mounted)
    └── Drizzle ORM (schema, migrations, type-safe queries)
  ```
  Use Mermaid `graph TD` or `C4Context` format. Include the Docker container boundary and nginx proxy.

  **## Data Model** (table-level relationships only)
  Show the 10 tables with their PURPOSE and RELATIONSHIPS. Do NOT list columns.
  ```
  PLANNING LAYER (mutable, editable):
    exercises ──< exercise_slots >── workout_templates ──< mesocycles
    weekly_schedule ──< mesocycles (+ workout_templates FK)
    routine_items (scoped to mesocycle or global)

  LOGGING LAYER (immutable after save):
    logged_workouts ──< logged_exercises ──< logged_sets
    routine_logs ──< routine_items

  CROSS-LAYER LINKS:
    workout_templates.canonical_name ←→ logged_workouts.canonical_name (string match, not FK)
    logged_workouts.template_snapshot (JSON) ← frozen copy of template at log time
  ```
  Use Mermaid `erDiagram` format. Show cardinalities (1:N, N:M). Include a 1-sentence purpose per table. Reference `lib/db/schema.ts` for column details.

  **## API Boundaries** (hybrid pattern)
  Create a decision matrix table:
  | Pattern | Used For | Examples |
  | Server Actions | Form mutations (CRUD) | Create exercise, update template, log workout, clone mesocycle, cascade edit |
  | Route Handlers | Computed reads, health, future external consumers | GET /api/calendar, /api/progression, /api/today, /api/health |

  List the 6-7 domain groups: Auth, Exercises, Mesocycles, Templates+Slots, Schedule, Logging, Routines, Calendar/Progression. For each: 1-sentence responsibility. Reference `docs/api-standards.md` for response format and status codes.

  **## Auth Strategy**
  - Single user, credentials from env vars (AUTH_USERNAME, AUTH_PASSWORD_HASH)
  - JWT via `jose` (Edge-compatible) — no `better-sqlite3` in middleware
  - Login page at `/login`, JWT cookie (httpOnly, secure, sameSite=lax)
  - Middleware protects all routes except `/login` and `/api/auth/*`
  - No registration, OAuth, or database-stored users
  - Reference ADR: docs/adrs/004-hybrid-api.md (auth section)

  **## Infrastructure Decisions**
  - Docker: node:20-alpine, pnpm, standalone output. Volume mount for SQLite at `/app/data/`
  - Ports: standalone=3000, orchestrated=3002 (expense-tracker=3001)
  - Reverse proxy: nginx in docker-app-stack, shared `app-network`
  - Database: SQLite with WAL mode + 4 PRAGMAs. No separate DB container.
  - Backups: Copy SQLite file (V1). Automated backup script (V2).
  - Monitoring: Health endpoint at `/api/health`. No centralized monitoring (V1).
  - CI/CD: Not in V1 scope.
  - Migrations: `drizzle-kit generate` + `drizzle-kit migrate`. Never `push`.

  **## Key Tradeoffs**
  List 5-6 explicit tradeoffs:
  - Optimized for: single-user simplicity → Sacrificed: multi-user scalability
  - Optimized for: plan/log separation → Sacrificed: edit-after-save flexibility
  - Optimized for: cascade UX → Sacrificed: schema simplicity (canonical_name linking)
  - Optimized for: mobile logging speed → Sacrificed: desktop logging UX
  - Optimized for: SQLite simplicity → Sacrificed: concurrent access, full-text search
  - Optimized for: hybrid API → Sacrificed: uniform testing approach (Server Actions harder to curl)

  **## Open Questions (V2)**
  - Variable-distance intervals (ladders) — currently uniform only
  - Materialized PR records table (FitTrackee pattern)
  - LLM-assisted progression (wger's `class_name` escape hatch pattern)
  - Ecosystem integration (fitness as module in life management system)
  - Reference ADR-008 for extensibility hooks

  **Must NOT do**:
  - No column-level schema detail (reference lib/db/schema.ts)
  - No API endpoint catalog (reference docs/api-standards.md)
  - No deployment runbook (reference docs/dev-workflow.md)
  - No V2 feature design
  - Max 350 lines

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: F1, F2
  - **Blocked By**: None

  **References**:
  - `docs/prd.md` — Full PRD with story map, audience segments, V1 scope
  - `.sisyphus/plans/fitness-app.md` — Comprehensive work plan with all decisions, schema details, Oracle recommendations
  - `.sisyphus/drafts/architecture.md` — Interview draft with research findings and resolved questions
  - `.sisyphus/drafts/prd-draft.md` — PRD interview notes with market research, running log upgrade details
  - `apps/expense-tracker/` — Sibling app for pattern reference (Next.js 16, Drizzle, shadcn, JWT)

  **Acceptance Criteria**:
  - [ ] `docs/architecture.md` exists
  - [ ] `wc -l docs/architecture.md` → 200-350 lines
  - [ ] Contains all 7 sections: Overview, Component Diagram, Data Model, API Boundaries, Auth, Infrastructure, Tradeoffs
  - [ ] Mermaid diagrams render correctly (valid syntax)
  - [ ] References ADRs by number (grep finds ADR-001 through ADR-008)
  - [ ] No column-level detail: `grep -c "exerciseId\|muscleGroup\|intervalCount\|prescribedReps\|actualAvgHr" docs/architecture.md` → 0
  - [ ] No placeholders: `grep -c "TODO\|TBD\|PLACEHOLDER" docs/architecture.md` → 0

  **QA Scenarios**:
  ```
  Scenario: Architecture doc structure and length
    Tool: Bash
    Steps:
      1. wc -l docs/architecture.md
      2. grep -c "^## " docs/architecture.md
      3. grep -c "TODO\|TBD\|PLACEHOLDER" docs/architecture.md
    Expected Result: 200-350 lines, ≥7 H2 headers, 0 placeholders
    Evidence: .sisyphus/evidence/task-1-architecture-structure.txt

  Scenario: ADR cross-references valid
    Tool: Bash
    Steps:
      1. grep -oP 'ADR-\d+' docs/architecture.md | sort -u | wc -l
    Expected Result: ≥ 3 unique ADR references
    Evidence: .sisyphus/evidence/task-1-adr-references.txt

  Scenario: No column-level schema leak
    Tool: Bash
    Steps:
      1. grep -ciE "exerciseId|muscleGroup|intervalCount|prescribedReps|actualAvgHr|templateSnapshot|canonicalName|orderIndex|scopeType" docs/architecture.md
    Expected Result: 0 matches (canonical_name is OK as a concept reference, canonicalName camelCase is a column name — reject)
    Evidence: .sisyphus/evidence/task-1-no-column-leak.txt

  Scenario: Mermaid syntax valid
    Tool: Bash
    Steps:
      1. grep -c "```mermaid" docs/architecture.md
    Expected Result: ≥ 2 mermaid blocks (component diagram + ER diagram)
    Evidence: .sisyphus/evidence/task-1-mermaid-blocks.txt
  ```

  **Commit**: YES (grouped with Task 2)
  - Message: `docs: add architecture doc + individual ADRs`
  - Files: `docs/architecture.md, docs/adr.md, docs/adrs/*`

- [ ] 2. Write Individual ADR Files + Index

  **What to do**:
  Create `docs/adrs/` directory with 8 individual ADR files plus `docs/adr.md` as an index. Each ADR follows a consistent MADR-lite format.

  **ADR Template** (use for all 8):
  ```markdown
  # ADR-NNN: Title

  ## Status
  Accepted

  ## Context
  [2-3 sentences: what problem or decision point existed]

  ## Options Considered
  - **Option A**: [1 sentence description]
  - **Option B**: [1 sentence description]
  - **Option C**: [1 sentence description] (if applicable)

  ## Decision
  [1-2 sentences: what was chosen]

  ## Rationale
  [2-4 sentences: why this option wins for this context]

  ## Consequences
  - [Positive consequence]
  - [Negative consequence / tradeoff accepted]
  ```

  **ADR Content Guide** (each ADR 30-60 lines):

  **`docs/adrs/001-sqlite.md`** — SQLite over PostgreSQL
  - Context: Single-user app deployed on VPS. Docker app stack has PostgreSQL for expense-tracker and tutor-ai.
  - Options: (A) PostgreSQL — consistent with sibling apps, (B) SQLite — embedded, zero ops
  - Decision: SQLite with WAL mode
  - Rationale: Single user = no concurrent write contention. Embedded = no DB container. File-based backups. Operational simplicity. Switch to PG if multi-user needed.
  - Consequences: (+) Zero ops overhead, fast reads hit OS page cache. (-) No full-text search, limited concurrent writes, not shareable with other services.

  **`docs/adrs/002-mesocycle-scoped-templates.md`** — Mesocycle-Scoped Templates (Option B+)
  - Context: Need versioning for workout templates so plan changes cascade but history stays intact.
  - Options: (A) Temporal versioning with valid_from/valid_to, (B) Clone-per-phase with canonical_name linking, (C) Template inheritance/overrides, (D) Hybrid
  - Decision: Option B+ — templates cloned per mesocycle, linked by canonical_name string
  - Rationale: Oracle-validated. Natural version boundaries at phase level. Simpler than temporal versioning. canonical_name enables batch edits without a separate template_groups table.
  - Consequences: (+) Clean cascade UX, simple schema. (-) Template storage grows linearly with mesocycles (acceptable for single user).

  **`docs/adrs/003-deload-separate-schedule.md`** — Deload as Separate Weekly Schedule
  - Context: Deload weeks need different workout structure — fewer sessions, different exercises, not just lighter loads.
  - Options: (A) Per-exercise deload modifiers (skip_on_deload, deload_percentage), (B) Separate weekly schedule with dedicated deload templates
  - Decision: Option B — separate schedule + dedicated templates
  - Rationale: Deload is drastic. Per-exercise modifiers can't handle removing entire sessions or swapping exercises entirely. Separate templates eliminate conditional merge logic.
  - Consequences: (+) Clean separation, deload templates are first-class. (-) More templates to manage (mitigated by clone-on-create).

  **`docs/adrs/004-hybrid-api.md`** — Hybrid API: Server Actions + Route Handlers
  - Context: Need to decide how the app handles mutations (create, update, delete) and reads (calendar projection, progression data, today's workout).
  - Options: (A) Route Handlers only — consistent with expense-tracker sibling app, (B) Server Actions only — minimal boilerplate, (C) Hybrid — Server Actions for mutations, Route Handlers for reads
  - Decision: Option C — Hybrid
  - Rationale: Server Actions save boilerplate on 15+ mutation operations (automatic revalidation, end-to-end type safety). Route Handlers needed for computed views (calendar, progression) that may become V2 API endpoints for LLM/Garmin consumers. Health check requires Route Handler.
  - Consequences: (+) Less boilerplate, V2-ready API surface. (-) Two patterns to understand, Server Actions harder to test with curl.
  - **Note**: This supersedes the original decision in the work plan (`.sisyphus/plans/fitness-app.md`) which specified Route Handlers only. Implementation tasks in the work plan may still reference Route Handlers — the hybrid approach is the intended architecture.

  **`docs/adrs/005-snapshot-plus-normalized.md`** — JSON Snapshot + Normalized Tables for Logged Workouts
  - Context: Logged workouts must be immutable and show exactly what was planned. But also need analytics queries (progression charts, volume tracking).
  - Options: (A) Snapshot JSON only — simple but no structured queries, (B) Normalized tables only — queryable but can't reconstruct planned state after template edits, (C) Both — snapshot for display, normalized for analytics
  - Decision: Option C — both created at log time
  - Rationale: Snapshot JSON (with version field for future migrations) preserves the exact planned state. Normalized logged_exercises + logged_sets tables enable SQL queries for progression charts and volume tracking. Both created atomically in a transaction.
  - Consequences: (+) Best of both worlds. (-) Data duplication (acceptable for single user, data volume is small).

  **`docs/adrs/006-canonical-name.md`** — canonical_name for Cross-Phase Template Linking
  - Context: Need to identify "the same logical template" across mesocycles for cascade edits and progression tracking.
  - Options: (A) template_groups table with FK, (B) Stable string slug on workout_templates (canonical_name)
  - Decision: Option B — canonical_name string
  - Rationale: A simple slug (e.g., "push-a") is sufficient for single-user batch queries. No join table overhead. Clone-on-create copies the canonical_name to the new template. Cascade finds targets by querying canonical_name + future mesocycle status.
  - Consequences: (+) Simple, no extra tables. (-) No referential integrity on the link (acceptable — user creates all data).

  **`docs/adrs/007-drizzle-v2-define-relations.md`** — Drizzle v2 defineRelations API
  - Context: Drizzle ORM has two relation definition APIs. The expense-tracker sibling app uses the old `relations()` pattern. Drizzle's current recommendation is the new `defineRelations` API.
  - Options: (A) Old `relations()` pattern (matches expense-tracker), (B) New `defineRelations` v2 API (current recommendation)
  - Decision: Option B — defineRelations
  - Rationale: Following current library recommendation. The old API works but may be deprecated. New code should use the recommended pattern even if sibling app hasn't migrated yet.
  - Consequences: (+) Future-proof, follows library direction. (-) Can't directly copy relation patterns from expense-tracker.

  **`docs/adrs/008-modular-architecture.md`** — Modular Architecture for Ecosystem Extensibility
  - Context: Fitness app is one building block in a planned "second brain / life management" system. Architecture must support future integration without current over-engineering.
  - Options: (A) Monolithic — build everything in one app, extract later, (B) Microservices — separate services from day 1, (C) Modular monolith — clean domain boundaries, API-first, extractable
  - Decision: Option C — modular monolith
  - Rationale: Single-user app doesn't need microservices overhead. But clean domain boundaries (exercises, mesocycles, logging, routines) and API-first design enable future extraction. Daily routines are already designed as a generic habit tracker (extensible beyond fitness).
  - Consequences: (+) Future-ready without current complexity. (-) Requires discipline to maintain boundaries (easy to shortcut across domains in a monolith).
  - **Extensibility hooks (document these, don't design V2)**:
    - Daily routines → generic habit/tracking module
    - Exercise library → shared reference data
    - Health endpoint → ecosystem health aggregation
    - Route Handlers → external API consumers

  **`docs/adr.md`** — Index file:
  ```markdown
  # Architecture Decision Records

  | # | Decision | Status |
  |---|----------|--------|
  | [001](adrs/001-sqlite.md) | SQLite over PostgreSQL | Accepted |
  | [002](adrs/002-mesocycle-scoped-templates.md) | Mesocycle-Scoped Templates (Option B+) | Accepted |
  | [003](adrs/003-deload-separate-schedule.md) | Deload as Separate Weekly Schedule | Accepted |
  | [004](adrs/004-hybrid-api.md) | Hybrid API: Server Actions + Route Handlers | Accepted |
  | [005](adrs/005-snapshot-plus-normalized.md) | JSON Snapshot + Normalized Tables | Accepted |
  | [006](adrs/006-canonical-name.md) | canonical_name for Cross-Phase Linking | Accepted |
  | [007](adrs/007-drizzle-v2-define-relations.md) | Drizzle v2 defineRelations API | Accepted |
  | [008](adrs/008-modular-architecture.md) | Modular Architecture for Ecosystem | Accepted |
  ```

  **Must NOT do**:
  - No code implementations in ADRs (illustrative pseudocode OK, no copy-pasteable code)
  - No comparison matrices (1-2 sentences per option)
  - No more than 60 lines per ADR
  - ADR-008 must NOT design V2 features — only document extensibility hooks

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: F1, F2
  - **Blocked By**: None

  **References**:
  - `.sisyphus/plans/fitness-app.md` — Task 0 section with all 8 ADR decisions and rationale
  - `.sisyphus/drafts/architecture.md` — Interview draft with research findings
  - `docs/prd.md` — V1 scope and out-of-scope items
  - Oracle's schema recommendation (in fitness-app.md Context section)

  **Acceptance Criteria**:
  - [ ] `docs/adrs/` directory exists with 8 .md files
  - [ ] `docs/adr.md` exists as index
  - [ ] Each ADR has: Status, Context, Options, Decision, Rationale, Consequences sections
  - [ ] ADR-004 says "Hybrid" not "API routes over Server Actions"
  - [ ] ADR-008 does NOT contain V2 feature design (grep for specific V2 features should return 0)
  - [ ] Each ADR is 30-60 lines: `wc -l docs/adrs/*.md`
  - [ ] No placeholders: `grep -c "TODO\|TBD" docs/adrs/*.md docs/adr.md` → 0

  **QA Scenarios**:
  ```
  Scenario: All 8 ADR files exist with correct naming
    Tool: Bash
    Steps:
      1. ls docs/adrs/
      2. wc -l docs/adrs/*.md
    Expected Result: 8 files, each 30-60 lines
    Evidence: .sisyphus/evidence/task-2-adr-files.txt

  Scenario: ADR-004 reflects hybrid decision
    Tool: Bash
    Steps:
      1. grep -i "hybrid" docs/adrs/004-hybrid-api.md
      2. grep -c "API routes over Server Actions" docs/adrs/004-hybrid-api.md
    Expected Result: Step 1 finds "hybrid", Step 2 returns 0
    Evidence: .sisyphus/evidence/task-2-adr004-hybrid.txt

  Scenario: ADR-008 has no V2 feature design
    Tool: Bash
    Steps:
      1. grep -ciE "garmin|strava|nutrition|LLM.coach|auto.progress" docs/adrs/008-modular-architecture.md
    Expected Result: 0 matches (may mention these as future items, but no design)
    Evidence: .sisyphus/evidence/task-2-adr008-no-v2.txt

  Scenario: Index file references all ADRs
    Tool: Bash
    Steps:
      1. grep -c "adrs/00" docs/adr.md
    Expected Result: 8 references
    Evidence: .sisyphus/evidence/task-2-index-complete.txt
  ```

  **Commit**: YES (grouped with Task 1)
  - Message: `docs: add architecture doc + individual ADRs`
  - Files: `docs/architecture.md, docs/adr.md, docs/adrs/*`

---

## Final Verification Wave

- [ ] F1. **Cross-Reference Validation** — `quick`
  Verify all ADR numbers mentioned in architecture.md have corresponding files in docs/adrs/. Verify architecture.md doesn't contradict docs/prd.md on scope or features. Check that docs/adr.md index lists all 8 ADR files.
  Output: `References [N/N valid] | Contradictions [0/N] | VERDICT`

- [ ] F2. **Scope Fidelity Check** — `quick`
  Verify no column-level schema details leaked into architecture.md (grep for field names like exerciseId, muscleGroup, intervalCount). Verify no V2 feature design in ADR-008. Verify total line counts within bounds.
  Output: `Architecture [200-350 lines] | ADRs [30-60 each] | No column leak [PASS/FAIL] | VERDICT`

---

## Commit Strategy

- **T1+T2**: `docs: add architecture doc + individual ADRs`
  - Files: `docs/architecture.md, docs/adr.md, docs/adrs/001-*.md through 008-*.md`

---

## Success Criteria

### Verification Commands
```bash
wc -l docs/architecture.md                    # Expected: 200-350
ls docs/adrs/*.md | wc -l                     # Expected: 8
wc -l docs/adr.md                             # Expected: 20-40
grep -c "TODO\|TBD\|PLACEHOLDER" docs/architecture.md docs/adrs/*.md docs/adr.md  # Expected: 0
grep -c "ADR-00" docs/architecture.md         # Expected: ≥3
```

### Final Checklist
- [ ] Architecture doc covers all required sections
- [ ] All 8 ADRs exist with consistent format
- [ ] ADR-004 reflects hybrid approach (not old routes-only)
- [ ] No guardrail violations (column detail, V2 speculation, endpoint catalogs)
- [ ] Index file (docs/adr.md) lists all 8 ADRs
