# Cascade Toast Notification

**Status:** ready
**Epic:** UX Polish
**Depends:** specs/cascade-scope-selection.md, specs/cascade-slot-edits.md
**Supersedes:** specs/cascade-auto-dismiss.md

## Description

Replace the inline "Cascade complete" summary panel and "Done" button with a Sonner toast notification that auto-dismisses. The scope selection and confirmation steps remain unchanged — only the final summary step is replaced. Removes friction from the cascade flow.

## Acceptance Criteria

1. **Given** a cascade operation completes (template-level or slot-level), **When** the server action returns success, **Then** a Sonner toast appears with the summary (e.g. "3 updated, 1 skipped") and the cascade selector closes immediately.
2. **Given** the toast appears, **When** ~3 seconds elapse, **Then** the toast auto-dismisses.
3. **Given** the toast is visible, **When** I swipe it away or click the dismiss button, **Then** it dismisses immediately.
4. **Given** a cascade with zero skipped templates, **When** the toast renders, **Then** it shows a success variant (e.g. "3 templates updated").
5. **Given** a cascade with skipped templates (logged workouts), **When** the toast renders, **Then** it shows a warning variant with skip count (e.g. "2 updated, 1 skipped — has logs").
6. **Given** the cascade scope was "This only", **When** the operation completes, **Then** the toast shows "Template updated" (no cascade count needed).
7. **Given** the cascade completes, **When** the selector closes, **Then** the underlying template/slot row returns to display mode immediately — no blocking summary step.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Multiple cascades in quick succession | Each gets its own toast, stacked per Sonner default |
| Cascade fails server-side | Error toast with message, selector stays open for retry |
| "This only" scope (no actual cascade) | Simple success toast, no counts |

## Test Requirements

- AC1: component — toast fires on cascade complete, selector closes
- AC4-5: component — correct toast variant based on skip count
- AC6: component — "This only" shows simplified message
- AC7: component — template row returns to display mode immediately

## Dependencies

- `specs/cascade-scope-selection.md` — scope selection + confirm steps unchanged
- `specs/cascade-slot-edits.md` — slot-level cascade unchanged

## Out of Scope

- Changing the scope selection step (3 radio options)
- Changing the confirmation step (affected mesocycle list)
- Undo functionality on the toast
