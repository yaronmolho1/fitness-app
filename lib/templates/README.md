# templates/

Workout template server actions for all modalities (resistance, running, MMA/BJJ).

## Files
- `actions.ts` — `createResistanceTemplate()`, `createRunningTemplate()`, `createMmaBjjTemplate()`, `updateTemplate()`, `deleteTemplate()` with canonical name uniqueness per mesocycle, completed-mesocycle guard
- `utils.ts` — `generateCanonicalName()` slugifies template name for cross-mesocycle identity tracking
- `slot-actions.ts` — `addExerciseSlot()`, `updateExerciseSlot()`, `removeExerciseSlot()`, `toggleSlotRole()`, `reorderExerciseSlots()` Server Actions with Zod validation
- `slot-queries.ts` — `getSlotsByTemplate()` query with exercise join, returns `SlotWithExercise[]`
- `cascade-queries.ts` — `getCascadeTargets()` finds same-canonical-name templates across mesocycles for cascade operations, with `includeLogged` option to skip or include templates that have logged workouts; `getCascadePreview()` returns preview data (mesocycle names, logged-workout flags, skipped count) for the cascade scope selection UI
- `cascade-types.ts` — `CascadeScope`, `CascadeUpdates`, `CascadeSummary` shared types — safe to import from client components
- `cascade-actions.ts` — `cascadeUpdateTemplates()` Server Action for atomic cascade updates (name/notes) across sibling templates, skips templates with logged workouts inside a transaction
- `section-actions.ts` — `createMixedTemplate()`, `addSection()`, `removeSection()`, `reorderSections()` Server Actions for mixed-modality templates and template_sections management
- `slot-matching.ts` — `findMatchingSlots()` matches exercise slots between source and target templates by exercise ID, order, and role; exports `SlotIdentifier`, `MatchType`, `SlotMatch`, `SkipReason`, `SlotMatchResult`
- `cascade-slot-ops.ts` — `cascadeAddSlot()`, `cascadeRemoveSlot()` Server Actions for atomic cascade add/remove of exercise slots across sibling templates, skips templates with logged workouts
- `superset-actions.ts` — `createSuperset()`, `breakSuperset()`, `updateGroupRest()` Server Actions for grouping/ungrouping exercise slots into supersets and updating inter-set rest
- `copy-actions.ts` — `copyTemplateToMesocycle()` Server Action: deep-copies a template (with sections, slots, superset groups) to another mesocycle, enforcing canonical_name uniqueness and completed-meso guard
- `browse-queries.ts` — `getBrowseTemplates()` fetches all templates from other mesocycles with exercise counts for the browse/copy dialog; exports `BrowseTemplate` type
