# ADR-008: Modular Architecture for Ecosystem Extensibility

## Status
Accepted

## Context
This fitness app is one planned building block in a broader "second brain / life management" system. Future modules may include expense tracking (already built), a tutor/learning tracker, and a general life dashboard. The architecture must not over-engineer for this future, but also must not make integration impossible. The fitness app must be self-contained and usable standalone while being extractable as a module.

## Options Considered
- **Option A — Monolithic, extract later**: build everything in one app with no domain boundaries; extract modules if and when needed; simplest now, highest refactor cost later
- **Option B — Microservices from day 1**: each domain (exercises, logging, routines) is a separate service with its own database and API; correct for multi-team scale; massively over-engineered for a single-user app
- **Option C — Modular monolith**: clean domain boundaries enforced by file structure and API surfaces; each domain owns its data and exposes only intentional interfaces; can be extracted to a separate service later without internal rewrites

## Decision
Option C: modular monolith. Domains are organized as distinct module directories under `app/` and `lib/`. Each domain's data access is encapsulated. Cross-domain operations go through explicit Server Actions or Route Handlers, not direct table joins across domains.

## Rationale
A single-user app does not need the operational complexity of microservices. But clean boundaries now prevent the gradual entanglement that makes future extraction painful. The daily routines module is intentionally designed as a generic habit/tracking system (not fitness-specific) — it is already architecture-ready to be lifted out. Route Handlers on computed reads are the natural future API surface for ecosystem integration: a dashboard app can call `/api/today` or `/api/progression` without deep coupling to the fitness app's internals.

## Extensibility Hooks
These are documented architectural affordances, not V2 features being designed here:

- **Daily routines module**: generic enough to become a standalone habit tracker; fitness-specific scoping (per-mesocycle, skip-on-deload) is a config option, not a hard coupling
- **Exercise library**: structured reference data (name, category, modality) that could be shared across multiple apps via a read-only API
- **Health endpoint** (`/api/health`): intended as the aggregation point for a future ecosystem health dashboard
- **Route Handlers for reads**: `/api/calendar`, `/api/progression`, `/api/today` are designed as clean external API surfaces, not internal Next.js implementation details

## Consequences
- (+) Each domain can evolve independently within the monolith without cross-domain coupling
- (+) Extracting a domain to a separate service later requires interface work, not internal rewrites
- (+) Daily routines module is already generic — lifting it out is a configuration change, not a redesign
- (-) Requires discipline to maintain domain boundaries in a monolith — shortcuts across domain boundaries are easy and tempting
- (-) More directory structure overhead than a flat codebase for a small app
