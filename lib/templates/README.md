# templates/

Workout template server actions for all modalities (resistance, running, MMA/BJJ).

## Files
- `actions.ts` — `createResistanceTemplate()`, `createRunningTemplate()`, `createMmaBjjTemplate()`, `updateTemplate()`, `deleteTemplate()`, `reorderTemplates()` with canonical name uniqueness per mesocycle, completed-mesocycle guard; all creates set `display_order` via `getNextDisplayOrder()`. Running templates support `target_duration` and `target_elevation_gain`.
- `utils.ts` — `generateCanonicalName()` slugifies template name for cross-mesocycle identity tracking
- `slot-actions.ts` — `addExerciseSlot()` (optional `section_id` for mixed templates), `updateExerciseSlot()`, `removeExerciseSlot()`, `toggleSlotRole()`, `reorderExerciseSlots()` Server Actions with Zod validation
- `slot-queries.ts` — `getSlotsByTemplate()` query with exercise join, returns `SlotWithExercise[]`
- `cascade-queries.ts` — `getCascadeTargets()` finds same-canonical-name templates across mesocycles for cascade operations; "this+future" scope uses `start_date` comparison (training timeline order, not creation order); `includeLogged` option to skip or include templates with logged workouts; `getCascadePreview()` returns preview data for the cascade scope selection UI
- `cascade-types.ts` — `CascadeScope`, `CascadeUpdates`, `CascadeSummary` shared types — safe to import from client components
- `cascade-actions.ts` — `cascadeUpdateTemplates()` Server Action for atomic cascade updates (name/notes) across sibling templates, skips templates with logged workouts inside a transaction
- `section-actions.ts` — `createMixedTemplate()`, `addSection()`, `removeSection()`, `reorderSections()`, `updateSection()` Server Actions for mixed-modality templates and template_sections management; `updateSection` supports renaming `section_name`
- `slot-matching.ts` — `findMatchingSlots()` matches exercise slots between source and target templates by exercise ID, order, and role; exports `SlotIdentifier`, `MatchType`, `SlotMatch`, `SkipReason`, `SlotMatchResult`
- `cascade-slot-ops.ts` — `cascadeAddSlot()`, `cascadeRemoveSlot()` Server Actions for atomic cascade add/remove of exercise slots across sibling templates, skips templates with logged workouts
- `superset-actions.ts` — `createSuperset()`, `breakSuperset()`, `updateGroupRest()` Server Actions for grouping/ungrouping exercise slots into supersets and updating inter-set rest
- `copy-actions.ts` — `copyTemplateToMesocycle()` Server Action: deep-copies a template (with sections, slots, superset groups) to another mesocycle, enforcing canonical_name uniqueness and completed-meso guard
- `browse-queries.ts` — `getBrowseTemplates()` fetches all templates from other mesocycles with exercise counts for the browse/copy dialog; exports `BrowseTemplate` type
- `cascade-batch.ts` — `batchCascadeSlotEdits()` Server Action for atomic batch cascade of multiple slot parameter edits across sibling templates in a single transaction; matches slots via `findMatchingSlots`
- `transfer-actions.ts` — `copyExerciseSlots()`, `moveExerciseSlots()` Server Actions for copying/moving exercise slots between templates with group_id remapping, completed-meso guards, cross-template validation, and reorder-after-move
- `transfer-queries.ts` — `getTransferTargets()` loads active/planned mesocycles with compatible templates (resistance + mixed) and resistance sections; exports `TransferTarget`, `TransferTargetTemplate`, `TransferTargetSection` types
- `transfer-helpers.ts` — `collectGroupSlotIds()`, `shouldPromptSuperset()` utilities for detecting superset membership and collecting group slot IDs before copy/move
- `cascade-slot-params.ts` — `cascadeSlotParams()` Server Action for cascading individual slot parameter edits (sets, reps, weight, rpe, rest, guidelines) across sibling templates via `findMatchingSlots`, skips templates with logged workouts
- `section-queries.ts` — `getSectionsForTemplate()` fetches `template_sections` rows for a template ordered by section order; exports `TemplateSectionRow` type
- `use-pending-edits.ts` — `usePendingEdits()` client hook for tracking slot-level edits before batch cascade; exposes `markEdited`, `clearAll`, `clearOne`, `isEdited`, `hasPendingEdits`, `pendingEditIds`
- `estimate-duration.ts` — pure duration estimation functions (no DB): `estimateTemplateDuration()` dispatches by modality; `estimateResistanceDuration()` (set time + rest, superset-aware), `estimateRunningDuration()`, `estimateMmaDuration()`, `estimateMixedDuration()`; `snapDuration()` rounds to 15-min increments (15–300 min); `applySlotOverrides()`, `applyTemplateOverrides()`, `applySectionOverrides()` for week-level override application; exports `SlotForEstimate`, `SectionForEstimate`, `TemplateForEstimate`, `SlotWithId`, `SlotWeekOverride`, `TemplateWeekOverride`
- `recompute-duration.ts` — `recomputeEstimatedDuration(templateId)` DB-backed action: loads template + slots (+ sections for mixed), calls `estimateTemplateDuration`, writes result to `workout_templates.estimated_duration`
- `reorder-slots.test.ts` — tests for exercise slot reorder behavior
