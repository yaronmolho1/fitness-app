# Mesocycle Status Management
**Status:** ready
**Epic:** Mesocycle Lifecycle
**Depends:** specs/create-mesocycle.md

## Description
As a coach, I can transition a mesocycle through its status lifecycle (planned → active → completed) so that I know where I am in my training timeline.

## Acceptance Criteria
- [ ] Every mesocycle has a `status` field with exactly three valid values: `"planned"`, `"active"`, `"completed"`
- [ ] A newly created mesocycle always starts with `status = "planned"` (enforced by the create Server Action)
- [ ] A `"planned"` mesocycle can be transitioned to `"active"` via an explicit user action
- [ ] An `"active"` mesocycle can be transitioned to `"completed"` via an explicit user action
- [ ] `"completed"` is a terminal state — no transition out of `"completed"` is permitted
- [ ] A `"planned"` mesocycle cannot be transitioned directly to `"completed"` — must go through `"active"` first
- [ ] Only one mesocycle may have `status = "active"` at any given time
- [ ] Attempting to activate a mesocycle when another is already `"active"` is rejected with a clear error message
- [ ] Status transitions are performed via Server Actions (per ADR-004)
- [ ] The current status is displayed on the mesocycle list and detail views
- [ ] Available transition actions are shown contextually: `"planned"` shows "Activate", `"active"` shows "Complete", `"completed"` shows no transition action
- [ ] The only-one-active constraint is enforced at the application layer (Server Action checks before insert/update)

## Edge Cases
- Activating when another mesocycle is already active — rejected; error message identifies the constraint
- Attempting to revert `"completed"` to `"active"` or `"planned"` — rejected; no UI affordance and Server Action rejects the request
- Attempting to skip `"planned"` → `"completed"` directly — rejected
- Activating a mesocycle with no templates or schedule — allowed; status management is independent of template/schedule completeness
- Completing the only active mesocycle — allowed; results in zero active mesocycles (valid state)
- No active mesocycle exists — valid state; the app functions normally with zero or multiple planned mesocycles

## Test Requirements
- Unit: Server Action rejects activation when another mesocycle is already `"active"`
- Unit: Server Action rejects any transition out of `"completed"`
- Unit: Server Action rejects `"planned"` → `"completed"` direct transition
- Unit: Server Action accepts `"planned"` → `"active"` when no other mesocycle is active
- Unit: Server Action accepts `"active"` → `"completed"`
- Integration: activating a mesocycle persists `status = "active"` in the database
- Integration: completing a mesocycle persists `status = "completed"` and the state is terminal
- Integration: only-one-active constraint holds across concurrent-style sequential requests
