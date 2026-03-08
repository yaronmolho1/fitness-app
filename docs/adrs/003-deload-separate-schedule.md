# ADR-003: Deload as Separate Weekly Schedule

## Status
Accepted

## Context
Mesocycles include optional deload weeks that require a fundamentally different workout structure — fewer sessions, different exercises, reduced intensity. The app needs to model how deload weeks are scheduled and what templates they use. Two approaches were considered: per-exercise modifiers that adjust existing templates, or a completely separate schedule pointing to dedicated deload templates.

## Options Considered
- **Option A — Per-exercise deload modifiers**: each exercise slot gains a `skip_on_deload` flag and a `deload_percentage` field; the weekly schedule remains the same for normal and deload weeks
- **Option B — Separate weekly schedule with dedicated templates**: the `weekly_schedule` table stores two sets of rows per mesocycle — one for normal weeks and one for the deload week; deload rows point to purpose-built deload templates

## Decision
Option B: a `weekly_schedule` row includes a variant type (normal / deload). Each mesocycle with deload enabled has both a normal schedule and a deload schedule. Deload templates are cloned alongside normal templates during clone-on-create.

## Rationale
Deload weeks are often more drastic than simple load reduction — entire sessions may be dropped, exercises swapped for lower-impact alternatives, or sessions rescheduled to different days. Per-exercise modifiers cannot handle removing whole sessions or changing session structure. A separate schedule eliminates all conditional merge logic: during a deload week, the app simply reads the deload schedule rows instead of the normal ones. Dedicated deload templates are first-class workout plans, readable and editable without mental mapping of modifier stacks.

## Consequences
- (+) Deload structure is fully explicit — no hidden modifier logic in the render path
- (+) Deload templates are editable exactly like normal templates, with the same cascade UX
- (+) Session-level changes (fewer days, swapped exercises) are natural with this model
- (-) More templates to manage per mesocycle when a deload is enabled (mitigated by clone-on-create which copies deload templates automatically)
- (-) A mesocycle with 4 template types × 2 schedule variants doubles the template count

## Implementation Notes
- `weekly_schedule` rows include a `variant` column: `'normal'` | `'deload'`
- During calendar projection, the app checks if the current week is a deload week by computing week offset from mesocycle start; if the last week and deload is enabled, use the deload schedule rows
- Deload templates are cloned alongside normal templates in clone-on-create — no extra user action needed
- Mesocycles with `has_deload = false` have no deload schedule rows; the UI hides the deload tab in that case
