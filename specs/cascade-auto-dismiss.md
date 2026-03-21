---
status: ready
epic: UX Polish
depends: cascade-scope-selection, cascade-slot-edits
---

# Cascade Auto-Dismiss

## Description

Auto-dismiss the "Cascade complete" summary after 2 seconds instead of blocking the slot row until the user manually clicks "Done".

## Acceptance Criteria

1. **Given** a cascade operation completes in slot-cascade-scope-selector, **When** the summary renders, **Then** it auto-dismisses after ~2 seconds.
2. **Given** a cascade operation completes in cascade-scope-selector, **When** the summary renders, **Then** it auto-dismisses after ~2 seconds.
3. **Given** the summary is visible, **When** I click "Done" before 2 seconds, **Then** it dismisses immediately.
4. **Given** the component unmounts before 2 seconds, **When** the timer would fire, **Then** no stale timeout executes (cleanup on unmount).

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Rapid successive cascades | Each summary gets its own timer; no interference |
| User clicks Done at exactly 2s | No double-fire — clearTimeout on click, setTimeout on timer |
| Component re-renders during timeout | Timer persists correctly via useEffect cleanup |

## Test Requirements

- AC1-2: component — verify onComplete called after ~2s timeout
- AC3: component — verify onComplete called immediately on Done click
- AC4: component — verify clearTimeout on unmount

## Dependencies

- `specs/cascade-scope-selection.md` — template-level cascade selector
- `specs/cascade-slot-edits.md` — slot-level cascade selector

## Out of Scope

- Configurable dismiss duration
- Animation/fade-out on dismiss
