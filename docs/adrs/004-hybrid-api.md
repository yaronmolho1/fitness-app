# ADR-004: Hybrid API — Server Actions + Route Handlers

## Status
Accepted

> **Note**: This ADR supersedes the original decision in `.sisyphus/plans/fitness-app.md` which specified Route Handlers only. The hybrid approach is the intended architecture. Implementation tasks in the work plan may reference Route Handlers — those should be updated to reflect this decision when reached.

## Context
The app needs to handle two distinct categories of server-side operations: mutations (create, update, delete, log) and computed reads (calendar projection, progression data, today's workout). The expense-tracker sibling app uses Route Handlers exclusively. Next.js 16 Server Actions offer a different, lower-boilerplate model for mutations. The right API strategy depends on the nature of each operation and likely future consumers.

## Options Considered
- **Option A — Route Handlers only**: consistent with the expense-tracker sibling; every operation is an explicit HTTP endpoint; easier to curl and test in isolation
- **Option B — Server Actions only**: minimal boilerplate for mutations; automatic cache revalidation; end-to-end type safety with no explicit API contract; harder to consume from external clients
- **Option C — Hybrid**: Server Actions for form mutations, Route Handlers for computed reads and any endpoint that may have external consumers in V2

## Decision
Option C — Hybrid. Server Actions handle all CRUD mutations (exercises, templates, slots, mesocycles, schedules, logging, routines). Route Handlers serve computed reads (`/api/calendar`, `/api/progression`, `/api/today`) and the health check (`/api/health`).

## Rationale
Server Actions eliminate boilerplate on 15+ mutation operations: no fetch wrapper, no JSON serialization, no manual cache invalidation — `revalidatePath` handles it automatically. End-to-end type safety without a separate API contract is a significant ergonomic advantage for a solo developer. Route Handlers are intentionally kept for reads that aggregate data across multiple tables and may serve V2 consumers: a future LLM coach, Garmin integration, or ecosystem aggregator can call `/api/progression` without coupling to React Server Components. The health check requires a Route Handler for nginx upstream probing.

## Consequences
- (+) Mutations require significantly less boilerplate (no fetch, no response parsing, auto revalidation)
- (+) Computed read endpoints (`/api/calendar`, `/api/progression`, `/api/today`) are already V2-ready external API surfaces
- (+) Type safety flows from Server Action parameters through to UI without a separate API schema
- (-) Two API patterns to understand and test — Server Actions cannot be curled directly
- (-) Server Actions are harder to test in isolation (require React test utilities or component mounts)
- (-) Inconsistency with expense-tracker sibling makes cross-app pattern comparison harder

## Implementation Notes
- Server Actions live in `app/(app)/[domain]/actions.ts`; use `'use server'` directive
- Route Handlers live in `app/api/[resource]/route.ts`; return `Response` objects
- Auth in Server Actions: call `validateSession()` from `lib/auth.ts` at the top of each action
- Auth in Route Handlers: middleware validates JWT before the handler runs — no duplicate check needed
- `revalidatePath()` or `revalidateTag()` must be called at the end of every mutating Server Action
