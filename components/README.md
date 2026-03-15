# components/

Shared React components — app-level UI and navigation.

## Files
- `sidebar.tsx` — `Sidebar` desktop nav (hidden on mobile), 5 nav items + logout button
- `bottom-bar.tsx` — `BottomBar` mobile nav (hidden on desktop), 5 nav items
- `login-form.tsx` — `LoginForm` card with username/password, calls `/api/auth/login`
- `exercise-form.tsx` — `ExerciseForm` create form with name, modality, muscle group, equipment fields
- `exercise-picker.tsx` — `ExercisePicker` searchable exercise selector, resistance-only filter, onSelect callback
- `mesocycle-form.tsx` — `MesocycleForm` create form with name, start date, work weeks, deload toggle, live end date preview
- `schedule-grid.tsx` — `ScheduleGrid` 7-day weekly schedule grid; assign/replace/remove template per day slot via `assignTemplate`/`removeAssignment` actions; read-only when mesocycle is completed
- `status-badge.tsx` — `StatusBadge` colored pill for mesocycle status (planned/active/completed)
- `slot-list.tsx` — `SlotList` renders exercise slots for a template with inline edit (sets/reps/weight/RPE/rest/guidelines), remove confirmation, and add-exercise picker; `SlotRow` internal component
- `status-transition-button.tsx` — `StatusTransitionButton` activates or completes a mesocycle via server actions, with confirmation dialog on complete
- `template-section.tsx` — `TemplateSection` manages templates for a mesocycle: create (resistance/running/MMA-BJJ), edit name, delete, and renders `SlotList` per template

## Subdirectories
- `ui/` — shadcn/ui primitives (Button, Card, Input, Label)
