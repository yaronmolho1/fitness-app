# google/

Google Calendar management routes — account disconnect, sync status, and failed-sync retry.

## Subdirectories
- `disconnect/` — `POST` — disconnect Google account, optionally delete Fitness calendar
- `status/` — `GET` — sync status counts (synced/pending/error) + last sync timestamp
- `sync/` — `POST` — retry all events with `error` sync status
