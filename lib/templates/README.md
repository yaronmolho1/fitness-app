# templates/

Workout template server actions for all modalities (resistance, running, MMA/BJJ).

## Files
- `actions.ts` — `createResistanceTemplate()`, `createRunningTemplate()`, `createMmaBjjTemplate()`, `updateTemplate()`, `deleteTemplate()` with canonical name uniqueness per mesocycle, completed-mesocycle guard
- `utils.ts` — `generateCanonicalName()` slugifies template name for cross-mesocycle identity tracking
- `slot-actions.ts` — `addExerciseSlot()`, `updateExerciseSlot()`, `removeExerciseSlot()`, `toggleSlotRole()`, `reorderExerciseSlots()` Server Actions with Zod validation
- `slot-queries.ts` — `getSlotsByTemplate()` query with exercise join, returns `SlotWithExercise[]`
- `cascade-queries.ts` — `getCascadeTargets()` finds same-canonical-name templates across mesocycles for cascade operations, with `includeLogged` option to skip or include templates that have logged workouts
- `cascade-actions.ts` — `cascadeUpdateTemplates()` Server Action for atomic cascade updates (name/notes) across sibling templates, skips templates with logged workouts inside a transaction
