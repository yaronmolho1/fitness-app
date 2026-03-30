# api/

Route Handlers — JSON endpoints for computed reads and auth.

## Subdirectories
- `auth/` — login/logout routes + Google OAuth flow ([README](./auth/README.md))
- `calendar/` — month projection + day detail ([README](./calendar/README.md))
- `coaching/` — coaching summary generation ([README](./coaching/README.md))
- `google/` — Google Calendar management: disconnect, sync status, retry ([README](./google/README.md))
- `health/` — healthcheck endpoint
- `progression/` — exercise progression time series ([README](./progression/README.md))
- `test/` — test-only reset endpoint (drops and re-seeds DB)
- `today/` — today's workout data for the dashboard
