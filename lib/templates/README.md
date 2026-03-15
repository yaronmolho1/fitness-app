# templates/

Workout template server actions for all modalities (resistance, running, MMA/BJJ).

## Files
- `actions.ts` — `createResistanceTemplate()`, `createRunningTemplate()`, `createMmaBjjTemplate()`, `updateTemplate()`, `deleteTemplate()` with canonical name uniqueness per mesocycle, completed-mesocycle guard
- `utils.ts` — `generateCanonicalName()` slugifies template name for cross-mesocycle identity tracking
- `slot-actions.ts` — `addExerciseSlot()`, `updateExerciseSlot()`, `removeExerciseSlot()`, `toggleSlotRole()` Server Actions with Zod validation
- `slot-queries.ts` — `getSlotsByTemplate()` query with exercise join, returns `SlotWithExercise[]`
