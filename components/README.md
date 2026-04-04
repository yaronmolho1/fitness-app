# components/

Shared React components — app-level UI and navigation.

## Files
- `sidebar.tsx` — `Sidebar` desktop nav (hidden on mobile), 5 nav items + logout button
- `bottom-bar.tsx` — `BottomBar` mobile nav (hidden on desktop), 5 nav items
- `login-form.tsx` — `LoginForm` card with username/password, calls `/api/auth/login`
- `exercise-form.tsx` — `ExerciseForm` create form with name, modality, muscle group, equipment fields
- `exercise-picker.tsx` — `ExercisePicker` searchable exercise selector with optional `modality` filter (defaults to resistance), onSelect callback
- `mesocycle-form.tsx` — `MesocycleForm` create/edit form with name, start date (DatePicker), work weeks, deload toggle, live end date preview; supports `mode` prop for create vs edit
- `schedule-grid.tsx` — `ScheduleGrid` 7-day weekly schedule grid; assign/replace/remove template per day slot via `assignTemplate`/`removeAssignment` actions; supports rotation slots (cycle_length > 1) with badge display, popover summary, and "Edit Rotation"/"Remove" actions; "Add Workout" offers "Assign template" or "Assign rotation" choice; read-only when mesocycle is completed
- `status-badge.tsx` — `StatusBadge` colored pill for mesocycle status (planned/active/completed)
- `slot-list.tsx` — `SlotList` renders exercise slots for a template with drag-reorder (desktop drag-and-drop + mobile long-press), inline edit (sets/reps/weight/RPE/rest/guidelines), remove confirmation, add-exercise picker, and superset management (selection mode to group/ungroup slots, visual grouping with label + shared group rest editing); tracks pending edits via `usePendingEdits` hook, shows pending-edit banner with "Apply" to open `BatchCascadeScopeSelector` for bulk cascade; triggers `SlotCascadeScopeSelector` after add/remove/superset changes; navigate-away warning when edits are pending; optional `workWeeks`/`hasDeload` props enable "Plan Weeks" button per slot opening `WeekProgressionGrid`; `SlotRow` internal component
- `slot-cascade-scope-selector.tsx` — `SlotCascadeScopeSelector` 3-step cascade flow (scope select, confirm with preview, summary) for slot-level operations (update-params, add-slot, remove-slot) across mesocycles; scope options: this-only, this+future, all-phases; skips templates with logged workouts
- `batch-cascade-scope-selector.tsx` — `BatchCascadeScopeSelector` 2-step cascade flow (scope select, confirm) for applying multiple slot edits at once via `batchCascadeSlotEdits`; scope options: this-only, this+future, all-phases
- `status-transition-button.tsx` — `StatusTransitionButton` activates or completes a mesocycle via server actions, with confirmation dialog on complete
- `cascade-toast.ts` — `fireCascadeToast()` and `fireBatchCascadeToast()` toast notifications after single or batch cascade operations; shows success/warning based on scope and skip count
- `cascade-scope-selector.tsx` — `CascadeScopeSelector` 3-step cascade flow (scope select, confirm with preview, summary) for applying template changes across mesocycles; scope options: this-only, this+future, all-phases; skips templates with logged workouts
- `template-section.tsx` — `TemplateSection` manages templates for a mesocycle: create (resistance/running/MMA-BJJ), edit name, delete, renders `SlotList` per template, and integrates `CascadeScopeSelector` for cascade edits
- `edit-exercise-form.tsx` — `EditExerciseForm` inline edit form for exercises with name, modality, muscle group, equipment fields
- `exercise-list-with-filters.tsx` — `ExerciseListWithFilters` searchable exercise list with modality filter, inline edit/delete via `EditExerciseForm`
- `running-template-form.tsx` — `RunningTemplateForm` create form for running templates with run type, pace, HR zone, interval fields
- `mma-bjj-template-form.tsx` — `MmaBjjTemplateForm` create form for MMA/BJJ templates with planned duration
- `schedule-tabs.tsx` — `ScheduleTabs` normal/deload tab switcher, renders `ScheduleGrid` per week type
- `today-workout.tsx` — `TodayWorkout` fetches and displays today's workout: mesocycle context, template name, exercise slots with sets/reps/weight/RPE/rest, superset grouping with group labels and shared rest; mixed template display via `MixedDisplay` with per-section renderers (`SectionResistanceContent`, `SectionRunningContent`, `SectionMmaContent`); time+duration info line in header; `formatPeriodLabel` shows "HH:MM — Xmin" when available; "Log Workout" button transitions to logging form
- `time-display-views.test.tsx` — unit tests for time-first display across calendar grid, day detail, and today views
- `time-display-views.characterize.test.tsx` — characterization tests capturing pre-refactor display behavior
- `workout-logging-form.tsx` — `WorkoutLoggingForm` client component: pre-filled resistance logging form with per-set actual weight/reps/RPE inputs alongside read-only planned values, superset grouping with group labels and shared rest display, numeric mobile keyboards, submit via server action
- `progression-chart.tsx` — `ProgressionChart` client component: exercise selector + weight/volume toggle, fetches progression data from API, renders planned vs actual line chart with phase-colored dots via Recharts
- `routine-check-off.tsx` — `RoutineCheckOff` daily routine check-off list: per-item value inputs (weight/length/duration/sets/reps based on config), Done/Skip buttons, logged items shown with recorded values; `RoutineCheckOffCard` internal component
- `calendar-grid.tsx` — `CalendarGrid` client component: month grid with Mon–Sun columns, fetches projected calendar data from `/api/calendar`, color-coded day cells by modality (resistance/running/MMA), prev/next month navigation; pills show "HH:MM Template" (falls back to period label); entries sorted chronologically by time_slot; click any day to open `DayDetailPanel`
- `calendar-grid.test.tsx` — unit tests for `CalendarGrid` time-first pill display and chronological sorting
- `day-detail-panel.tsx` — `DayDetailPanel` slide-over sheet: fetches `/api/calendar/day` for selected date, displays rest message, projected workout (slots/running/MMA detail), or completed workout (planned vs actual sets, rating, notes); time badge shows "HH:MM — Xmin" when time_slot+duration available, falls back to period label; workouts sorted by time_slot
- `day-detail-panel.test.tsx` — unit tests for `DayDetailPanel` time badge formatting and time-based sorting
- `clone-mesocycle-form.tsx` — `CloneMesocycleForm` clones a mesocycle via `cloneMesocycle` server action
- `edit-routine-item-form.tsx` — `EditRoutineItemForm` inline edit form for routine items (name, scope, frequency, value config)
- `routine-item-list.tsx` — `RoutineItemList` displays routine items with badges, inline edit/delete via `EditRoutineItemForm`
- `running-logging-form.tsx` — `RunningLoggingForm` post-workout logging form for running templates (pace, HR, intervals)
- `mma-logging-form.tsx` — `MmaLoggingForm` post-workout logging form for MMA/BJJ templates (duration, feeling, notes)
- `empty-state.tsx` — `EmptyState` shared empty state with optional icon, message, description, and action button
- `mixed-template-form.tsx` — `MixedTemplateForm` creation form for mixed-modality templates: name input, dynamic section editor (add/remove/reorder), per-section modality-specific fields, 2+ sections with 2+ modalities validation
- `mixed-logging-form.tsx` — `MixedLoggingForm` post-workout logging form for mixed-modality templates with per-section resistance/running/MMA inputs
- `frequency-mode-selector.tsx` — `FrequencyModeSelector` radio group for routine frequency (daily, weekly target, specific days) with day picker
- `create-routine-item-form.tsx` — `CreateRoutineItemForm` form for adding routine items with name, category, input fields, frequency mode, scope
- `template-add-picker.tsx` — `TemplateAddPicker` "Add Template" button with modality picker (resistance/running/MMA/mixed/from-existing); popover on desktop, bottom sheet on mobile
- `target-picker-modal.tsx` — `TargetPickerModal` 3-step dialog for selecting copy/move target: mesocycle → template → section (mixed only); exports `ConfirmPayload` type
- `template-browse-dialog.tsx` — `TemplateBrowseDialog` searchable dialog listing templates from other mesocycles grouped by mesocycle, with copy button per template
- `superset-transfer-prompt.tsx` — `SupersetTransferPrompt` dialog for copy/move of superset slots: prompts user to transfer single slot or entire superset group
- `move-workout-modal.tsx` — `MoveWorkoutModal` dialog for moving a scheduled workout to a different day/time; shows 7-day grid, time slot + duration inputs with overlap detection against existing workouts, scope toggle (this week / remaining weeks); exports `OccupiedSlot` type
- `move-workout-modal.test.tsx` — unit tests for `MoveWorkoutModal` (time-first move flow)
- `move-workout-modal.characterize.test.tsx` — characterization tests capturing pre-refactor behavior of `MoveWorkoutModal`
- `week-progression-grid.tsx` — `WeekProgressionGrid` dialog with per-week override grid (rows = weeks + optional deload, columns = modality-specific fields); pre-fills base values, deload defaults (60% weight, 50% sets, RPE−2); saves via `upsertWeekOverrideAction`/`deleteWeekOverrideAction`; read-only when mesocycle is completed
- `rotation-editor-modal.tsx` — `RotationEditorModal` dialog for editing per-day template rotation cycles; configures cycle length (2–8) and assigns a template to each cycle position; saves via `assignRotation`; props: `mesocycleId`, `dayOfWeek`, `weekType`, `timeSlot`, `duration`, `existingRotation`, `templates`

## Subdirectories
- `coaching/` — coaching summary UI: subjective state capture, coaching insights ([README](./coaching/README.md))
- `coaching/` — coaching profile UI: athlete profile form with biometrics and training preferences
- `layout/` — app shell and page layout primitives: desktop sidebar, mobile header + drawer, page container, page header, section heading ([README](./layout/README.md))
- `schedule/` — schedule assignment UI: period selector, time slot picker ([README](./schedule/README.md))
- `ui/` — shadcn/ui primitives ([README](./ui/README.md))
