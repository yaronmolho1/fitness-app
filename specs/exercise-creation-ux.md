# Exercise Creation UX
**Status:** in-progress
**Epic:** Exercise Library
**Depends:** specs/exercise-crud.md

## Description
Improve exercise creation with a collapsible form and auto-suggest comboboxes for equipment and muscle group fields.

## Acceptance Criteria

### Collapsible creation form
- [ ] The exercise creation form is collapsed by default on page load
- [ ] A "+ New Exercise" button is visible at the top of the exercises page
- [ ] Clicking the button expands the form with a smooth transition (slide-down or accordion)
- [ ] Clicking the button again (or a close/cancel button) collapses the form
- [ ] After successful creation, the form collapses and the new exercise appears in the list
- [ ] The form resets all fields when collapsed

### Equipment combobox
- [ ] The equipment text input is replaced with a combobox (input + dropdown)
- [ ] The dropdown is populated with distinct equipment values from existing exercises in the database
- [ ] Typing filters the dropdown suggestions (case-insensitive)
- [ ] User can select a suggestion or type a completely new value (not restricted to existing)
- [ ] Empty/null values are not shown in suggestions
- [ ] Suggestions load on component mount (not on every keystroke — fetched once)

### Muscle group combobox
- [ ] The muscle group text input is replaced with a combobox (identical behavior to equipment)
- [ ] Populated with distinct muscle_group values from existing exercises
- [ ] Same type-to-filter + select-or-create behavior
- [ ] Both comboboxes use the same underlying component (shared combobox component)

### Edit form consistency
- [ ] The edit exercise form (inline on list items) also uses comboboxes for equipment and muscle group
- [ ] Same suggestions source as the creation form

### Data source
- [ ] A server-side query provides distinct equipment and muscle_group values: `getDistinctExerciseValues()`
- [ ] Values are sorted alphabetically
- [ ] Passed as props to both create and edit forms (no client-side fetch per form)

## Edge Cases
- No exercises exist yet → combobox has no suggestions, works as plain text input
- All exercises have null equipment → equipment combobox has no suggestions
- User types exact match of existing suggestion → no duplicate in dropdown
- Very long suggestion text → truncated with ellipsis in dropdown, full text in input

## Test Requirements
- Form starts collapsed, expands on button click
- Combobox shows suggestions from existing exercise data
- Typing filters suggestions correctly
- Custom (new) values can be entered and saved
- Edit form uses same combobox behavior
- Empty/null values excluded from suggestions
