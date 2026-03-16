# workouts/

Workout logging: validates input, snapshots the template, and inserts immutable log records in a single transaction.

## Files
- `actions.ts` — Server Action entry point (`saveWorkout`), handles cache revalidation
- `save-workout.ts` — Core logic (`saveWorkoutCore`): input validation, template snapshot, atomic insert of logged_workouts + logged_exercises + logged_sets
- `duplicate-check.ts` — `hasExistingLog` guard: prevents logging the same date + mesocycle combination twice
- `save-running-workout.ts` — `saveRunningWorkoutCore`: validates running workout input, snapshots template, inserts logged_workouts with interval rep data
- `save-mma-workout.ts` — `saveMmaWorkoutCore`: validates MMA/BJJ workout input, snapshots template, inserts logged_workouts with duration/feeling
- `actions.test.ts` — Integration tests for saveWorkoutCore covering validation, snapshot shape, and transaction atomicity
