# google/

Google OAuth 2.0 consent flow route handlers.

## Files
- `route.ts` — `GET /api/auth/google` — generates consent URL with CSRF state cookie, redirects to Google

## Subdirectories
- `callback/` — OAuth callback: exchanges code for tokens, creates Fitness calendar, stores credentials, redirects to settings
