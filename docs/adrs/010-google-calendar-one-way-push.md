# ADR-010: Google Calendar Integration — One-Way Push with OAuth

## Status
Accepted

## Context
Athletes want to see their training schedule in Google Calendar alongside other commitments. The app has zero external integrations — no OAuth, no outbound API calls, no webhook endpoints. The scheduling model is being upgraded to specific start times and durations (ADR-009), making workouts suitable as calendar events. The app is single-user, deployed on a Hostinger VPS behind nginx with HTTPS.

## Options Considered
- **Option A — One-way push (app → Google Calendar)**: App is source of truth. On schedule mutations, push events to Google Calendar via API. No webhooks, no pull, no conflict resolution.
- **Option B — Bidirectional sync**: Changes in either place reflect in the other. Requires webhooks (public HTTPS endpoint, channel renewal cron), sync tokens, conflict resolution, idempotency guards.
- **Option C — .ics export**: Generate a static .ics file URL that Google Calendar subscribes to. No OAuth needed. But: no per-event updates, polling delay (Google refreshes subscribed calendars ~every 12-24 hours), no completion sync.

## Decision
Option A — One-way push.

## Rationale
The app's immutable logging model means the app is the sole source of truth for workout data — there's nothing meaningful to pull from Google Calendar. One-way push gives the primary benefit (workouts visible in GCal) at ~10% of the complexity of bidirectional sync. For a solo developer maintaining a single-user app, the maintenance burden of webhooks, channel renewal, and conflict resolution is not justified.

OAuth is required (service accounts can't access personal Gmail calendars). Single-user can stay in Google's "Testing" mode — no OAuth verification process needed, just add the user's email as a test user.

## Consequences
- (+) Minimal complexity — just API calls on existing mutation paths
- (+) No webhook infrastructure, no sync tokens, no conflict resolution
- (+) App's data integrity model is unchanged — GCal is a read-only mirror
- (+) `@googleapis/calendar` standalone package (~5MB vs ~80MB for full `googleapis`)
- (-) Changes made in Google Calendar don't flow back — user must edit in the app
- (-) New OAuth surface area — token storage, refresh handling, consent screen
- (-) Google API failures need graceful degradation (fire-and-forget with retry)
- (-) First external dependency — adds a runtime dependency on Google's API availability

## Implementation Notes
- OAuth scope: `https://www.googleapis.com/auth/calendar` (full calendar access, needed to create dedicated calendar)
- OAuth flow via Route Handlers (per ADR-004): `GET /api/auth/google` (redirect to consent) + `GET /api/auth/google/callback` (exchange code for tokens)
- Packages: `@googleapis/calendar`, `google-auth-library`
- Token storage: `google_credentials` table in SQLite (access_token, refresh_token, token_expiry, calendar_id)
- Sync mapping: `google_calendar_events` table (google_event_id ↔ mesocycle/template/date)
- Dedicated "Fitness" calendar created on first connect — events isolated, user can toggle visibility
- Sync hooks: called after successful local writes in schedule actions, fire-and-forget with error marking
- Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `NEXT_PUBLIC_APP_URL`
