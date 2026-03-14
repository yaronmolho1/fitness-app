# components/

Shared React components — app-level UI and navigation.

## Files
- `sidebar.tsx` — `Sidebar` desktop nav (hidden on mobile), 5 nav items + logout button
- `bottom-bar.tsx` — `BottomBar` mobile nav (hidden on desktop), 5 nav items
- `login-form.tsx` — `LoginForm` card with username/password, calls `/api/auth/login`
- `exercise-form.tsx` — `ExerciseForm` create form with name, modality, muscle group, equipment fields
- `exercise-picker.tsx` — `ExercisePicker` searchable exercise selector, resistance-only filter, onSelect callback
- `mesocycle-form.tsx` — `MesocycleForm` create form with name, start date, work weeks, deload toggle, live end date preview

## Subdirectories
- `ui/` — shadcn/ui primitives (Button, Card, Input, Label)
