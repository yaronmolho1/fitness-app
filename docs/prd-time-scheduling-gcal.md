# PRD: Time-Based Workout Scheduling + Google Calendar Integration

## Problem Statement

Workouts are currently scheduled into coarse time slots (morning/afternoon/evening) — at most 3 per day, with no specific start time or duration. This makes the schedule imprecise and unusable as calendar data. Athletes want to see their training plan in Google Calendar alongside other commitments, with deep links back to the app for logging. This requires workouts to behave like proper calendar events: specific start time, defined duration, timezone-aware.

## Jobs-to-be-Done

**Primary**: When I plan my training week, I want each workout to have a specific start time and duration, so I can see exactly when and how long each session is.

**Secondary**: When I look at my Google Calendar, I want to see my upcoming workouts alongside other commitments, so I can plan my day without switching apps.

**Tertiary**: When I open a workout event in Google Calendar, I want to tap through to the app to see exercise details and log the workout, so I can go from reminder to action in one step.

## Audience Segments

| Segment | Role | Primary JTBD | Current Workaround |
|---|---|---|---|
| Solo athlete (primary) | Single user, plans + logs own training | See full training block as timed calendar events | Manually copies workout schedule to Google Calendar |

## Story Map

### Activity A: Schedule Workouts with Specific Times

**Task A1: Assign workout to a day with time + duration**
- As an athlete, I want to set a specific start time (HH:MM) when assigning a template to a day, so my schedule has precise timing.
- As an athlete, I want to set an expected duration (minutes) for each scheduled workout, so I know how long each session will take.
- As an athlete, I want the period (morning/afternoon/evening) to auto-derive from the time I enter, so workouts are still grouped visually.

**Task A2: View schedule with times**
- As an athlete, I want the calendar view to show start times on workout pills (e.g., "07:00 Push A"), so I can scan my week at a glance.
- As an athlete, I want the today view to show start time and duration for each session, so I know exactly when to start and how long it'll take.
- As an athlete, I want workouts sorted chronologically (not just by period), so the order reflects my actual day.

**Task A3: Move workouts with time awareness**
- As an athlete, I want to set a new start time when moving a workout to a different day/slot, so the override has proper timing.
- As an athlete, I want the move modal to default to the source workout's time, so I don't have to re-enter it for simple day swaps.

**Task A4: Manage unlimited workouts per day**
- As an athlete, I want to schedule more than 3 workouts per day, so I'm not artificially limited by the period system.
- As an athlete, I want a warning if I schedule overlapping workouts (same time range), so I catch mistakes without being blocked.

### Activity B: Connect & Sync to Google Calendar

**Task B1: Connect Google account**
- As an athlete, I want a "Connect Google Calendar" button in settings, so I can authorize the app to create events.
- As an athlete, I want to see my connection status (connected/disconnected) and be able to disconnect, so I stay in control of the integration.

**Task B2: Push schedule to Google Calendar**
- As an athlete, I want all projected workouts for a mesocycle to appear in a dedicated "Fitness" calendar in Google Calendar when the mesocycle is created.
- As an athlete, I want schedule changes (assign, remove, move, override) to automatically update the corresponding Google Calendar events.
- As an athlete, I want each event titled with the workout name and showing the correct start/end time in my timezone.

**Task B3: Deep links in calendar events**
- As an athlete, I want each Google Calendar event to contain a link to the workout detail in the app, so I can see the full exercise plan.
- As an athlete, I want a "Log Workout" link in the event that takes me directly to the logging page for that workout.

**Task B4: Completion sync**
- As an athlete, I want Google Calendar events to update when I log a workout (e.g., title prefix changes to checkmark), so I can see at a glance what's done.

### Activity C: Migrate Existing Data

**Task C1: Backfill existing schedule entries**
- As an athlete, I want existing schedule entries to get default times based on their period (morning=07:00, afternoon=13:00, evening=18:00), so my current schedule isn't broken.
- As an athlete, I want existing entries to get default durations based on modality (resistance=90min, running=60min, MMA=90min, mixed=90min), so they're usable immediately.

## V1 Scope (SLC Slice)

**In scope** — the minimum end-to-end journey:

1. Schema migration: time_slot NOT NULL, duration column, derived period, row-ID-based actions, auto-backfill
2. Schedule grid: replace period buttons with time + duration inputs
3. Today view: show times and durations, chronological sort
4. Calendar view: show times on pills, chronological sort
5. Move workout modal: time input replacing period radio
6. Google OAuth connect/disconnect flow
7. Dedicated "Fitness" calendar creation
8. Push all projected events on mesocycle create/modify
9. Re-sync affected events on schedule mutations
10. Deep links in event description (workout detail + log action)
11. Completion sync (update event on log)
12. Settings page: connection status, timezone display

**SLC rationale**: This delivers the full loop — schedule with times, see it in GCal, click through to log, see completion reflected. Each piece is simple, the experience is lovable (real calendar integration), and the job is complete (no manual calendar maintenance).

### Out of scope for V1

- Bidirectional sync (GCal changes flowing back)
- Drag-and-drop time adjustment in schedule grid
- Google Calendar push notifications / webhooks
- Recurring event patterns (each workout is a standalone event)
- Conflict detection with non-fitness calendar events (freeBusy API)
- Multi-user support
- Alternative calendar providers (Apple, Outlook)
- Notification/reminder customization

## Data Model Changes

### Modified tables

**`weekly_schedule`**
```
  time_slot    TEXT NOT NULL          -- was nullable, now required "HH:MM"
  duration     INTEGER NOT NULL       -- NEW, minutes
  period       TEXT NOT NULL           -- KEPT but derived, not in unique key

  UNIQUE(mesocycle_id, day_of_week, week_type, time_slot, template_id)
                                      -- was (mesocycle_id, day_of_week, week_type, period)
```
Note: unique includes template_id because overlapping times are allowed (with UI warning). Two different templates can share the same time slot. Same template at same time is blocked.

**`schedule_week_overrides`**
```
  time_slot    TEXT NOT NULL          -- was nullable, now required
  duration     INTEGER NOT NULL       -- NEW, minutes
  period       TEXT NOT NULL           -- derived

  UNIQUE(mesocycle_id, week_number, day_of_week, time_slot, template_id)
                                      -- was (mesocycle_id, week_number, day_of_week, period)
```

**`workout_templates`**
```
  estimated_duration  INTEGER         -- NEW, nullable, minutes
                                      -- resistance templates use this
                                      -- running/MMA already have target_duration/planned_duration
```

**`athlete_profile`**
```
  timezone     TEXT DEFAULT 'UTC'     -- NEW, IANA timezone string
                                      -- populated from Google Calendar settings on OAuth connect
```

### New tables

**`google_credentials`**
```
  id               INTEGER PRIMARY KEY
  access_token     TEXT NOT NULL
  refresh_token    TEXT NOT NULL
  token_expiry     INTEGER NOT NULL      -- timestamp
  calendar_id      TEXT                  -- ID of the created "Fitness" calendar
  created_at       INTEGER NOT NULL      -- timestamp
  updated_at       INTEGER NOT NULL      -- timestamp
```

**`google_calendar_events`** (sync mapping)
```
  id               INTEGER PRIMARY KEY
  google_event_id  TEXT NOT NULL UNIQUE  -- Google's event ID
  mesocycle_id     INTEGER NOT NULL      -- FK
  template_id      INTEGER NOT NULL      -- FK
  event_date       TEXT NOT NULL         -- YYYY-MM-DD, the projected date
  time_slot        TEXT NOT NULL         -- HH:MM at time of sync
  sync_status      TEXT NOT NULL DEFAULT 'synced'  -- synced/pending/failed
  last_synced_at   INTEGER              -- timestamp
  created_at       INTEGER NOT NULL
```

### Actions refactored to row ID

All schedule actions (`assignTemplate`, `removeAssignment`, `moveWorkout`, `undoScheduleMove`) switch from composite key identification `(mesocycle, day, weekType, period)` to direct row ID. This simplifies signatures and supports unlimited entries per day.

## Integration Architecture

### OAuth Flow
1. User clicks "Connect Google Calendar" in settings
2. App redirects to Google OAuth consent (scope: `calendar` for full calendar CRUD)
3. Google redirects back with auth code
4. App exchanges code for access + refresh tokens, stores in `google_credentials`
5. App reads user's calendar timezone via `CalendarList.get('primary')`, stores in `athlete_profile.timezone`
6. App creates a dedicated "Fitness" calendar via `Calendars.insert`
7. Stores the new calendar's ID in `google_credentials.calendar_id`

### Push Flow (on schedule mutation)
```
Schedule mutation (assign/remove/move/override)
  → Write to SQLite (existing flow)
  → If Google connected:
      → Project affected events (date + time + duration + template info)
      → For each affected event:
          → Lookup google_calendar_events for existing mapping
          → If exists: Events.update (or Events.delete if removed)
          → If new: Events.insert, store mapping
      → On API failure: mark sync_status='failed', continue
          (don't block the schedule mutation)
```

### Event Content
```
Title: "Push A — Week 3"  (or "✅ Push A — Week 3" after logging)
Start: 2026-04-01T07:00:00 (Asia/Jerusalem)
End:   2026-04-01T08:30:00 (Asia/Jerusalem)
Description:
  "Exercises: Bench Press, OHP, Lateral Raise, Tricep Extension

   View workout detail: {APP_URL}/?date=2026-04-01
   Log this workout: {APP_URL}/?date=2026-04-01&action=log"

Source: { url: "{APP_URL}", title: "Fitness App" }
ExtendedProperties.private: { mesocycleId: "5", templateId: "12", eventDate: "2026-04-01" }
Color: mapped from modality (resistance=blue, running=green, MMA=red, mixed=purple)
```

### Mesocycle Lifecycle Sync
- **Create mesocycle**: project all workouts, push all events
- **Modify schedule** (assign/remove/move): re-sync affected events only
- **Complete mesocycle**: optionally grey out or delete future events
- **Delete mesocycle**: delete all associated Google Calendar events
- **Clone mesocycle**: auto-push projected events for the new mesocycle

### Error Handling
- GCal API failures never block local operations
- Failed syncs marked `sync_status='failed'` for retry
- Retry on next relevant mutation or via manual "Re-sync" button in settings
- Token refresh handled by `google-auth-library` with `tokens` event listener to persist new tokens
- If refresh token is invalid (user revoked access): mark as disconnected, prompt re-auth

## Migration Path

### Step 1: Schema migration
1. Add `duration INTEGER` to `weekly_schedule` and `schedule_week_overrides` (nullable initially)
2. Add `estimated_duration INTEGER` to `workout_templates`
3. Add `timezone TEXT DEFAULT 'UTC'` to `athlete_profile`
4. Create `google_credentials` and `google_calendar_events` tables

### Step 2: Backfill existing data
```sql
-- Default times by period
UPDATE weekly_schedule SET time_slot = '07:00' WHERE period = 'morning' AND time_slot IS NULL;
UPDATE weekly_schedule SET time_slot = '13:00' WHERE period = 'afternoon' AND time_slot IS NULL;
UPDATE weekly_schedule SET time_slot = '18:00' WHERE period = 'evening' AND time_slot IS NULL;

-- Same for schedule_week_overrides

-- Default durations by template modality (via JOIN)
UPDATE weekly_schedule SET duration = 90 WHERE duration IS NULL;  -- simplified; actual migration joins on template modality
UPDATE schedule_week_overrides SET duration = 90 WHERE duration IS NULL;
```

### Step 3: Enforce constraints
1. Make `time_slot` NOT NULL on both tables
2. Make `duration` NOT NULL on both tables
3. Drop old unique index, create new one on `(mesocycle_id, day_of_week, week_type, time_slot, template_id)`
4. Period column stays, populated via `derivePeriod(time_slot)` on insert/update

### Step 4: Code migration
1. Update all action signatures from composite key to row ID
2. Replace period-picker UI with time+duration inputs
3. Update sorting from period-order to chronological
4. Add derived period computation to all write paths

## Edge Cases

- **Timezone changes**: If user travels, timezone in athlete_profile may be stale. Events already pushed keep their original timezone. Future: offer a "Update timezone" button.
- **OAuth token revocation**: User removes app from Google account settings. Next API call fails with 401/403. App marks connection as disconnected, shows re-auth prompt. Local schedule unaffected.
- **Mesocycle date range changes**: If start/end dates change, need to add/remove projected events accordingly. Delete events outside new range, create events for newly-covered dates.
- **Mesocycle completion**: All events stay in GCal as historical record. Completed events already have checkmark prefix from completion sync.
- **Overlapping time warning**: UI shows yellow warning when a new assignment overlaps an existing one's time range. Doesn't block — user might intentionally overlap (e.g., strength + cardio with a partner).
- **Google API rate limits**: Unlikely for single user, but batch requests (up to 50) for bulk operations like mesocycle creation with 30+ projected workouts.
- **Stale sync mappings**: If Google Calendar is manually deleted or events are deleted in GCal, the mapping table will be stale. On next sync attempt, handle 404/410 gracefully — recreate if needed.
- **Default duration for resistance templates**: No existing `estimated_duration` on resistance templates. Backfill with 90 minutes. Users can adjust per-template going forward.

## Parking Lot

- Bidirectional sync (GCal → app)
- Apple Calendar / Outlook integration
- Drag-and-drop time adjustment on schedule grid
- Recurring events (using RRULE instead of individual events)
- FreeBusy conflict detection with other calendars
- Custom reminders per workout type
- Export schedule as .ics file
- Workout notification push to mobile

## Open Questions

1. **`{APP_URL}` for deep links**: The public-facing URL of the deployed app, used in GCal event descriptions. Resolved at deploy time via env var (e.g., `NEXT_PUBLIC_APP_URL`).
2. **Re-sync strategy for V1**: Failed syncs retry on next relevant mutation + manual "Re-sync" button in settings. No background job needed for single-user.
