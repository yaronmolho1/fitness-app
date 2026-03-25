# Coaching Summary
**Status:** todo
**Epic:** Coaching
**Depends:** specs/create-mesocycle.md, specs/create-resistance-templates.md, specs/pre-filled-resistance-logging.md, specs/app-shell-navigation.md

## Description
As a coach/athlete, I can generate a markdown summary of my full training state from a dedicated `/coaching` page, so that I can paste it into LLM conversations for training advice without manually compiling data.

## Acceptance Criteria

### Athlete Profile (persistent)
- [ ] A new `athlete_profile` table exists with columns: `id`, `age`, `weight_kg`, `height_cm`, `gender`, `training_age_years`, `primary_goal`, `injury_history`, `updated_at`
- [ ] The table is single-row (upsert semantics — insert if empty, update if exists)
- [ ] All fields except `id` are nullable
- [ ] The profile section renders at the top of `/coaching` with inline-editable fields
- [ ] Each field auto-saves on blur via `saveAthleteProfile` server action
- [ ] The server action performs an upsert: insert row 1 if missing, otherwise update row 1
- [ ] Numeric fields (`age`, `weight_kg`, `height_cm`, `training_age_years`) use number inputs with appropriate min/max
- [ ] `gender` uses a select input (male/female/other)
- [ ] `primary_goal` is a text input (free-form)
- [ ] `injury_history` is a textarea

### Subjective State (ephemeral)
- [ ] A subjective state section renders below the profile
- [ ] Fatigue rating: 1–5 scale input
- [ ] Soreness rating: 1–5 scale input
- [ ] Sleep quality rating: 1–5 scale input
- [ ] Current injuries: text input
- [ ] Additional notes: textarea
- [ ] All subjective fields are local state only — not persisted to any table
- [ ] Subjective state values are included in the summary generation request body

### Summary Generation
- [x] A "Generate Summary" button triggers `POST /api/coaching/summary`
- [x] The request body includes the subjective state fields
- [x] The route handler reads profile, plan, log, and progression data server-side
- [x] The response is a plain markdown string (content-type `text/plain` or JSON-wrapped)
- [x] The markdown includes these sections in order:
  1. **Athlete Profile** — key-value pairs from `athlete_profile` (omit null fields)
  2. **Current Plan** — active mesocycle name, start/end dates, weekly schedule with template names and exercise lists
  3. **Recent Sessions** — last 4 weeks of logged workouts: date, template name, exercises with sets/reps/weight/RPE, workout rating
  4. **Progression Trends** — per-exercise weight and volume trend summary (reuses `getProgressionData()`)
  5. **Subjective State** — fatigue/soreness/sleep ratings + injury/notes text from request body
  6. **Upcoming Plan** — next 7–14 days of projected schedule (reuses `getCalendarProjection()`)

### Summary Preview & Copy
- [x] After generation, the markdown renders in a `<pre>` block below the button
- [x] A "Copy to Clipboard" button appears next to the preview
- [x] Clicking copy writes the raw markdown to the clipboard via `navigator.clipboard.writeText`
- [x] Visual feedback confirms the copy (e.g. button text changes to "Copied!" for 2 seconds)

### Navigation
- [ ] A "Coaching" link is added to the app navigation after the Routines link
- [ ] The link uses the `BrainCircuit` icon from lucide-react
- [ ] The link navigates to `/coaching`
- [ ] The nav item shows as active when on the `/coaching` route
- [ ] The link appears in both desktop sidebar and mobile bottom bar

## Edge Cases
- No athlete profile saved yet: profile section renders with all fields empty/blank; summary omits the Athlete Profile section entirely
- No active mesocycle: Current Plan section says "No active mesocycle"; Upcoming Plan section is empty or omitted
- No logged workouts in last 4 weeks: Recent Sessions section says "No recent sessions"
- No progression data available: Progression Trends section is omitted
- Subjective state fields left blank: Subjective State section omits blank fields; if all blank, section is omitted
- Very long injury_history or notes text: rendered as-is in markdown (no truncation)
- Profile auto-save fails (network error): field reverts to previous value; toast error shown
- Clipboard API unavailable (older browser / non-HTTPS): copy button disabled or falls back gracefully with error message
- Multiple rapid blur events on profile fields: debounce or queue upserts to avoid race conditions
- Active mesocycle has no scheduled workouts for upcoming 14 days (e.g. rest week): Upcoming Plan section shows rest days or states "No upcoming workouts"

## Test Requirements
- Unit: `saveAthleteProfile` server action — upserts profile row; verify insert on first call, update on subsequent
- Unit: `saveAthleteProfile` — nullable fields accepted; partial updates preserve existing values
- Unit: summary markdown builder — no active mesocycle produces correct fallback text
- Unit: summary markdown builder — omits sections when data is empty (no profile, no logs, no progression)
- Unit: summary markdown builder — includes subjective state from request body
- Unit: summary markdown builder — Recent Sessions correctly limits to last 4 weeks by `log_date`
- Integration: `POST /api/coaching/summary` — returns valid markdown with all sections when full data exists
- Integration: `POST /api/coaching/summary` — returns gracefully degraded markdown when no mesocycle/logs exist
- Integration: `POST /api/coaching/summary` — requires authentication (returns 401 without auth cookie)
- Integration: `saveAthleteProfile` upsert — concurrent calls don't create duplicate rows
- E2E: navigate to `/coaching` — profile fields render and are editable
- E2E: edit a profile field, blur — value persists after page reload
- E2E: fill subjective state, click Generate Summary — markdown preview appears with expected sections
- E2E: click Copy to Clipboard — verify clipboard contains the markdown text
- E2E: navigation link appears in sidebar with BrainCircuit icon and highlights when active
