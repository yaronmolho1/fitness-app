# Routine Streaks & Counts
**Status:** done
**Epic:** Daily Routines
**Depends:** specs/daily-routine-check-off.md

## Description
As an athlete, I can see my weekly completion count and streak per routine item, so I stay motivated to maintain my habits.

## Acceptance Criteria

### Weekly Completion Count
- [ ] Each routine item in the check-off view displays a weekly completion count
- [ ] Weekly count = number of `routine_logs` rows for that item with `status = 'done'` within the current calendar week (Mon–Sun)
- [ ] Skipped logs (`status = 'skipped'`) do not count toward the weekly completion count
- [ ] Days with no log do not count toward the weekly completion count
- [ ] Weekly count resets at the start of each new calendar week (Monday)
- [ ] Weekly count is displayed alongside the frequency target (e.g. "3 / 5 this week") so the athlete can see progress toward goal
- [ ] If the item has no logs this week, count displays as 0

### Streak
- [ ] Each routine item displays a current streak count (consecutive days completed)
- [ ] Streak = number of consecutive calendar days ending on today (or yesterday if today has no log yet) where the item has a `routine_logs` row with `status = 'done'`
- [ ] A `skipped` log on a day breaks the streak (streak resets to 0)
- [ ] A day with no log also breaks the streak — no entry = streak broken at end of that day
- [ ] Exception: today with no log yet does NOT break the streak (the day isn't over) — the streak anchors to yesterday in this case
- [ ] Streak of 1 means the item was done today (or yesterday with no log yet today)
- [ ] Streak of 0 means the item was not done today or yesterday
- [ ] Streak is displayed as a number with a label (e.g. "5-day streak") — exact visual treatment defined at implementation

### Display
- [ ] Both weekly count and streak are visible per item without requiring any tap or expansion
- [ ] Display updates immediately after a new check-off is recorded (no page reload required)

## Edge Cases
- Item with no logs at all: weekly count = 0, streak = 0
- Item done every day this week but skipped yesterday: streak = 0 (skip breaks it), weekly count still reflects the done days before the skip
- Item done yesterday but not yet today: streak >= 1 (anchors to yesterday since today isn't over)
- Item done today but not yesterday: streak = 1
- Week boundary (Monday): weekly count resets; streak is unaffected by week boundary (streak is calendar-day consecutive, not week-bounded)
- Item that was active last week but is no longer active today (e.g. date_range expired): streak and count computed from historical logs but item not shown in active check-off list
- Frequency target of 7 (daily): weekly count of 7 means full completion
- Item logged as done with partial fields filled (e.g. sets but not reps): still counts as done for streak/count purposes — any filled field = done

## Test Requirements
- Unit: weekly count — count only `done` logs in current Mon–Sun week
- Unit: weekly count excludes `skipped` logs
- Unit: streak — consecutive `done` days ending on today
- Unit: streak broken by a `skipped` log
- Unit: streak broken by a missing log day (after that day ends)
- Unit: streak counts yesterday as anchor when today has no log yet
- Unit: streak = 0 when neither today nor yesterday has a `done` log
- Unit: partial field fill (weight only on a 3-field item) still counts as done for streak
- Integration: log item as done 3 days in a row → verify streak = 3
- Integration: log item as done, then skip next day → verify streak = 0
- Integration: cross-week boundary — verify weekly count resets on Monday
