# ADR-011: Exercise Slot Transfer Between Templates

## Status
Proposed

## Context
Users need to copy or move individual exercise slots (with all their configuration: sets, reps, weight, RPE, rest, guidelines, superset grouping) between templates. Currently only full-template copy exists (`copyTemplateToMesocycle`). Manually recreating an exercise in another template is tedious — open target, add exercise, re-enter all numbers.

Transfer can be same-mesocycle (reorganizing templates) or cross-mesocycle (carrying configuration forward). Must handle: section_id remapping for mixed templates, superset group_id remapping, order recalculation, and completed mesocycle protection.

## Options Considered

### Option A — Side-by-side drag & drop panel
Open a split-screen view showing source template on the left, target template on the right. Drag exercises between them.
- (+) Most intuitive UX for bulk transfers
- (+) Visual confirmation of source → target
- (−) Significant UI complexity: two synchronized template views, drag-and-drop library, responsive layout challenges on mobile
- (−) Requires loading two full templates simultaneously
- (−) Doesn't work well on mobile (coach context, but still)

### Option B — Context menu action with target picker modal
Add "Copy to..." / "Move to..." actions to each exercise slot's context menu (existing 3-dot menu). Clicking opens a modal to select target mesocycle → template → section (if mixed). Slot is copied/moved on confirm.
- (+) Minimal UI changes — reuses existing slot action menu
- (+) Works on both desktop and mobile
- (+) Natural discovery — action appears where user already manages slots
- (+) Modal flow guides user through mesocycle → template → section selection
- (−) Less visual than drag & drop
- (−) Moving multiple slots requires repeating the action per slot (unless batch mode added)

### Option C — Clipboard pattern (copy slot, paste into target)
User "copies" a slot (stored in client state), navigates to target template, "pastes" it.
- (+) Familiar UX pattern
- (−) Requires navigation between pages while holding state
- (−) Clipboard state easily lost (page refresh, navigation)
- (−) No visual feedback that something is "copied"

## Decision
Option B: context menu with target picker modal. Phase 2 can add drag & drop as an enhancement on desktop.

## Rationale
Option B delivers 90% of the value with minimal UI complexity. The existing slot action menu provides natural discoverability. The target picker modal (mesocycle → template → section) is a controlled, linear flow that prevents errors. Superset handling is explicit: when copying a superset member, prompt whether to copy the individual slot or the entire superset group.

Phase 2 drag & drop (Option A) can be added later as a desktop-only enhancement using the same server actions — the backend is the same regardless of UX pattern.

## Design

### Server Actions

Two new Server Actions in `lib/templates/slot-actions.ts`:

**`copyExerciseSlots`**: Copy one or more slots to a target template.
- Input: `slotIds: number[], targetTemplateId: number, targetSectionId?: number`
- Validates: target template exists, target mesocycle not completed, target section exists (if provided) and belongs to target template
- Copies each slot with: same exercise_id, sets, reps, weight, rpe, rest_seconds, guidelines, is_main
- Remaps: `template_id` → target, `section_id` → targetSectionId or null, `group_id` → new sequential group_id for superset groups, `order` → appended after last existing slot
- If multiple slots share a `group_id` in source, they share a new `group_id` in target (preserving superset structure)
- Reuses the slot-copy + group_id remapping pattern from `copy-actions.ts:140-184`

**`moveExerciseSlots`**: Move = copy + delete source slots.
- Input: same as copy
- Additional validation: source template's mesocycle also not completed
- Executes in a single transaction: insert into target, delete from source
- Reorders remaining source slots after deletion (close gaps)

### Target Picker Modal

Three-step selection flow:
1. **Select mesocycle** — dropdown of active/planned mesocycles
2. **Select template** — list of templates in chosen mesocycle (filtered to same modality or mixed)
3. **Select section** (only if target is mixed) — list of resistance sections in the target template

### Superset Handling
- Single slot (not in superset): copy/move individually
- Slot in superset: prompt "Copy this exercise only, or copy entire superset group?"
- If "entire group": all slots sharing the same `group_id` are copied/moved together with a new shared `group_id` in target

### Batch Operations
- V1: single or superset-group transfer via context menu
- V2: multi-select checkboxes + batch "Copy/Move selected to..."

## Consequences
- (+) Reuses existing copy-actions pattern for slot duplication — proven code path
- (+) No new UI library dependencies (no drag-and-drop library needed)
- (+) Server actions are the same regardless of future drag & drop UX
- (+) Works on mobile (context menu → modal)
- (−) Moving multiple unrelated slots requires multiple menu clicks (mitigated by V2 batch mode)
- (−) No visual drag feedback — less discoverable than drag & drop
