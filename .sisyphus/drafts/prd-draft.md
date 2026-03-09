# PRD Draft: Fitness Tracking App

## Known Context (from work plan)
- Replaces 4-sheet Excel system (running, push, pull, daily follow-up)
- Core problem: plan/log coupled in Excel — edits break history
- Architecture: mesocycle-scoped templates, snapshot logging, cascade UX
- Desktop planning, mobile logging
- Single user (self-use)
- Part of "second brain / life management" ecosystem
- Modalities: resistance, running, MMA/BJJ
- Daily routines habit tracker included
- V2 items explicitly parked: LLM, Garmin, Google Calendar, nutrition

## JTBD Interview

### Job Framing
- **Trigger**: All three equally frequent — planning next phase, post-workout logging, reviewing past performance
- **Core pain**: Cascade is manual. Same exercise/change appears in multiple sheets/weeks — user updates each one by hand
- **Main job statement (draft)**: "When I'm managing my training across planning, execution, and review, I want changes to the plan to cascade automatically while keeping my logged history immutable, so I can evolve my programming without tedious manual propagation or data loss."

### Outcome Expectations
- **Success signals (month 1)**:
  1. Stopped opening Excel entirely for training
  2. Planning next mesocycle takes minutes, not an hour of copy-pasting
  3. Post-workout logging is frictionless (<2 min on phone)
- **V1 #1 priority**: Plan → log separation. Edit plans freely, history never breaks.
- **Implication**: If plan/log separation works perfectly but other features are rough, V1 is still a win. If everything else is polished but plan/log separation is janky, V1 fails.

### Current Solution + Hiring Criteria
- **Current solution**: 4-sheet Excel (running, push, pull, daily follow-up)
- **Tried alternatives**: Some existing apps, found planning model insufficient (mesocycles/phasing not supported)
- **Why build custom**: Existing apps are rigid on planning. Can't do mesocycle-scoped templates with cascade edits.
- **Dealbreaker**: If logging on phone takes longer than Excel → back to Excel
- **Hiring criteria (draft)**: The app gets "hired" when it makes plan iteration + mobile logging faster than Excel, with zero history loss.

### Market Research Findings (agent-sourced)

**No existing app supports user-authored mesocycle planning with cascade edits.**

| App | Planning | Mesocycle | Cascade |
|---|---|---|---|
| Strong / Hevy / JEFIT / FitNotes | Routine templates only | None | None |
| RP Hypertrophy ($25-35/mo) | Auto-regulated, algorithm-driven | Yes (4-6wk) | Partial (black-box, not user-editable) |
| Liftosaur | Scriptable programs | Partial (text DSL) | None |
| wger (OSS) | Weekly routine builder | None | None |

**Reddit validation (direct quotes):**
- "no app could do it... They're always good for tracking, but not for programming your own workouts" — r/naturalbodybuilding
- "they're either just workout logs where you type in your sets and reps (cool, I could use a spreadsheet for that) or they charge $10/month for the same thing with a nicer UI" — r/iosapps
- Spreadsheets ARE the actual tool serious lifters use (Nuckols SBS templates, RP spreadsheets, custom Google Sheets)

**Gap this app fills:**
1. User-authored mesocycle planning (not a black-box algorithm)
2. Plan vs log separation (planned state that logs compare against)
3. Cascade edits (propagate changes forward intelligently)
4. Self-hosted + data ownership
5. Multi-modality in one system (resistance + running + MMA/BJJ)

### V1 Scope Decision
- **Plan IS the V1** — everything in the plan stays. User already scoped carefully. No cuts.

### Audience Segments
Single user, two usage contexts:

| Context | When | Where | Mindset |
|---------|------|-------|---------|
| **Coach** | Planning phases, editing templates, reviewing progress | Desktop | Deliberate, designing, analyzing |
| **Athlete** | Post-workout logging, daily routine check-off | Mobile | Fast, minimal friction |

V2: LLM augments the Coach context (AI sounding board for programming decisions).

### Story Map (Draft)

**Activity 1: Design a Training Phase** (Coach)
- Create mesocycle (name, dates, work weeks, deload toggle)
  - As a coach, I want to define a training block with dates and deload, so I can plan a structured phase.
- Clone templates from previous phase
  - As a coach, I want to carry forward my templates to a new phase, so I don't rebuild from scratch.
- Build/edit workout templates with exercises
  - As a coach, I want to add exercises with sets/reps/weight/RPE targets, so my athlete-self knows what to do.
  - As a coach, I want running templates with pace/zone/interval fields, so run plans are first-class.
- Set weekly schedule (normal + deload)
  - As a coach, I want to assign templates to days, with a separate deload schedule, so each week is pre-planned.
- Cascade template changes to future phases
  - As a coach, I want edits to propagate ("this phase / future / all"), so I don't manually update each phase.

**Activity 2: Look Ahead** (Coach)
- View calendar with projected workouts
  - As a coach, I want to see months ahead with correct workouts on correct days, so I can validate my plan.
- Review progression for an exercise across phases
  - As a coach, I want to see planned vs actual for an exercise over time, so I can make informed programming decisions.

**Activity 3: Track Daily Habits** (Coach + Athlete)
- Manage routine items (create, scope, deactivate)
  - As a coach, I want to define mobility/rehab/stretching routines with flexible scoping, so they show up on the right days.
- Check off daily routines
  - As an athlete, I want to quickly mark routines done/skipped, so tracking takes seconds.

**Activity 4: Execute Today's Training** (Athlete)
- View today's planned workout on phone
  - As an athlete, I want to open the app and see exactly what I'm doing today, with all targets.
- Log resistance workout (actual reps, weight, RPE per set)
  - As an athlete, I want to fill in what I actually did against the plan, so my history is accurate.
- Log running workout (feeling + notes)
  - As an athlete, I want to log just how it felt (Garmin has full metrics), so I capture the subjective data.
- Log MMA/BJJ session (duration + feeling)
  - As an athlete, I want to record that I trained and for how long, so I track training load.

**Activity 5: Manage Exercise Library** (Coach)
- CRUD exercises with modality + muscle group
  - As a coach, I want a searchable exercise database, so I can build templates from a consistent library.

### Running Log Upgrade (DIFFERS FROM PLAN)
- **Plan says**: "Running: Plan display + minimal log (feeling, notes). Garmin has full metrics."
- **PRD decision**: 
  - ALL runs: actual distance, avg pace, **avg HR**, feeling, notes
  - Intervals additionally: per-interval actual pace + avg HR
- **Impact**: Task 15 needs schema/UI update — `loggedWorkouts` already has `actualAvgHr` but wasn't being used for "minimal" log. Now it's required for all runs. Intervals need per-rep HR + pace storage.
- **Schema implication**: `loggedWorkouts.actualAvgHr` used for all run types. Intervals need either `loggedSets`-style rows or a JSON array for per-interval data.

### UX Model Validated
- Desktop: sidebar + content area (shadcn pattern)
- Mobile: bottom tabs (Today, Calendar, Log, Settings)
- Logging: pre-filled actuals from plan, tap to change what differs
- Running plan display: structured per session type (easy/intervals/tempo)
- Running logging: feeling + pace + HR per interval, overall notes
- Cascade: dialog on template save ("this phase / future / all")

## Session State
Decisions made: [trigger=all-three, pain=manual-cascade, success=excel-retired+fast-planning+frictionless-logging, v1-priority=plan-log-separation, dealbreaker=slow-logging, why-custom=planning-model-gap, market-gap-validated, v1-scope=full-plan, contexts=coach+athlete, story-map-drafted, running-log=per-interval-pace+hr, ux-validated]
Open questions: []
Next topics: [GENERATE FINAL PRD]
