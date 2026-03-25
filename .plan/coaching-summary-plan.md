# Coaching Summary — Implementation Plan

## Overview

Add a `/coaching` page that generates a markdown summary of training state (profile, plan, history, trends) for copy-paste into LLM conversations. Requires a new `athlete_profile` table, summary generator, and page with profile form + subjective state input.

## Tasks

### Wave 1: Schema & Data Layer

| # | Task | Description | Files | Depends | Size |
|---|------|-------------|-------|---------|------|
| C1 | `athlete_profile` table | Add table to schema: id, age (int), weight_kg (real), height_cm (real), gender (text), training_age_years (int), primary_goal (text), injury_history (text), created_at, updated_at. All fields nullable except id. | `lib/db/schema.ts` | — | S |
| C2 | Migration | `pnpm db:generate` + `pnpm db:migrate` | `drizzle/migrations/*` | C1 | S |

### Wave 2: Queries & Actions

| # | Task | Description | Files | Depends | Size |
|---|------|-------------|-------|---------|------|
| C3 | Profile queries | `getAthleteProfile()` — returns single row or null. Simple select, limit 1. | `lib/coaching/queries.ts` | C2 | S |
| C4 | Profile actions | `saveAthleteProfile(input)` — upsert with zod validation. Follow `lib/exercises/actions.ts` pattern: zod schema → safeParse → `{ success, data } \| { success, error }`. Uses `INSERT ... ON CONFLICT` for single-row upsert. | `lib/coaching/actions.ts` | C2 | S |

### Wave 3: Summary Generator

| # | Task | Description | Files | Depends | Size |
|---|------|-------------|-------|---------|------|
| C5 | Active mesocycle query | Fetch active mesocycle with templates → exercise_slots → exercises + weekly_schedule. New function in coaching queries. | `lib/coaching/queries.ts` | C2 | M |
| C6 | Recent sessions query | Fetch logged_workouts (last 4 weeks) with logged_exercises + logged_sets. Join exercise names. New function in coaching queries. | `lib/coaching/queries.ts` | C2 | M |
| C7 | Summary generator | `generateCoachingSummary(subjectiveState)` assembles 6 markdown sections: **1)** Athlete Profile, **2)** Current Plan (active meso + template structure), **3)** Recent Sessions (4 wks of logs), **4)** Progression Trends (reuse `getProgressionData`), **5)** Subjective State (passthrough from form), **6)** Upcoming Plan (reuse `getCalendarProjection` for next 2 weeks). Returns markdown string. | `lib/coaching/summary.ts` | C3, C5, C6 | L |

### Wave 4: API

| # | Task | Description | Files | Depends | Size |
|---|------|-------------|-------|---------|------|
| C8 | Summary route | POST `/api/coaching/summary` — accepts `{ fatigue, soreness, sleep, injuries, notes }` in body, validates with zod, calls `generateCoachingSummary()`, returns `{ markdown }`. Follow existing route pattern (try/catch, NextResponse). | `app/api/coaching/summary/route.ts` | C7 | S |

### Wave 5: UI

| # | Task | Description | Files | Depends | Size |
|---|------|-------------|-------|---------|------|
| C9 | Page (server) | `/coaching` page. Server component — loads athlete profile, passes to client. | `app/(app)/coaching/page.tsx` | C3 | S |
| C10 | Profile form | Inline edit form with controlled inputs. Auto-save on blur via `saveAthleteProfile` server action. Fields: age, weight, height, gender (select), training age, primary goal, injury history (textarea). | `components/coaching/profile-form.tsx` | C4, C9 | M |
| C11 | Subjective state form | Ephemeral form (not persisted). Radio groups for fatigue/soreness/sleep (1-5 scale), current injuries textarea, freeform notes textarea. Passes values up to parent. | `components/coaching/subjective-state-form.tsx` | C9 | S |
| C12 | Summary preview | Fetches from POST route on "Generate" click, shows markdown in `<pre>` block. Copy-to-clipboard button. Loading state. | `components/coaching/summary-preview.tsx` | C8 | M |
| C13 | Client orchestrator | Composes profile form, subjective state form, generate button, summary preview. Manages state flow between components. | `components/coaching/coaching-page-client.tsx` | C10, C11, C12 | M |

### Wave 6: Integration

| # | Task | Description | Files | Depends | Size |
|---|------|-------------|-------|---------|------|
| C14 | Nav link | Add `{ href: '/coaching', label: 'Coaching', icon: BrainCircuit }` after Routines in `navItems` array. Import `BrainCircuit` from lucide-react. | `components/layout/nav-items.ts` | C9 | S |

## Dependency Graph

```
C1 → C2 → C3 → C5 ─┐
            │       │
            ├→ C6 ──┤
            │       ▼
            ├───── C7 → C8 → C12 ─┐
            │                      │
            ▼                      │
           C4 → C10 ──┐           │
                       │           │
           C9 → C11 ──┼───────────┤
            │          │           │
            ├→ C14     ▼           ▼
            │        C13 ◄─────────┘
            │
            └→ (page shell, no deps on data)
```

## Verification

1. **Schema**: `pnpm db:generate` succeeds, migration file created, `pnpm db:migrate` applies cleanly
2. **Profile CRUD**: Save profile via action, reload page, data persists
3. **Summary generator**: Call with test subjective state, verify all 6 sections present in output
4. **API route**: `curl -X POST /api/coaching/summary -d '{"fatigue":3,"soreness":2,"sleep":4,"injuries":"","notes":""}' -H 'Content-Type: application/json'` returns markdown
5. **E2E flow**: Navigate to `/coaching` → fill profile → fill subjective state → click Generate → markdown appears → copy button works
6. **Nav**: Coaching link visible in sidebar, routes correctly

## Open Questions

- Progression section: include all exercises or only "main" exercises (`is_main=true`)? Recommend main-only to keep summary concise.
- Summary length: should there be a condensed mode for smaller context windows?
- Should calendar projection section include routine items or just workouts?
