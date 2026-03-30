# google/

Google OAuth 2.0 client, Calendar API integration, and credential management.

## Files
- `client.ts` — OAuth2 client factory, consent URL generation, token exchange, credential persistence, auto-refresh listener, Fitness calendar creation, timezone sync
- `queries.ts` — read queries: `getGoogleCredentials()`, `isGoogleConnected()`, `getEventMapping()`, `getEventMappingsForMeso()`
- `actions.ts` — Server Action: `disconnectGoogle()` — removes credentials, optionally deletes Fitness calendar via API
