# PRD: Per-Week Template Rotation + Smart Clone

## Problem Statement

Running training uses block periodization — different workout types (VO2 max, threshold, tempo) rotate across weeks within a mesocycle. The current system assigns one template per schedule slot for all weeks, forcing the athlete to use schedule week overrides as a workaround or flatten distinct workouts into one generic template. Additionally, when cloning a mesocycle, base template values reset to the original values instead of carrying forward the latest progression, requiring manual re-entry.

## Jobs-to-be-Done

**Primary**: When I plan a training block, I want to assign different running templates to different weeks in a repeating cycle, so my periodization structure is captured in the schedule itself.

**Secondary**: When I plan weeks for a rotated template, I want the plan-weeks grid to show only the weeks where that template actually appears, so I only input data that matters.

**Tertiary**: When I clone a mesocycle for the next training block, I want base values to automatically reflect my latest progression (not the original values), so I start from where I left off.

## Audience Segments

| Segment | Role | Primary JTBD | Current Workaround |
|---|---|---|---|
| Solo athlete (primary) | Single user, plans + logs own training | Rotate running templates across weeks within a mesocycle | Creates one generic "Running" template and uses week overrides to change parameters, losing the distinct template identity |

## Story Map

### Activity A: Define Template Rotation on a Schedule Slot

**Task A1: Set up a rotation cycle**
- As an athlete, I want to assign a repeating cycle of templates to a single schedule slot (e.g., Monday morning), so different weeks use different running workouts.
- As an athlete, I want to define the cycle length (e.g., 4 weeks), so the rotation repeats automatically across the mesocycle.

**Task A2: Assign templates to cycle positions**
- As an athlete, I want to pick which template goes in each position of the cycle (position 1 = VO2 max, position 2 = Threshold, etc.), so I control the rotation order.
- As an athlete, I want the same template to appear in multiple cycle positions (e.g., VO2 max in positions 1 and 3), so I can model real training splits.

**Task A3: Override rotation for specific weeks**
- As an athlete, I want to override the rotation for a specific week (e.g., swap week 7 from VO2 max to a Long Run), so I can handle exceptions without changing the entire cycle.

**Task A4: View effective schedule per week**
- As an athlete, I want the schedule view to show which template is effective for each week (derived from the rotation + any overrides), so I can verify my plan.
- As an athlete, I want the today view to resolve the correct template based on the current week's position in the cycle.

### Activity B: Plan Weeks Respects Rotation

**Task B1: Filter plan-weeks grid by template occurrence**
- As an athlete, I want the plan-weeks grid for a template to show only the weeks where that template appears (based on the rotation), so I don't see irrelevant weeks.
- As an athlete, I want week numbers in the grid to reflect actual mesocycle weeks (e.g., weeks 1, 3, 5, 7 — not renumbered 1-4).

**Task B2: Plan-weeks grid shows correct count**
- As an athlete, I want a template that appears once per cycle in a 12-week meso to show 3 rows (weeks 1, 5, 9), so the grid size matches reality.
- As an athlete, I want a template with no rotation (assigned every week) to show all weeks as it does today.

### Activity C: Clone Mesocycle with Latest Values

**Task C1: Clone inherits latest progression**
- As an athlete, I want cloning a mesocycle to use the last work week's effective values (base merged with overrides) as the new template's base values, so I don't regress to old numbers.
- As an athlete, I want this to apply to all override-able fields: weight, reps, sets, RPE for resistance; distance, duration, pace for running; planned_duration for MMA.

**Task C2: Clone preserves rotation structure**
- As an athlete, I want the cloned mesocycle to preserve the rotation cycle assignments, so I don't re-configure the weekly rotation.

## V1 Scope (SLC Slice)

**In scope:**

1. **Rotation cycle on schedule slots** — define N-week repeating cycle per slot (running templates only for V1)
2. **Cycle position assignment** — pick template per cycle position, same template allowed in multiple positions
3. **Per-week override on rotation** — swap template for a specific week, overriding the cycle
4. **Today/calendar view resolution** — resolve effective template from cycle + overrides for any given date
5. **Plan-weeks filtering** — show only weeks where template appears; real week numbers, not renumbered
6. **Clone inherits latest values** — last work week's effective values become new base on clone
7. **Clone preserves rotation** — cycle assignments carried to cloned mesocycle
8. **Google Calendar sync** — rotation-resolved templates sync correctly to GCal events (no extra work — sync already calls getEffectiveScheduleForDay)

**SLC rationale**: Delivers complete periodization workflow — define rotation, see correct templates per week, plan progression per-template with correct week counts, carry forward progression on clone. Running-only scope keeps complexity manageable.

### Out of scope for V1

- Rotation for resistance/MMA templates (future if needed)
- Visual cycle editor (drag to reorder positions) — simple select is enough
- Auto-progression across cycle positions (e.g., VO2 max auto-increases each appearance)
- Mid-mesocycle cycle length changes

## Design Decisions

1. **Schedule override always wins** over rotation-resolved template. If rotation says "week 3 = VO2 max" but an override moves that slot, the override wins.
2. **Deload week has its own assignment**, not part of the rotation cycle. Consistent with existing normal/deload split in `weekly_schedule.week_type`.
3. **Clone uses last work week's effective values** automatically — no week picker UI.

## Data Model Changes

### Modified: `weekly_schedule`

Add two columns:
```
cycle_length    INTEGER NOT NULL DEFAULT 1    -- 1 = no rotation (backward compat)
cycle_position  INTEGER NOT NULL DEFAULT 1    -- 1-based position within cycle
```

Unique index changes from `(mesocycle_id, day_of_week, week_type, time_slot, template_id)` to `(mesocycle_id, day_of_week, week_type, time_slot, cycle_position)` — enforces one template per cycle position per slot.

For a 4-week rotation on Monday 07:00:
| Row | day_of_week | time_slot | cycle_length | cycle_position | template_id |
|-----|-------------|-----------|--------------|----------------|-------------|
| 1   | 0           | 07:00     | 4            | 1              | 5 (VO2 max) |
| 2   | 0           | 07:00     | 4            | 2              | 6 (Threshold)|
| 3   | 0           | 07:00     | 4            | 3              | 5 (VO2 max) |
| 4   | 0           | 07:00     | 4            | 4              | 7 (Tempo)   |

Resolution for week W: active position = `((W - 1) % cycle_length) + 1`

### No changes to:
- `schedule_week_overrides` — overrides match by time_slot, work the same way
- `slot_week_overrides` / `template_week_overrides` — per-week parameter overrides unchanged

## Parking Lot

- Resistance template rotation (A/B splits within a week cycle)
- "Week template" concept — define entire week compositions as named templates
- Auto-suggest next cycle based on training log analysis
- Rotation patterns: undulating periodization, DUP support

## Open Questions

None — all resolved during discovery.
