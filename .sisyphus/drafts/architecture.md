# Draft: Architecture Design

## Requirements (confirmed)
- Replace 4-sheet Excel system with template-based planning + snapshot logging
- Mesocycle-scoped templates (Option B+), canonical_name linking, cascade UX
- 10-table SQLite schema (Drizzle v2 defineRelations)
- Next.js 16 App Router + shadcn/ui + Tailwind v4
- JWT single-user auth (jose, Edge-compatible middleware)
- Docker on Hostinger VPS (Ubuntu 24.04), nginx reverse proxy
- Desktop = Coach (planning), Mobile = Athlete (logging)

## Technical Decisions (locked)
- ADR-001: SQLite over PostgreSQL
- ADR-002: Mesocycle-scoped templates (Option B+)
- ADR-003: Deload as separate weekly schedule
- ADR-004: API routes over Server Actions — **NEEDS REVIEW** (librarian recommends Server Actions for 95% of single-user mutations)
- ADR-005: JSON snapshot + normalized tables for logged workouts
- ADR-006: canonical_name string for cross-phase linking
- ADR-007: Drizzle v2 defineRelations API
- ADR-008: Modular architecture for ecosystem extensibility

## Research Findings (from agents)

### Infrastructure (docker-app-stack)
- Shared nginx reverse proxy (SSL/certbot), app-network bridge
- Per-app databases (no shared DB)
- expense-tracker = canonical Next.js pattern (Next.js 16, Drizzle/PG, shadcn, JWT)
- Fitness app needs: own docker-compose.yml, nginx site config, standalone-first design
- Available ports: 3000 taken by other apps in orchestration — needs unique port (3001+)

### Fitness Domain Patterns (wger 5.7k stars, FitTrackee 1k stars)
- wger stores actual + target on every log entry (already in plan via prescribed* columns)
- wger superset detection: Slot with multiple SlotEntries — not needed V1
- wger progression engine: per-iteration config rules — explicitly out of V1 scope
- FitTrackee: materialized records table for PRs — not V1 but good V2 pattern
- wger: Routine/Day/Slot/SlotEntry hierarchy — plan uses simpler mesocycle/template/exerciseSlot

### Next.js + SQLite + Drizzle (librarian)
- WAL + 4 PRAGMAs confirmed correct (already in plan)
- Standalone Docker output recommended for production
- Volume mount critical for SQLite persistence
- Health check endpoint needed
- Server Actions recommended over Route Handlers for single-user app mutations

## Open Questions (RESOLVED)
1. Per-interval running data → JSON array on loggedWorkouts (`intervalData: [{pace, hr, notes}]`)
2. Variable-distance intervals → Uniform only V1 (single intervalCount + distance)
3. Clone flow → One-step (create + clone atomically)

## Architecture Conflict (RESOLVED)
- ADR-004 REVISED → Hybrid approach
- Server Actions for form mutations (CRUD operations)
- Route Handlers for computed reads (/api/calendar, /api/progression, /api/today) + health check
- Rationale: Saves boilerplate on 15+ mutations, keeps read APIs for V2 consumers (LLM, Garmin, ecosystem)

## Scope Boundaries
- INCLUDE: docs/architecture.md, docs/adrs/001-*.md (individual files)
- EXCLUDE: updating existing work plan, writing code
