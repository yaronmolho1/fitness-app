# Number Input Zero Fix

**Status:** ready
**Epic:** UX Polish
**Depends:** none

## Description

Fix number inputs (sets, reps, weight, RPE, rest, duration, etc.) so that backspacing to empty does not leave a sticky "0", and typing after clearing does not produce values like "05". Inputs should allow a truly empty state while editing and only coerce to a valid number on blur.

## Acceptance Criteria

1. **Given** a number input with value "8", **When** I backspace once to delete the "8", **Then** the input shows empty (not "0").
2. **Given** an empty number input, **When** I type "5", **Then** the input shows "5" (not "05").
3. **Given** an empty number input, **When** I blur (tap away), **Then** the value is preserved as empty or reverts to a sensible default depending on context (e.g. required fields may revert to previous value).
4. **Given** a number input with value "12", **When** I select all and type "8", **Then** the input shows "8".
5. **Given** a decimal input (weight, RPE), **When** I type "82.5", **Then** the input accepts the decimal correctly.
6. **Given** a number input, **When** I type non-numeric characters (letters, symbols), **Then** they are rejected — only digits (and decimal point where applicable) are accepted.
7. **Given** a mobile device, **When** I focus a numeric input, **Then** the numeric keyboard opens (integer inputs: number pad; decimal inputs: decimal pad).

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Paste non-numeric text | Stripped to digits only |
| Input value "0" is valid (e.g. weight for bodyweight exercise) | Zero accepted when explicitly typed, just not auto-inserted |
| Leading zeros typed intentionally (e.g. "007") | Displayed as typed during edit, normalized on blur to "7" |
| Very large numbers (e.g. 99999) | Accepted; no artificial max unless field-specific |
| Negative numbers | Rejected — all fitness inputs are non-negative |

## Test Requirements

- AC1-2: component — backspace to empty, type fresh digit, no leading zero
- AC5: component — decimal input accepts "82.5"
- AC6: component — non-numeric characters rejected
- AC7: component — correct inputMode attributes (numeric vs decimal)

## Dependencies

None — this is a standalone input behavior fix.

## Out of Scope

- Changing which fields exist on templates/slots
- Input validation rules (min/max per field) — existing validation unchanged
- Stepper buttons or increment/decrement controls
