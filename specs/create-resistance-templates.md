# Create Resistance Templates
**Status:** ready
**Epic:** Workout Templates
**Depends:** specs/create-mesocycle.md

## Description
As a coach, I can create and edit named resistance workout templates scoped to a mesocycle so that I have structured containers for defining workouts (Push A, Pull B) with cross-phase linking via canonical_name.

## Acceptance Criteria
- [ ] A resistance template can be created with a name and a mesocycle association (required fields)
- [ ] Template name is a non-empty string; blank or whitespace-only names are rejected
- [ ] On creation, `canonical_name` is auto-generated from the template name: lowercase, hyphens replacing spaces, special characters stripped (e.g. "Push A (Main)" → `"push-a-main"`) — per ADR-002 and ADR-006
- [ ] `canonical_name` is displayed to the user alongside the template name so the cross-phase link value is visible
- [ ] `canonical_name` is editable after creation; editing it intentionally breaks cross-phase linking (no automatic propagation to sibling templates in other mesocycles) — per ADR-002
- [ ] A warning is shown when the user edits `canonical_name` explaining that cross-phase linking will break for this template
- [ ] Template name (display name) is independently editable without affecting `canonical_name` unless the user explicitly changes `canonical_name`
- [ ] Template `modality` is set to `resistance` at creation and is not changeable after creation
- [ ] Template is scoped to exactly one mesocycle; the mesocycle association cannot be changed after creation
- [ ] All templates belonging to a mesocycle are listed on the mesocycle detail view
- [ ] Template list shows: template name, `canonical_name`, and modality
- [ ] A template can be deleted; deletion is blocked if the template has any associated exercise slots (user must remove slots first)
- [ ] A template can be deleted if it has no exercise slots; deletion is permanent with a confirmation prompt
- [ ] All mutations (create, update, delete) are performed via Server Actions — per ADR-004
- [ ] Template IDs are auto-increment integers — no UUIDs — per architecture conventions
- [ ] Creating a template with a duplicate `canonical_name` within the same mesocycle is rejected with a clear error message
- [ ] Duplicate `canonical_name` across different mesocycles is allowed (this is the intended cross-phase link mechanism)
- [ ] An empty mesocycle (no templates yet) shows a prompt to create the first template
- [ ] Template metadata (name, `canonical_name`) can be edited from the template detail view
- [ ] After a successful create or update, the UI reflects the new state without a full page reload

## Edge Cases
- Template name with only whitespace is rejected
- Template name that would produce an empty `canonical_name` after slug transformation (e.g. all special chars) — system must produce a non-empty slug or reject the name
- Editing `canonical_name` to match an existing `canonical_name` in the same mesocycle is rejected
- Editing `canonical_name` to match an existing `canonical_name` in another mesocycle is allowed (re-establishes cross-phase link)
- Deleting a template that is assigned to a weekly schedule slot — behavior: blocked or cascades to remove schedule assignment (must be specified; V1 recommendation: block deletion with message listing schedule conflicts)
- Template name at maximum length (no explicit limit defined; system should handle gracefully up to at least 255 characters)
- Attempting to create a template on a completed mesocycle — blocked with error message

## Test Requirements
- Unit: `canonical_name` slug generation from various name inputs (spaces, parentheses, special chars, all-caps, mixed case)
- Unit: duplicate `canonical_name` within same mesocycle is rejected
- Unit: duplicate `canonical_name` across different mesocycles is allowed
- Integration: create template via Server Action → template appears in mesocycle template list with correct `canonical_name`
- Integration: update template name → `canonical_name` unchanged unless explicitly edited
- Integration: update `canonical_name` → warning shown, change persisted
- Integration: delete template with exercise slots → blocked
- Integration: delete template with no slots → succeeds after confirmation
- Integration: create template on completed mesocycle → rejected
- E2E: full create → view → edit name → edit canonical_name (with warning) → delete flow
