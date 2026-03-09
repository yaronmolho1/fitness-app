# Already-Logged Summary
**Status:** ready
**Epic:** Today's Workout
**Depends:** specs/view-todays-planned-workout.md, specs/pre-filled-resistance-logging.md

## Description
As an athlete, if today's workout is already logged, I can see a completion summary instead of the log form, so I don't accidentally re-log the same workout.

## Acceptance Criteria

### Detection Logic
- [ ] After resolving today's planned workout (active mesocycle → day → variant → template), check whether a `logged_workouts` row exists for today's calendar date AND the active mesocycle
- [ ] Detection uses today's calendar date (not timestamp) to match against `logged_workouts.logged_date`
- [ ] If a matching `logged_workouts` row exists, the already-logged summary is shown instead of the log form
- [ ] If no matching row exists, the normal workout view and log form are shown (per specs/view-todays-planned-workout.md)
- [ ] The check is performed as part of the `GET /api/today` response: the response includes a `logged` boolean or `type: already_logged` state

### Summary Content
- [ ] The summary displays the workout name (from `logged_workouts.canonical_name` or `template_snapshot`)
- [ ] The summary displays the date and time the workout was logged (`logged_at`)
- [ ] For resistance workouts: the summary shows the exercises logged with actual sets, reps, and weight (from `logged_exercises` / `logged_sets`)
- [ ] For running workouts: the summary shows actual distance, average pace, and average HR
- [ ] For MMA/BJJ workouts: the summary shows logged duration and notes
- [ ] If a workout rating was recorded, it is displayed
- [ ] If workout notes were recorded, they are displayed
- [ ] The summary is read-only — no edit controls are shown (logs are immutable per architecture)

### Re-logging Prevention
- [ ] No "Log Workout" button or log form is rendered when the already-logged summary is shown
- [ ] There is no UI path to create a second `logged_workouts` row for the same date + mesocycle combination
- [ ] The application layer does not permit inserting a duplicate `logged_workouts` row for the same date + mesocycle (enforced at Server Action level)

### Display
- [ ] The summary is clearly labeled to indicate the workout is already complete (e.g. "Workout Logged" or "Already Completed")
- [ ] The view is optimized for mobile

## Edge Cases
- Athlete logs a workout just before midnight and opens the app after midnight: the new day has no log yet — normal workout view is shown for the new day
- Active mesocycle changes (e.g. previous mesocycle completed, new one activated) on the same calendar date: detection checks the current active mesocycle, not any prior one
- Rest day: no log form is shown regardless; already-logged check is not applicable (no workout to log)
- No active mesocycle: no-active-mesocycle state shown; already-logged check is not applicable
- `logged_workouts` row exists for today but for a different mesocycle (edge case from mesocycle transition): not treated as already-logged for the current active mesocycle

## Test Requirements
- Unit: detection logic — `logged_workouts` row exists for today + active mesocycle → returns already-logged state
- Unit: detection logic — no `logged_workouts` row for today → returns normal workout state
- Unit: detection uses calendar date, not timestamp (midnight boundary)
- Integration: log a workout → reload `GET /api/today` → verify response indicates already-logged
- Integration: already-logged response includes summary data (exercises/sets or run fields depending on modality)
- Integration: attempt to insert second `logged_workouts` row for same date + mesocycle → verify rejected at Server Action layer
- E2E (mobile viewport): after logging, today's page shows summary with no log form visible
