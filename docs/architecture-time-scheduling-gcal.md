# Architecture: Time-Based Scheduling + Google Calendar Integration

Extends [docs/architecture.md](architecture.md). Covers two coupled features: replacing period-based scheduling with specific start times/durations, and one-way push to Google Calendar. See [ADR-009](adrs/009-time-slot-first-scheduling.md) and [ADR-010](adrs/010-google-calendar-one-way-push.md).

## System Overview

The fitness app's scheduling model shifts from coarse time periods (morning/afternoon/evening) to specific start times and durations. This removes the 3-per-day limit and makes workouts mappable to calendar events. A new Google Calendar integration pushes projected workouts as events to a dedicated "Fitness" calendar via one-way sync (app → GCal). The app remains the sole source of truth; Google Calendar is a read-only mirror with deep links back to the app.

## Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ ScheduleGrid│  │ MoveModal    │  │ Settings (NEW)          │ │
│  │ (time+dur   │  │ (time input  │  │ - GCal connect/status   │ │
│  │  inputs)    │  │  replaces    │  │ - Timezone display      │ │
│  │             │  │  period      │  │ - Re-sync button        │ │
│  │             │  │  radio)      │  │                         │ │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬─────────────┘ │
└─────────┼────────────────┼──────────────────────┼────────────────┘
          │ Server Action  │ Server Action         │ OAuth redirect
          ▼                ▼                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  Next.js Server                                                  │
│                                                                  │
│  ┌─────────────────────────┐    ┌─────────────────────────────┐ │
│  │ lib/schedule/            │    │ app/api/auth/google/        │ │
│  │   actions.ts             │    │   route.ts     → redirect   │ │
│  │   override-actions.ts    │    │   callback/                 │ │
│  │   time-utils.ts (NEW)    │    │     route.ts → token xchg   │ │
│  │   queries.ts             │    ├─────────────────────────────┤ │
│  │   override-queries.ts    │    │ app/api/google/              │ │
│  └──────────┬───────────────┘    │   sync/route.ts (re-sync)  │ │
│             │                    │   disconnect/route.ts       │ │
│             │ after local write  └──────────┬──────────────────┘ │
│             ▼                               │                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ lib/google/ (NEW)                                           │ │
│  │   client.ts     — OAuth2Client singleton, token refresh     │ │
│  │   calendar.ts   — event CRUD (insert/update/delete/batch)   │ │
│  │   sync.ts       — orchestration (project → diff → push)     │ │
│  │   types.ts      — GCalEvent, SyncResult, etc.               │ │
│  └──────────┬──────────────────────────────────────────────────┘ │
│             │                                                    │
│             ▼                                                    │
│  ┌─────────────────────┐                                        │
│  │ SQLite (Drizzle)    │                                        │
│  │ + google_credentials│                                        │
│  │ + google_cal_events │                                        │
│  └─────────────────────┘                                        │
└──────────────────────┬───────────────────────────────────────────┘
                       │ HTTPS
                       ▼
              ┌────────────────┐
              │ Google Calendar │
              │ API v3          │
              │ (events CRUD)  │
              └────────────────┘
```

## Data Model

### Modified Tables

#### `weekly_schedule`

| Column | Before | After | Notes |
|--------|--------|-------|-------|
| `time_slot` | `text` nullable | `text` NOT NULL | Required HH:MM |
| `duration` | — | `integer` NOT NULL | NEW, minutes |
| `period` | `text` NOT NULL, enum, in unique key | `text` NOT NULL, enum, **NOT in unique key** | Derived from `time_slot` via `derivePeriod()` |
| **Unique index** | `(mesocycle_id, day_of_week, week_type, period)` | `(mesocycle_id, day_of_week, week_type, time_slot, template_id)` | Allows overlapping times for different templates |

#### `schedule_week_overrides`

Same changes as `weekly_schedule`: `time_slot` NOT NULL, `duration` NOT NULL, `period` derived. Unique index changes from `(mesocycle_id, week_number, day_of_week, period)` to `(mesocycle_id, week_number, day_of_week, time_slot, template_id)`.

#### `workout_templates`

| Column | Before | After | Notes |
|--------|--------|-------|-------|
| `estimated_duration` | — | `integer` nullable | NEW, minutes. For resistance templates. Running already has `target_duration`, MMA has `planned_duration`. |

#### `athlete_profile`

| Column | Before | After | Notes |
|--------|--------|-------|-------|
| `timezone` | — | `text` DEFAULT `'UTC'` | NEW, IANA tz string. Populated from Google Calendar primary calendar settings on OAuth connect. |

### New Tables

#### `google_credentials` (singleton row)

```
id               INTEGER PRIMARY KEY
access_token     TEXT NOT NULL
refresh_token    TEXT NOT NULL
token_expiry     INTEGER NOT NULL      -- unix timestamp (seconds)
calendar_id      TEXT                  -- Google Calendar ID of "Fitness" calendar
created_at       INTEGER NOT NULL      -- timestamp
updated_at       INTEGER NOT NULL      -- timestamp
```

No FK references. Single row (id=1). Access token is short-lived (~1h), refresh token is long-lived. `updated_at` tracks last token refresh.

#### `google_calendar_events` (sync mapping)

```
id               INTEGER PRIMARY KEY
google_event_id  TEXT NOT NULL         -- Google's event ID
mesocycle_id     INTEGER NOT NULL      -- FK → mesocycles (cascade delete)
template_id      INTEGER NOT NULL      -- FK → workout_templates
event_date       TEXT NOT NULL         -- YYYY-MM-DD
time_slot        TEXT NOT NULL         -- HH:MM at time of sync
sync_status      TEXT NOT NULL DEFAULT 'synced'  -- synced | pending | failed
last_synced_at   INTEGER              -- timestamp
created_at       INTEGER NOT NULL
```

Unique index on `(mesocycle_id, template_id, event_date, time_slot)` — one Google event per workout instance at a specific time. The `google_event_id` has a separate unique index for reverse lookup.

### Drizzle Schema Additions (`lib/db/schema.ts`)

```typescript
// New tables
export const google_credentials = sqliteTable('google_credentials', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  access_token: text('access_token').notNull(),
  refresh_token: text('refresh_token').notNull(),
  token_expiry: integer('token_expiry', { mode: 'timestamp' }).notNull(),
  calendar_id: text('calendar_id'),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const google_calendar_events = sqliteTable(
  'google_calendar_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    google_event_id: text('google_event_id').notNull(),
    mesocycle_id: integer('mesocycle_id')
      .notNull()
      .references(() => mesocycles.id, { onDelete: 'cascade' }),
    template_id: integer('template_id')
      .notNull()
      .references(() => workout_templates.id),
    event_date: text('event_date').notNull(),
    time_slot: text('time_slot').notNull(),
    sync_status: text('sync_status', {
      enum: ['synced', 'pending', 'failed'],
    }).notNull().default('synced'),
    last_synced_at: integer('last_synced_at', { mode: 'timestamp' }),
    created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    googleEventIdx: uniqueIndex('gcal_events_google_id_idx').on(t.google_event_id),
    instanceIdx: uniqueIndex('gcal_events_instance_idx').on(
      t.mesocycle_id,
      t.template_id,
      t.event_date,
      t.time_slot
    ),
  })
)
```

### `derivePeriod` Utility

```typescript
// lib/schedule/time-utils.ts
export type Period = 'morning' | 'afternoon' | 'evening'

export function derivePeriod(timeSlot: string): Period {
  const hour = parseInt(timeSlot.split(':')[0], 10)
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

export function getEndTime(timeSlot: string, durationMinutes: number): string {
  const [h, m] = timeSlot.split(':').map(Number)
  const totalMin = h * 60 + m + durationMinutes
  const endH = Math.floor(totalMin / 60) % 24
  const endM = totalMin % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

export function checkOverlap(
  existingEntries: { time_slot: string; duration: number }[],
  newTimeSlot: string,
  newDuration: number
): boolean {
  const toMinutes = (ts: string) => {
    const [h, m] = ts.split(':').map(Number)
    return h * 60 + m
  }
  const newStart = toMinutes(newTimeSlot)
  const newEnd = newStart + newDuration
  return existingEntries.some(e => {
    const start = toMinutes(e.time_slot)
    const end = start + e.duration
    return newStart < end && newEnd > start
  })
}
```

Called on every schedule insert/update path. The `period` value is set in the action before writing to the DB — no triggers needed.

## API Boundaries

### New Route Handlers (per ADR-004: Route Handlers for external-facing endpoints)

| Method | Path | Responsibility | Auth |
|--------|------|---------------|------|
| GET | `/api/auth/google` | Redirect to Google OAuth consent screen | Middleware |
| GET | `/api/auth/google/callback` | Exchange auth code for tokens, create calendar, store credentials | Public (state param validated) |
| POST | `/api/google/disconnect` | Revoke tokens, delete calendar, clear credentials | Middleware |
| POST | `/api/google/sync` | Manual re-sync: retry failed events, full re-project if needed | Middleware |
| GET | `/api/google/status` | Return connection status + last sync info | Middleware |

### Modified Server Actions

All schedule actions switch from composite key to row ID and gain a sync hook:

| Action | Before Signature | After Signature |
|--------|-----------------|-----------------|
| `assignTemplate` | `(mesocycle_id, day, template_id, period, week_type, time_slot?)` | `(mesocycle_id, day, template_id, time_slot, duration, week_type?)` |
| `removeAssignment` | `(mesocycle_id, day, week_type, period)` | `(schedule_id: number)` |
| `moveWorkout` | `(meso, week, src_day, src_period, tgt_day, tgt_period, scope, tgt_time?)` | `(meso, week, schedule_id, tgt_day, tgt_time, tgt_duration, scope)` |
| `undoScheduleMove` | `(overrideGroup, mesocycleId)` | unchanged |
| `resetWeekSchedule` | `(mesocycleId, weekNumber)` | unchanged |

New actions:
| Action | Location | Responsibility |
|--------|----------|---------------|
| `connectGoogle` | `lib/google/actions.ts` | Initiate OAuth flow (generates state, returns redirect URL) |
| `disconnectGoogle` | `lib/google/actions.ts` | Revoke tokens, delete Fitness calendar, clear DB |

### Logging Actions — Completion Sync

The existing workout logging action (wherever `logged_workouts` INSERT happens) gains a post-write hook: if Google is connected and a `google_calendar_events` mapping exists for that template+date, update the event title with a checkmark prefix.

## Google Integration Layer (`lib/google/`)

### Module Structure

```
lib/google/
  client.ts       — getGoogleClient(): OAuth2Client (cached, auto-refresh)
  calendar.ts     — createFitnessCalendar(), insertEvent(), updateEvent(),
                     deleteEvent(), batchInsertEvents()
  sync.ts         — syncScheduleChange(), syncMesocycle(), syncCompletion(),
                     retryFailedSyncs()
  queries.ts      — getGoogleCredentials(), getEventMapping(),
                     isGoogleConnected()
  actions.ts      — 'use server' actions for connect/disconnect
  types.ts        — type definitions
```

### `client.ts` — OAuth2Client Management

```typescript
import { OAuth2Client } from 'google-auth-library'
import { db } from '@/lib/db'
import { google_credentials } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

let cachedClient: OAuth2Client | null = null

export function createOAuth2Client(): OAuth2Client {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export async function getAuthenticatedClient(): Promise<OAuth2Client | null> {
  const creds = db.select().from(google_credentials).where(eq(google_credentials.id, 1)).get()
  if (!creds) return null

  const client = createOAuth2Client()
  client.setCredentials({
    access_token: creds.access_token,
    refresh_token: creds.refresh_token,
  })

  // Persist refreshed tokens
  client.on('tokens', (tokens) => {
    db.update(google_credentials)
      .set({
        access_token: tokens.access_token ?? creds.access_token,
        refresh_token: tokens.refresh_token ?? creds.refresh_token,
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : creds.token_expiry,
        updated_at: new Date(),
      })
      .where(eq(google_credentials.id, 1))
      .run()
  })

  return client
}
```

No mutex needed for token refresh — single-user app with synchronous SQLite writes means no concurrent refresh race condition.

### `sync.ts` — Sync Orchestration

The sync layer is called **after** successful local writes. It never blocks the mutation — errors are caught and recorded.

```typescript
export async function syncScheduleChange(
  action: 'assign' | 'remove' | 'move',
  mesocycleId: number,
  affectedDates: string[]  // YYYY-MM-DD dates that changed
): Promise<void> {
  if (!isGoogleConnected()) return

  try {
    const client = await getAuthenticatedClient()
    if (!client) return

    for (const date of affectedDates) {
      // Project what should be on this date from effective schedule
      // Diff against existing google_calendar_events mappings
      // Insert/update/delete as needed
    }
  } catch (error) {
    // Mark affected mappings as 'failed', log error
    // Never throw — caller should not be affected
  }
}
```

### Sync Hook Pattern in Actions

```typescript
// In assignTemplate (after successful local write):
const row = db.insert(weekly_schedule).values({...}).returning().get()
revalidatePath('/mesocycles', 'layout')

// Fire-and-forget sync — don't await, don't block
syncScheduleChange('assign', mesocycle_id, projectAffectedDates(mesocycle_id, day_of_week, week_type))
  .catch(() => {}) // swallow — errors already handled inside

return { success: true, data: row }
```

The `projectAffectedDates` helper computes which calendar dates are affected by a base schedule change (every occurrence of this day_of_week within the mesocycle's date range, accounting for week type).

### Event Builder

```typescript
// lib/google/calendar.ts
export function buildEventBody(params: {
  templateName: string
  modality: string
  date: string          // YYYY-MM-DD
  timeSlot: string      // HH:MM
  duration: number       // minutes
  weekNumber: number
  timezone: string       // IANA
  appUrl: string
  mesocycleId: number
  templateId: number
  exercises?: string[]
  completed?: boolean
}): calendar_v3.Schema$Event {
  const startDateTime = `${params.date}T${params.timeSlot}:00`
  const endTime = getEndTime(params.timeSlot, params.duration)
  const endDateTime = `${params.date}T${endTime}:00`
  const prefix = params.completed ? '✅ ' : ''

  return {
    summary: `${prefix}${params.templateName} — Week ${params.weekNumber}`,
    description: [
      params.exercises?.length
        ? `Exercises: ${params.exercises.join(', ')}`
        : null,
      '',
      `View workout: ${params.appUrl}/?date=${params.date}`,
      `Log workout: ${params.appUrl}/?date=${params.date}&action=log`,
    ].filter(Boolean).join('\n'),
    start: { dateTime: startDateTime, timeZone: params.timezone },
    end: { dateTime: endDateTime, timeZone: params.timezone },
    source: { url: params.appUrl, title: 'Fitness App' },
    colorId: MODALITY_COLORS[params.modality] ?? '1',
    extendedProperties: {
      private: {
        mesocycleId: String(params.mesocycleId),
        templateId: String(params.templateId),
        eventDate: params.date,
      },
    },
  }
}

const MODALITY_COLORS: Record<string, string> = {
  resistance: '9',  // blueberry
  running: '2',     // sage
  mma: '11',        // tomato
  mixed: '3',       // grape
}
```

## OAuth Flow (Detail)

```
User clicks "Connect Google Calendar"
  → Client navigates to /api/auth/google
  → Server generates state token (random, stored in httpOnly cookie)
  → Server redirects to:
      https://accounts.google.com/o/oauth2/v2/auth?
        client_id={GOOGLE_CLIENT_ID}&
        redirect_uri={GOOGLE_REDIRECT_URI}&
        response_type=code&
        scope=https://www.googleapis.com/auth/calendar&
        access_type=offline&        ← gets refresh token
        prompt=consent&             ← always show consent (ensures refresh token)
        state={state_token}

Google consent screen → user approves
  → Google redirects to /api/auth/google/callback?code={code}&state={state}
  → Server validates state token against cookie
  → Server exchanges code for tokens via oauth2Client.getToken(code)
  → Server reads user's primary calendar timezone:
      CalendarList.get('primary') → .timeZone
  → Server creates dedicated calendar:
      Calendars.insert({ summary: '🏋️ Fitness', timeZone })
  → Server stores in google_credentials:
      { access_token, refresh_token, token_expiry, calendar_id }
  → Server updates athlete_profile:
      { timezone: primaryCalendar.timeZone }
  → Redirect to /settings with success toast
```

Environment variables required:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://{domain}/api/auth/google/callback
NEXT_PUBLIC_APP_URL=https://{domain}
```

## Migration Strategy

SQLite cannot `ALTER COLUMN` to change nullable → NOT NULL or drop/recreate unique indexes in place. Drizzle Kit handles this via table recreation in generated migrations. The migration is split into phases to allow data backfill.

### Phase 1: Add nullable columns + new tables

```sql
-- Generated by drizzle-kit (edited for backfill)
ALTER TABLE weekly_schedule ADD COLUMN duration INTEGER;
ALTER TABLE schedule_week_overrides ADD COLUMN duration INTEGER;
ALTER TABLE workout_templates ADD COLUMN estimated_duration INTEGER;
ALTER TABLE athlete_profile ADD COLUMN timezone TEXT DEFAULT 'UTC';

CREATE TABLE google_credentials (...);
CREATE TABLE google_calendar_events (...);
```

### Phase 2: Backfill (custom SQL in same migration file)

```sql
-- Backfill time_slot from period
UPDATE weekly_schedule SET time_slot = '07:00' WHERE period = 'morning' AND time_slot IS NULL;
UPDATE weekly_schedule SET time_slot = '13:00' WHERE period = 'afternoon' AND time_slot IS NULL;
UPDATE weekly_schedule SET time_slot = '18:00' WHERE period = 'evening' AND time_slot IS NULL;

UPDATE schedule_week_overrides SET time_slot = '07:00' WHERE period = 'morning' AND time_slot IS NULL;
UPDATE schedule_week_overrides SET time_slot = '13:00' WHERE period = 'afternoon' AND time_slot IS NULL;
UPDATE schedule_week_overrides SET time_slot = '18:00' WHERE period = 'evening' AND time_slot IS NULL;

-- Backfill duration by template modality
UPDATE weekly_schedule SET duration = (
  SELECT CASE wt.modality
    WHEN 'running' THEN COALESCE(wt.target_duration, 60)
    WHEN 'mma' THEN COALESCE(wt.planned_duration, 90)
    WHEN 'mixed' THEN 90
    ELSE 90  -- resistance default
  END
  FROM workout_templates wt WHERE wt.id = weekly_schedule.template_id
) WHERE duration IS NULL AND template_id IS NOT NULL;

-- Entries with null template_id (rest days) — set a default
UPDATE weekly_schedule SET duration = 60 WHERE duration IS NULL;

UPDATE schedule_week_overrides SET duration = (
  SELECT CASE wt.modality
    WHEN 'running' THEN COALESCE(wt.target_duration, 60)
    WHEN 'mma' THEN COALESCE(wt.planned_duration, 90)
    WHEN 'mixed' THEN 90
    ELSE 90
  END
  FROM workout_templates wt WHERE wt.id = schedule_week_overrides.template_id
) WHERE duration IS NULL AND template_id IS NOT NULL;

UPDATE schedule_week_overrides SET duration = 60 WHERE duration IS NULL;
```

### Phase 3: Enforce NOT NULL + new unique indexes

Drizzle Kit generates table recreation SQL for this. The pattern:

```sql
-- weekly_schedule
CREATE TABLE weekly_schedule_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  template_id INTEGER REFERENCES workout_templates(id),
  week_type TEXT NOT NULL DEFAULT 'normal',
  period TEXT NOT NULL DEFAULT 'morning',
  time_slot TEXT NOT NULL,
  duration INTEGER NOT NULL,
  created_at INTEGER
);

INSERT INTO weekly_schedule_new SELECT * FROM weekly_schedule;
DROP TABLE weekly_schedule;
ALTER TABLE weekly_schedule_new RENAME TO weekly_schedule;

CREATE UNIQUE INDEX weekly_schedule_meso_day_type_time_tmpl_idx
  ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, template_id);

-- Same pattern for schedule_week_overrides
```

**Implementation note**: Phases 1-3 can be combined into a single Drizzle migration file. Edit the generated migration to include the backfill SQL between the ADD COLUMN and the table recreation steps. Run `drizzle-kit generate` after updating schema.ts, then hand-edit the generated SQL to insert the backfill statements.

## Component Architecture

### Modified Components

#### `components/schedule-grid.tsx`
- Replace 3 hard-coded period buttons with a single "+ Add Workout" button per day
- On click: show inline form with template picker, time input (HH:MM), and duration input (minutes)
- Duration defaults from template's `estimated_duration` / `target_duration` / `planned_duration`
- Show overlap warning (yellow) if new entry overlaps existing entries' time ranges
- Group entries visually by derived period with section headers

#### `components/day-detail-panel.tsx`
- Show start time and duration on each workout card
- Replace period radio in `MoveWorkoutModal` with time input + duration input
- Default time to source workout's time

#### `components/calendar-grid.tsx`
- Show start time on pills: "07:00 Push A" instead of "AM Push A"
- Sort pills chronologically (not by period order)

#### `components/today-workout.tsx`
- Show start time and duration per session
- Sort sessions chronologically
- `formatPeriodLabel` already handles `time_slot` — just needs duration display added

### New Components

#### `app/(app)/settings/page.tsx` (NEW route)
- Google Calendar connection card: status indicator, connect/disconnect button
- Timezone display (read-only, from Google)
- Re-sync button with last sync timestamp
- Count of synced/pending/failed events

#### `components/schedule/time-duration-input.tsx` (NEW)
- Reusable time (HH:MM) + duration (minutes) input pair
- Used in schedule grid, move modal, and potentially template editing

## Auth Strategy

No changes to existing JWT auth. Google OAuth is additive:

- Google OAuth tokens stored in `google_credentials` table (not related to app auth)
- The app's JWT middleware protects all Google-related endpoints (except the OAuth callback, which validates via state parameter)
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are server-only env vars (not exposed to client)
- `NEXT_PUBLIC_APP_URL` is the only client-exposed Google-related env var (for deep link display)

## Infrastructure Decisions

- **New env vars**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `NEXT_PUBLIC_APP_URL`
- **New packages**: `@googleapis/calendar`, `google-auth-library` (both Google-official)
- **No new infrastructure**: No webhooks, no cron jobs, no background workers, no message queues
- **Docker**: Add env vars to `docker-compose.yml` env_file. No new services needed.
- **nginx**: No changes needed (existing HTTPS + reverse proxy handles OAuth callback)
- **Google Cloud Console**: Create project, enable Calendar API, configure OAuth consent screen (testing mode), create OAuth 2.0 Client ID with redirect URI

## Key Tradeoffs

| Optimized For | Sacrificed |
|---------------|-----------|
| Simplicity (one-way push) | Can't edit workout times from Google Calendar |
| Solo dev maintainability | No real-time sync (changes appear on next mutation, not instantly) |
| Graceful degradation (GCal is optional) | GCal sync failures are silent until user checks settings |
| Backward compat (period kept as derived) | Denormalized column that must stay in sync on every write |
| Unlimited daily workouts | Weaker unique constraint (includes template_id) |
| No background jobs | Failed syncs only retry on next mutation or manual re-sync |

## Open Questions

1. **Mesocycle clone + GCal**: When cloning, the new mesocycle has new template IDs. The sync layer must project fresh events (not copy mappings). Confirmed: auto-push on clone.
2. **Template duration inheritance**: When `estimated_duration` is null on a resistance template, the schedule grid should still require a duration. Default 90 min in the input, user can adjust. The template field is for convenience (pre-filling), not enforcement.
3. **Deep link routing**: `/?date=YYYY-MM-DD&action=log` — the today page needs to handle the `action=log` param to auto-scroll or auto-open the logging form. This is a UI detail for spec-write.
