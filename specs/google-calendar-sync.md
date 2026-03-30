---
status: in-progress
epic: time-scheduling-gcal
depends: [specs/google-calendar-connect.md, specs/time-based-scheduling.md, specs/move-workout-time-aware.md, specs/clone-mesocycle.md]
---

# Google Calendar — Push Sync, Deep Links & Completion

## Description

Push projected workout events to a dedicated Google Calendar whenever the schedule changes. Each event includes deep links to the app for viewing workout details and logging. When a workout is logged, the corresponding event is updated to show completion.

## Acceptance Criteria

### Event Push on Mesocycle Create

1. **Given** Google Calendar is connected and a mesocycle is created with schedule entries, **When** the mesocycle is saved, **Then** all projected workouts for the full date range are pushed as individual events to the Fitness calendar.

2. **Given** a mesocycle with 4 workouts/week over 6 weeks, **When** events are pushed, **Then** ~24 events are created in Google Calendar (one per projected workout instance).

3. **Given** a projected event, **When** it is created in Google Calendar, **Then** it has: title "{Template Name} — Week {N}", correct start/end time in the user's timezone, and modality-based color.

### Event Content — Deep Links

4. **Given** a Google Calendar event for a workout, **When** the user views the event, **Then** the description includes a list of exercise names for that template.

5. **Given** a Google Calendar event, **When** the user views the event, **Then** the description includes a "View workout" link pointing to the app's today page for that date.

6. **Given** a Google Calendar event, **When** the user views the event, **Then** the description includes a "Log workout" link pointing to the app's logging action for that date.

7. **Given** a Google Calendar event, **When** it is created, **Then** it stores internal mapping data (mesocycle ID, template ID, event date) in private extended properties for sync tracking.

### Event Sync on Schedule Changes

8. **Given** a template is assigned to a day (new entry), **When** the assignment is saved, **Then** events are created for all projected dates of that day within the mesocycle's date range.

9. **Given** a template is removed from a day, **When** the removal is saved, **Then** the corresponding Google Calendar events for all projected dates are deleted.

10. **Given** a workout is moved via override ("this week"), **When** the move is saved, **Then** the source date's event is deleted and a new event is created on the target date with the target time.

11. **Given** a workout is moved via override ("remaining weeks"), **When** the move is saved, **Then** events for all affected future weeks are updated (source deleted, target created).

12. **Given** a move is undone, **When** the undo action completes, **Then** events revert: target events deleted, source events recreated from base schedule.

13. **Given** a week's schedule is reset, **When** the reset action completes, **Then** events for that week revert to match the base schedule.

### Completion Sync

14. **Given** a workout is logged for a date, **When** the log is saved, **Then** the corresponding Google Calendar event's title is updated to include a completion prefix (e.g., "✅ Push A — Week 3").

15. **Given** no Google Calendar event exists for a logged workout (not synced or mapping missing), **When** the log is saved, **Then** no error occurs — completion sync is skipped silently.

### Mesocycle Lifecycle

16. **Given** a mesocycle is cloned, **When** the clone completes, **Then** events for the new mesocycle's projected schedule are automatically pushed to Google Calendar.

17. **Given** a mesocycle is deleted, **When** the delete completes, **Then** all associated Google Calendar events are deleted.

18. **Given** a mesocycle's date range changes (start/end date edited), **When** the edit is saved, **Then** events outside the new range are deleted and events for newly covered dates are created.

### Error Handling & Resilience

19. **Given** a schedule mutation succeeds locally, **When** the Google Calendar API call fails, **Then** the local mutation is not rolled back — the sync failure is recorded with a "failed" status.

20. **Given** events with "failed" sync status exist, **When** the user clicks "Re-sync" in settings, **Then** the app retries all failed events.

21. **Given** events with "failed" sync status exist, **When** the next schedule mutation triggers sync, **Then** the failed events are also retried.

22. **Given** Google Calendar is not connected, **When** any schedule mutation occurs, **Then** no sync is attempted and no error is shown.

23. **Given** a Google Calendar event was manually deleted by the user in Google Calendar, **When** the app tries to update it, **Then** the app handles the 404/410 error gracefully and recreates the event.

### Sync Tracking

24. **Given** a Google Calendar event is created, **When** the sync completes, **Then** a mapping record is stored linking the Google event ID to the mesocycle, template, and date.

25. **Given** the settings page, **When** the user views sync status, **Then** they see counts of synced, pending, and failed events, plus the last sync timestamp.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Bulk operation (create mesocycle with 30+ events) | Events pushed in batch (up to 50 per batch request) to stay within rate limits |
| Template renamed after events pushed | Existing events retain old name; events created on next mutation use new name |
| Workout logged retroactively for a past date | Completion sync updates the historical event if mapping exists |
| Multiple workouts on same day at same time | Each gets its own Google Calendar event (may visually overlap in GCal) |
| Mesocycle with deload week | Deload week workouts pushed as events like any other week |
| Schedule entry with null template_id (rest day marker) | No event created — rest days are not pushed to GCal |
| User's Google Calendar "Fitness" calendar is manually deleted | Next sync attempt fails; app detects missing calendar, prompts re-creation or re-connect |
| App URL env var not set | Deep links are omitted from event description; sync still succeeds |

## Test Requirements

- AC1-3: Integration — mesocycle creation pushes correct number of events with correct titles/times
- AC4-6: Integration — event description contains exercise list, view link, log link
- AC7: Integration — extended properties set on created events
- AC8-9: Integration — assign/remove triggers event create/delete
- AC10-13: Integration — move/undo/reset correctly updates events
- AC14: Integration — logging updates event title with completion prefix
- AC16: Integration — clone auto-pushes events for new mesocycle
- AC19: Integration — API failure doesn't roll back local mutation
- AC20-21: Integration — re-sync retries failed events
- AC23: Integration — 404 on update triggers recreation

## Dependencies

- `specs/google-calendar-connect.md` — OAuth and credentials must be established first
- `specs/time-based-scheduling.md` — provides time_slot and duration for event start/end
- `specs/move-workout-time-aware.md` — move mutations trigger sync
- `specs/clone-mesocycle.md` — clone triggers auto-push

## Out of Scope

- Bidirectional sync (changes in Google Calendar flowing back to the app)
- Recurring events (RRULE) — each workout is a standalone event
- Conflict detection with non-fitness calendar events
- Custom reminders or notification settings per event
- Alternative calendar providers
