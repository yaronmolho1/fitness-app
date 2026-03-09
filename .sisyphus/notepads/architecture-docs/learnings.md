# Architecture Docs Notepad — Learnings

## [2026-03-08] Session Init
- Plan: .sisyphus/plans/architecture-docs.md
- Deliverables: docs/architecture.md + docs/adrs/001-008.md + docs/adr.md
- All architecture decisions LOCKED — pure writing task
- ADR-004 revised to Hybrid (Server Actions mutations + Route Handlers computed reads)
- Ports: standalone=3000, orchestrated=3002
- Diagram format: Mermaid (GitHub-renderable)
- Interview decisions (interval storage, uniform intervals, clone flow): in architecture.md only, NOT separate ADRs
- Guard: NO column-level schema, NO endpoint catalog, NO V2 design
