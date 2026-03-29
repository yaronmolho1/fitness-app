# Smart Logging Autofill

**Status:** partial — Capability 1 Resistance (AC1-5) implemented in T190
**Epic:** Workout Logging
**Depends:** specs/pre-filled-resistance-logging.md, specs/actual-set-input.md, specs/add-remove-sets.md, specs/mobile-logging-redesign.md, specs/running-logging.md, specs/mma-bjj-logging.md, specs/retroactive-workout-logging.md, specs/workout-rating-notes.md

## Description

Replace the placeholder-only approach with true autofill: inputs load with planned values as editable real values (not grayed hint text), a "Log as Planned" shortcut saves the workout in one tap, and a per-exercise "Copy Down" button propagates set 1 values to remaining sets. Together these reduce a typical logging session from dozens of taps to near-zero for workouts completed as planned.

## Acceptance Criteria

### Capability 1: Autofill on Load

#### Resistance

1. **Given** a resistance logging form with planned exercise slots, **When** the form initializes, **Then** each set row's weight input contains the slot's `weight` value (merged with week override) as an editable value, not placeholder text.

2. **Given** a resistance logging form with planned exercise slots, **When** the form initializes, **Then** each set row's reps input contains the slot's `reps` value (merged with week override) as an editable value, not placeholder text.

3. **Given** an exercise slot where `weight` is `null` (bodyweight / no weight), **When** the form initializes, **Then** the weight input is empty (not "0", not a dash).

4. **Given** an exercise slot where `reps` is a range string like "8-12", **When** the form initializes, **Then** the reps input is autofilled with the lower bound (e.g. `8`), and a hint label "Target: 8-12" appears beneath the reps input in muted text.

5. **Given** an exercise slot where `reps` is a single integer string like "10", **When** the form initializes, **Then** the reps input is autofilled with `10` and no range hint label is shown.

6. **Given** a resistance logging form, **When** the form initializes, **Then** the per-exercise RPE selector is empty (no button selected). RPE is never autofilled.

7. **Given** a resistance logging form, **When** the form initializes, **Then** the workout rating is unset and the notes field is empty. Rating and notes are never autofilled.

8. **Given** an exercise with `target_sets = 3` and a week override increasing weight from 60 to 65, **When** the form initializes, **Then** all 3 set rows show weight = 65 (the override value, not the base value).

#### Running

9. **Given** a running logging form where the template has `target_distance` and/or `target_pace`, **When** the form initializes, **Then** the corresponding actual fields (`actual_distance`, `actual_avg_pace`) are prefilled with the planned target values.

10. **Given** a running logging form where the template has no `target_distance` (null), **When** the form initializes, **Then** the `actual_distance` input is empty.

11. **Given** a running logging form, **When** the form initializes, **Then** `actual_avg_hr` is NOT autofilled (no planned target equivalent). The field starts empty.

#### MMA/BJJ

12. **Given** an MMA/BJJ logging form where the template has `planned_duration`, **When** the form initializes, **Then** the `actual_duration_minutes` input is prefilled with the planned duration value.

13. **Given** an MMA/BJJ logging form where `planned_duration` is null, **When** the form initializes, **Then** the `actual_duration_minutes` input is empty.

14. **Given** an MMA/BJJ logging form, **When** the form initializes, **Then** `feeling` is unset and notes are empty. Neither is autofilled.

#### Mixed Modality

15. **Given** a mixed-modality workout with a resistance section and a running section, **When** the form initializes, **Then** the resistance section's sets are autofilled per AC1-8 and the running section's actual fields are autofilled per AC9-11.

16. **Given** a mixed-modality workout with an MMA section, **When** the form initializes, **Then** the MMA section's `actual_duration_minutes` is autofilled per AC12-13.

#### Visual Treatment

17. **Given** an autofilled input, **When** the form renders, **Then** the autofilled value uses the same font weight, color, and styling as manually entered text — it is a real form value, not visually distinct from user-typed values.

### Capability 2: Log as Planned

#### Whole-workout button

18. **Given** a logging form (any modality) that has just loaded with autofilled values, **When** the user has not yet modified any input, **Then** a "Log as Planned" button is visible in the header area below the workout name.

19. **Given** the "Log as Planned" button is visible, **When** the user taps it, **Then** the form scrolls to the rating/notes section and a brief toast reads "Review and save when ready."

20. **Given** the user has tapped "Log as Planned" and the form has scrolled to rating/notes, **When** the user taps the sticky "Save Workout" button, **Then** the workout is saved with all autofilled values plus any rating/notes the user entered.

21. **Given** the user has modified any set's weight or reps, **When** the form re-renders, **Then** the whole-workout "Log as Planned" button is hidden.

22. **Given** a workout where all exercises have null `target_weight` and range reps only, **When** the form loads, **Then** the "Log as Planned" button is still shown (autofilled lower-bound reps count as planned values).

#### Per-exercise button

23. **Given** a resistance exercise section in the logging form, **When** the user views the exercise header, **Then** a small "As Planned" button is visible in the exercise header row.

24. **Given** the per-exercise "As Planned" button, **When** the user taps it, **Then** all set rows for that exercise are filled with the planned weight and lower-bound reps, overwriting any user edits.

25. **Given** the per-exercise "As Planned" button for a running section in a mixed workout, **When** the user taps it, **Then** the actual fields for that section are filled with planned distance and pace, overwriting any user edits.

26. **Given** the per-exercise "As Planned" button, **When** the user taps it, **Then** RPE is NOT modified (stays at whatever the user set or null).

27. **Given** an exercise where `target_weight` is null and `reps` is "8-12", **When** the user taps "As Planned", **Then** weight stays empty and reps are set to 8 (the lower bound).

28. **Given** the user taps "Log as Planned" and saves without adding rating or notes, **When** the save completes, **Then** rating is stored as null and notes as null.

### Capability 3: Copy Down

29. **Given** a resistance exercise with 2+ sets where the user has edited set 1's weight or reps after initial load, **When** the form renders, **Then** a "Copy down" button appears after set 1's row, right-aligned.

30. **Given** the "Copy down" button is visible, **When** the user taps it, **Then** sets 2 through N are updated to match set 1's current weight and reps values.

31. **Given** a resistance exercise with exactly 1 set, **When** the form renders, **Then** no "Copy down" button is shown.

32. **Given** the "Copy down" button is tapped, **When** the copy completes, **Then** only weight and reps are copied. Per-exercise RPE is not affected.

33. **Given** the user has not edited set 1 (it still contains the autofilled value from load), **When** the form renders, **Then** the "Copy down" button is NOT shown.

34. **Given** a resistance exercise in a mixed-modality workout, **When** the user edits set 1, **Then** the same "Copy down" behavior applies.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| `target_weight = null` (bodyweight exercise) | Weight input autofills as empty. "As Planned" leaves weight empty. Copy-down copies empty weight. |
| `reps = "8-12"` (range) | Autofill uses lower bound (8). Hint label "Target: 8-12" shown beneath input. |
| `reps = "AMRAP"` or non-numeric | Autofill leaves reps empty. Hint label "Target: AMRAP" shown. |
| `reps = "5-5"` (degenerate range) | Lower bound = 5. No range hint shown (bounds equal). |
| Exercise with 1 set | Copy-down never shown. All other autofill/as-planned behavior works normally. |
| Already-logged workout | Already-logged summary shown per existing spec. No autofill, no buttons. |
| All exercises manually modified | Whole-workout "Log as Planned" hidden. Per-exercise "As Planned" buttons remain available. |
| Running workout with no planned targets (all null) | All actual fields start empty. "Log as Planned" still shown (records the run happened). |
| Retroactive logging (past date) | Autofill uses correct week's override values via existing `mergeSlotWithOverride`. |
| Deload week with 60% weight override | Autofill shows the deload-adjusted weight from the week override. |
| User adds a new set via "Add Set" | New set prefilled from previous set's values (existing add-set behavior). Not re-autofilled. |
| User removes sets then taps "As Planned" | Exercise reverts to `target_sets` count with planned values. Removed sets re-added. |
| User adds extra sets then taps "As Planned" | Extra sets beyond `target_sets` removed. Exercise matches plan exactly. |
| Mixed workout: tap whole-workout "Log as Planned" | All sections retain autofilled values. Form scrolls to rating/notes. |
| Week override changes `reps` to "10-15" | Autofill uses lower bound of override value (10), not base slot value. |
| Template with no exercise slots (empty template) | Empty state per existing spec. No autofill, no buttons. |

## Test Requirements

- AC1-2: Unit — `buildInitialSets` produces set arrays with weight/reps values from merged slots, not empty strings
- AC3: Unit — slot with `weight = null` produces empty string, not "0"
- AC4-5: Unit — range reps parsing: "8-12" → 8, "8" → 8, "AMRAP" → null, "5-5" → 5
- AC6-7: Unit — RPE, rating, notes all null/empty after initialization
- AC9-11: Integration — running form loads with planned targets prefilled, HR empty
- AC12-13: Integration — MMA form loads with planned duration prefilled
- AC15-16: Integration — mixed form applies modality-appropriate autofill per section
- AC18-21: E2E — "Log as Planned" visible when unmodified, hidden after edit, scrolls to rating/notes
- AC23-27: E2E — per-exercise "As Planned" fills planned values, doesn't touch RPE
- AC29-33: E2E — copy-down appears after set 1 edit, copies weight/reps to remaining sets

## Dependencies

- `specs/pre-filled-resistance-logging.md` — **partially superseded**: placeholder-based pre-fill replaced by true value autofill
- `specs/actual-set-input.md` — **partially superseded**: save-time fallback retained as safety net but no longer primary mechanism
- `specs/mobile-logging-redesign.md` — retains 3-column grid, per-exercise RPE; placeholder approach superseded
- `specs/add-remove-sets.md` — add-set still copies from previous set; "As Planned" interacts with set count
- `specs/running-logging.md` — running form gains autofill for actual fields
- `specs/mma-bjj-logging.md` — MMA form gains autofill for duration
- `specs/retroactive-workout-logging.md` — autofill uses correct week overrides via existing date threading
- `specs/workout-rating-notes.md` — rating/notes excluded from autofill; "Log as Planned" scrolls to this section

## Out of Scope

- Auto-save / draft persistence
- Smart suggestions from workout history (last session recall)
- Per-set RPE (remains per-exercise)
- Undo for copy-down (user can tap "As Planned" to reset)
- Running interval-specific autofill (per-rep pace, HR)
- HR autofill for running (no planned target equivalent)
- Elevation gain autofill for running (can be added later)

## Open Questions

1. **"As Planned" and extra sets:** When user added extra sets beyond `target_sets` and taps "As Planned", spec says restore to `target_sets` (remove extras). Could surprise users who intentionally added sets. Recommendation: restore to plan — button's contract is "match the plan exactly."

2. **"Log as Planned" for empty running templates:** When running template has no targets, button just records session happened. Should it still appear? Recommendation: yes — recording the session is valuable.

3. **"Log as Planned" reappearance:** Once hidden (user edited a value), should it reappear if user reverts all changes? Recommendation: no — stays hidden once dismissed. Tracking exact revert state is complex and low-value.

4. **Copy-down trigger timing:** Show on blur of set 1 inputs (after user finishes typing) vs. on any keystroke? Recommendation: show on blur to avoid flicker during typing.
