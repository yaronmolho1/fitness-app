# PRD: Fitness Tracking App

## Problem Statement

A serious lifter managing resistance training, running, and MMA/BJJ across periodized mesocycles currently uses a 4-sheet Excel system (push, pull, running, daily follow-up). The core problem: plan and log are coupled — when the training plan changes mid-cycle (swap an exercise, adjust rep scheme), every instance across multiple sheets must be updated manually. There's no cascade, no history protection, and no way to compare what was planned vs what actually happened.

No existing fitness app solves this. The market is full of workout *loggers* (Strong, Hevy, JEFIT, FitNotes) that record what you did but offer zero planning layer. RP Hypertrophy is the only mesocycle-aware app, but it's a $25-35/month black-box algorithm — you can't author your own programming. Spreadsheets remain the actual tool serious lifters use because apps don't support the planning model.

## Jobs-to-be-Done

**Primary JTBD:**
> When I'm managing my training across planning, execution, and review, I want changes to the plan to cascade automatically while keeping my logged history immutable, so I can evolve my programming without tedious manual propagation or data loss.

**Secondary JTBDs:**
> When I finish a workout, I want to log my actuals on my phone in under 2 minutes against a pre-filled plan, so logging doesn't feel like homework.

> When I'm planning the next training phase, I want to clone and modify templates from the previous phase, so building a new mesocycle takes minutes instead of an hour of copy-pasting.

> When I want to see what's coming, I want a calendar showing projected workouts weeks ahead with deload weeks clearly marked, so I can validate my plan at a glance.

## Audience Segments

Single user. Two usage contexts that drive distinct UX requirements:

| Context | When | Where | Mindset | Key Outcome |
|---------|------|-------|---------|-------------|
| **Coach** | Planning next phase, editing templates, reviewing progression, managing exercises | Desktop | Deliberate, designing, analytical | Plan iteration is fast and changes cascade correctly |
| **Athlete** | Post-workout logging, checking today's workout, marking daily routines | Mobile | Fast, minimal friction, post-exertion | Logging takes <2 minutes, pre-filled from plan |

**Current workaround:** 4-sheet Excel (push, pull, running, daily follow-up) with manual cascade across sheets.

**V2 expansion:** LLM augments the Coach context — AI as sounding board for programming decisions, reviewing logs and suggesting adjustments.

## Story Map

### Activity 1: Design a Training Phase (Coach)

- Task 1.1: Create mesocycle
  - Story: As a coach, I want to define a training block with name, start date, work weeks, and deload toggle, so I have a structured container for my phase.
  - Story: As a coach, I want the end date auto-calculated from start + weeks + deload, so I don't do date math.
  - Story: As a coach, I want status management (planned → active → completed), so I know where I am in my training timeline.

- Task 1.2: Clone from previous phase
  - Story: As a coach, I want to clone all templates, exercise slots, and schedules from a previous mesocycle into a new one, so I don't rebuild from scratch.
  - Story: As a coach, I want cloned templates to keep the same canonical names but get new IDs, so cross-phase linking works for progression tracking.

- Task 1.3: Build/edit workout templates
  - Story: As a coach, I want to create workout templates (Push A, Pull B, Easy Run) with modality-specific fields, so I can define any type of session.
  - Story: As a coach, I want to add exercises to resistance templates with sets, reps, weight, RPE, rest, and guidelines, so my athlete-self knows exactly what to do.
  - Story: As a coach, I want to mark exercises as main vs complementary, so the important lifts are visually distinct.
  - Story: As a coach, I want running templates with run type, target pace, HR zone, interval count/rest, and coaching cues, so run plans are first-class.
  - Story: As a coach, I want to drag-reorder exercises within a template, so I can sequence the workout logically.

- Task 1.4: Set weekly schedule
  - Story: As a coach, I want a 7-day grid where I assign templates to days, so each week is fully mapped.
  - Story: As a coach, I want separate Normal and Deload schedule tabs, so deload weeks use different templates entirely (not just lighter loads).
  - Story: As a coach, I want rest days to be explicitly empty (no template assigned), so they're visible in the plan.
  - Story: As a coach, I want to assign a time period (morning/afternoon/evening) and optional clock time to each scheduled workout, so days with multiple sessions are distinguishable.
  - Story: As a coach, I want to schedule multiple workouts per day (e.g., morning strength + evening run), so split sessions are first-class.

- Task 1.5: Cascade template changes
  - Story: As a coach, when I edit a template, I want to choose "Apply to: this phase only / this + all future / all phases," so changes propagate without me updating each phase manually.
  - Story: As a coach, I want cascade to never modify completed mesocycles, so past data stays intact.
  - Story: As a coach, when I edit exercise slot parameters (sets, reps, weight, RPE, rest) I want the same 3-scope cascade options, so I don't manually update each phase's slots.
  - Story: As a coach, when I add or remove an exercise from a template I want to cascade that change, so all future phases stay in sync.
  - Story: As a coach, I want to edit running template fields (pace, HR zone, intervals, cues) after creation with cascade, so running plans evolve across phases.

- Task 1.6: Build mixed-modality templates
  - Story: As a coach, I want to create a single workout template that contains both resistance and running sections (e.g., strength + conditioning finisher), so combined sessions are one logical unit.
  - Story: As a coach, I want to add ordered sections to a mixed template, each with its own modality and modality-specific configuration, so the workout flows from one type to another.
  - Story: As a coach, I want mixed templates to appear as a single entry in the weekly schedule and calendar, so they don't feel like two separate workouts.

### Activity 2: Look Ahead (Coach)

- Task 2.1: View projected calendar
  - Story: As a coach, I want a month calendar showing which workout is planned for each day, color-coded by modality, so I can validate my plan at a glance.
  - Story: As a coach, I want deload weeks visually distinct from work weeks, so phase structure is obvious.
  - Story: As a coach, I want logged days marked as completed (vs still-projected), so I can see adherence.
  - Story: As a coach, I want to click a day and see the full workout detail (exercises, targets), so I can drill in without navigating away.

- Task 2.2: Review progression
  - Story: As a coach, I want to select an exercise and see a chart of planned vs actual weight/volume across mesocycles, so I can make informed programming decisions.
  - Story: As a coach, I want phase boundaries marked on the chart, so I can see how transitions affected progress.

### Activity 3: Track Daily Habits (Coach + Athlete)

- Task 3.1: Manage routine items (Coach)
  - Story: As a coach, I want to create daily routine items (shoulder mobility, hip stretches, cold exposure) with category, custom input fields (weight, length, duration, sets, reps — pick 1+), and frequency target.
  - Story: As a coach, I want flexible scoping — global, per-mesocycle, date-range, or skip-on-deload — so routines appear only when relevant.
  - Story: As a coach, I want to set frequency as specific days of the week (like Google Calendar day selector), daily, or N times per week, so I control exactly when routines appear.
  - Story: As a coach, I want category selection via auto-suggest from existing categories with the option to type a new one, so categories stay consistent without a fixed list.

- Task 3.2: Check off daily routines (Athlete)
  - Story: As an athlete, I want to see today's active routines and quickly fill in values (= done) or explicitly skip, so tracking takes seconds.
  - Story: As an athlete, I want to see my weekly completion count or streak, so I stay motivated.

### Activity 4: Execute Today's Training (Athlete)

- Task 4.1: View today's workout
  - Story: As an athlete, I want to open the app on my phone and immediately see today's planned workout with all targets, so I know what I'm doing.
  - Story: As an athlete, on rest days I want to see "Rest Day" with just my daily routines, so the app is useful every day.
  - Story: As an athlete, if today's workout is already logged, I want to see a completion summary, so I don't accidentally re-log.

- Task 4.2: Log resistance workout
  - Story: As an athlete, I want every set pre-filled with the planned weight and reps, so I only tap to change what differs from the plan.
  - Story: As an athlete, I want to input actual reps, weight, and RPE per set, so my history reflects reality.
  - Story: As an athlete, I want to add or remove sets if I did more or fewer than planned, so the log matches what happened.
  - Story: As an athlete, I want to rate the workout (1-5) and add notes, so I capture subjective feel.
  - Story: As an athlete, I want the saved workout to be immutable (no edits after save), so my history is trustworthy.

- Task 4.3: Log running workout
  - Story: As an athlete, I want to log actual distance, avg pace, and avg HR for all run types, so I have key performance data alongside Garmin's full metrics.
  - Story: As an athlete, for interval sessions I want to log actual pace and avg HR per interval rep, so I can see which reps I nailed vs struggled.
  - Story: As an athlete, I want per-interval notes (optional, tap to expand), so I can annotate a rep that felt off.
  - Story: As an athlete, I want to rate the run and add overall notes, so subjective feel is captured.

- Task 4.4: Log MMA/BJJ session
  - Story: As an athlete, I want to log duration, feeling, and notes for combat sessions, so I track training load without technique detail.

### Activity 5: Manage Exercise Library (Coach)

- Task 5.1: CRUD exercises
  - Story: As a coach, I want a searchable exercise database with name, modality, muscle group, and equipment, so I can build templates from a consistent library.
  - Story: As a coach, I want to filter by modality (resistance/running/mma), so I find exercises fast.
  - Story: As a coach, I want deletion blocked if an exercise is used in a template, so I don't break existing plans.
  - Story: As a coach, I want the exercise creation form collapsed by default with a toggle to expand, so the page focuses on the library view.
  - Story: As a coach, I want equipment and muscle group fields as auto-suggest comboboxes populated from existing values, so I get consistency without rigid lists.

### Activity 6: Consult on Training (Coach)

- Task 6.1: Generate coaching context summary
  - Story: As a coach, I want to generate a markdown summary of my full training state (profile, plan, recent sessions, trends, upcoming schedule) so I can paste it into any LLM conversation and get contextual coaching advice without re-explaining my background every time.
  - Story: As a coach, I want to fill in my current subjective state (fatigue, soreness, sleep quality, injuries, notes) each time I generate a summary, so the coach/LLM knows how I feel right now.
  - Story: As a coach, I want a one-click copy button that puts the raw markdown into my clipboard, so exporting takes zero friction.

- Task 6.2: Manage athlete profile
  - Story: As a coach, I want to store my athlete profile (age, weight, height, gender, training age, primary goal, injury history) so the coaching summary includes who I am without me re-entering it.
  - Story: As a coach, I want to edit my profile inline on the coaching page with auto-save, so keeping it current is effortless.

### Activity 7: Navigation & Discoverability (Coach + Athlete)

- Task 7.1: Improve navigation
  - Story: As a user, I want progression accessible from the main navigation, so I can review my training history without hunting for it.
  - Story: As a user, I want quick links from calendar days and today's workout to template editing, so I can adjust plans without navigating through mesocycle details.
  - Story: As a user, I want consistent header spacing, padding, and typography across all pages, so the app feels polished and cohesive.

## V1 Scope (SLC Slice)

**Everything in this PRD is V1.** The scope was carefully designed during planning — no further cuts. The SLC rationale:

- **Simple**: Template-based planning with pre-filled logging minimizes both planning effort and logging friction. The user authors the plan once; the app does the rest.
- **Lovable**: The cascade UX ("apply to future phases") and pre-filled mobile logging are the two moments of delight. These eliminate the two biggest Excel pain points.
- **Complete**: The full job is covered end-to-end — from designing a mesocycle through daily execution to reviewing progression. Every training modality (resistance, running, MMA/BJJ) plus daily habits.

**V1 stories in scope:** All stories listed in the Story Map above.

### Out of scope for V1

- Automatic plan/program generation (user is the coach, not the app)
- Per-exercise deload modifiers (deload uses entirely separate templates)
- Auto-progression logic (manual in V1; user decides when to increase)
- Google Calendar sync
- Garmin/Strava API import
- In-app LLM chat or AI-generated recommendations
- Nutrition tracking
- PWA/offline support
- Dark mode
- Bulk import from Excel
- Complex analytics beyond single-exercise progression charts
- Multi-user / sharing

## Parking Lot

| Idea | Context | Priority |
|------|---------|----------|
| LLM-assisted progression | AI reviews past logs and suggests next phase programming (builds on coaching summary) | V2 — high |
| Garmin/Strava import | Auto-fill running metrics from watch data | V2 — high |
| Google Calendar sync | Show workouts alongside life calendar | V2 — medium |
| Nutrition tracking | Macros/calories alongside training | V2 — low |
| Bulk Excel import | Migrate historical data from current spreadsheets | V2 — medium |
| Auto-progression | Algorithm suggests weight/rep increases | V2 — medium |
| PWA + offline | Work without connection, sync on reconnect | V2 — medium |
| Dark mode | Theme preference | V2 — low |
| Ecosystem integration | Fitness as module in "second brain / life management" system | V2+ — architectural |

## Open Questions

| Question | Owner | Impact |
|----------|-------|--------|
| Per-interval running data storage: extend `loggedSets` for run intervals, or add JSON array field on `loggedWorkouts`? | Tech design | Schema decision — doesn't affect PRD-level behavior, but needs resolving before Task 2 (schema) |
| Should running interval plan templates support variable-distance intervals (e.g., 400-800-1200-800-400 ladder)? Or only uniform intervals (6×800m)? | Product | Affects template schema complexity. Uniform is simpler for V1. |
| Clone flow: should clone create the mesocycle AND clone in one action, or two steps (create empty → then clone into it)? | UX | Affects mesocycle creation flow. One-step is better UX. |
