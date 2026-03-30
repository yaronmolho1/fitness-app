# exercises/

Exercise CRUD server actions and queries.

## Files
- `actions.ts` — `createExercise()` with zod validation + case-insensitive duplicate check, `editExercise()` with zod validation + case-insensitive duplicate check excluding self, `deleteExercise()` with slot-usage protection
- `queries.ts` — `getExercises()` returns all exercises ordered by creation date desc. `getDistinctExerciseValues()` returns sorted unique equipment and muscle_group values for filter dropdowns.
- `filters.ts` — `filterExercises()` client-side search + modality filter helper, `Modality` type
