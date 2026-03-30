# google/

Google OAuth 2.0 client, Calendar API integration, credential management, and calendar sync.

## Files
- `client.ts` — OAuth2 client factory, consent URL generation, token exchange, credential persistence, auto-refresh listener, Fitness calendar creation, timezone sync
- `queries.ts` — read queries: `getGoogleCredentials()`, `isGoogleConnected()`, `getEventMapping()`, `getEventsByMesocycle()`, `getAthleteTimezone()`, `getSyncStatus()`
- `actions.ts` — Server Action: `disconnectGoogle()` — removes credentials, optionally deletes Fitness calendar via API
- `sync.ts` — sync orchestration: `syncMesocycle()` (batch-push projected workouts), `syncScheduleChange()` (diff-based create/delete on schedule edits), `syncCompletion()` (checkmark title update on workout log), `retryFailedSyncs()` (re-attempt all error-status events), `buildEventBody()` (event body builder with modality colors)
- `types.ts` — shared types: `GCalEventParams`, `SyncResult`, `SyncError`, `SyncAction`, `GCalEventBody`
