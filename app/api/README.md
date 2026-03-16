# api/

Route Handlers — JSON endpoints for computed reads and auth.

## Subdirectories
- `auth/` — login/logout routes (POST, cookie-based JWT)
- `calendar/` — month projection + day detail ([README](./calendar/README.md))
- `health/` — healthcheck endpoint
- `progression/` — exercise progression time series ([README](./progression/README.md))
- `test/` — test-only reset endpoint (drops and re-seeds DB)
- `today/` — today's workout data for the dashboard
