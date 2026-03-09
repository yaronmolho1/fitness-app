# Exercise Search & Filter
**Status:** ready
**Epic:** Exercise Library
**Depends:** specs/exercise-crud.md

## Description
As a coach, I can search exercises by name and filter by modality so that I can find the right exercise quickly when building workout templates.

## Acceptance Criteria

### Search by name
- [ ] A text search input is present on the exercise library page
- [ ] Typing in the search input filters the displayed exercise list to only exercises whose name contains the search string (case-insensitive)
- [ ] Search matches on partial strings (e.g., "press" matches "Bench Press", "Overhead Press")
- [ ] The list updates as the user types (no submit button required for search)
- [ ] Clearing the search input restores the full unfiltered list
- [ ] When the search string matches no exercises, an empty state message is shown (distinct from the "no exercises at all" empty state)

### Filter by modality
- [ ] A modality filter control is present on the exercise library page
- [ ] The filter offers the three modality options: `resistance`, `running`, `mma`, plus an "All" / no-filter option
- [ ] Selecting a modality shows only exercises with that modality
- [ ] Selecting "All" (or clearing the filter) shows exercises of all modalities
- [ ] The modality filter and name search work together — both constraints apply simultaneously when both are active

### Combined search + filter
- [ ] When both a search string and a modality filter are active, only exercises matching both constraints are shown
- [ ] When the combined result is empty, the empty state message is shown

### Search/filter scope
- [ ] Search and filter operate on the full exercise library (all exercises in the database, not just a paginated subset)
- [ ] Search and filter are client-side or server-side — either is acceptable, but results must be consistent with the database state

### State persistence within session
- [ ] The search string and active modality filter are preserved when navigating away and returning to the exercise library within the same session (or reset on navigation — either is acceptable, but behavior must be consistent and not cause errors)

## Edge Cases

- Searching with only whitespace returns the same result as an empty search (full list or filtered by modality only)
- Searching for a string with special regex characters (e.g., `(`, `.`, `*`) does not crash the search — treated as literal text
- Modality filter with no exercises of that modality shows the empty state, not an error
- Search + modality filter combination with no results shows the empty state, not an error
- Exercises added via the create form appear in search results immediately after creation (list is up to date)
- Exercises edited via the edit form appear with updated names in search results immediately after editing
- Exercises deleted via the delete action disappear from search results immediately after deletion

## Test Requirements

- **Unit — name search logic**: given a list of exercises, apply a search string; assert only matching exercises are returned. Test case-insensitive match. Test partial match. Test no-match returns empty array.
- **Unit — modality filter logic**: given a list of exercises, apply a modality filter; assert only exercises with that modality are returned. Test "all" filter returns all exercises.
- **Unit — combined search + filter**: apply both a search string and a modality filter; assert only exercises matching both constraints are returned.
- **Unit — whitespace search**: apply a search string of only spaces; assert result is the same as no search filter.
- **Integration — search against DB**: insert exercises with varied names; query with a search string; assert only matching rows are returned.
- **Integration — modality filter against DB**: insert exercises with varied modalities; query with a modality filter; assert only matching rows are returned.
- **E2E — search updates list**: type in the search input; assert the list updates to show only matching exercises.
- **E2E — modality filter updates list**: select a modality from the filter; assert only exercises of that modality are shown.
- **E2E — combined filter**: apply both search and modality filter; assert only exercises matching both are shown.
- **E2E — clear search**: type a search string, then clear it; assert the full list is restored.
- **E2E — empty state on no match**: search for a string that matches no exercises; assert the no-results empty state is shown.
