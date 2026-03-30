# settings/

App settings page. Currently houses Google Calendar connection management.

## Files
- `page.tsx` — server component; fetches Google connection status and timezone, renders settings page
- `google-calendar-settings.tsx` — client component; connect/disconnect Google Calendar with confirmation dialog
- `google-calendar-settings.test.tsx` — unit tests for connected/disconnected states and disconnect flow
