---
status: ready
epic: time-scheduling-gcal
depends: [specs/auth-system.md]
---

# Google Calendar — Connect & Disconnect

## Description

Allow the user to connect their Google account via OAuth to enable calendar sync. On connect, the app creates a dedicated "Fitness" calendar and reads the user's timezone. The user can disconnect at any time, which revokes tokens and optionally removes the calendar.

## Acceptance Criteria

### Connect Flow

1. **Given** no Google account is connected, **When** the user visits the settings page, **Then** a "Connect Google Calendar" button is shown.

2. **Given** the user clicks "Connect Google Calendar", **When** the OAuth flow starts, **Then** the app redirects to Google's consent screen requesting calendar access.

3. **Given** the user approves on Google's consent screen, **When** Google redirects back, **Then** the app exchanges the auth code for access and refresh tokens.

4. **Given** tokens are obtained, **When** the callback completes, **Then** the app reads the user's primary calendar timezone and stores it in the athlete profile.

5. **Given** tokens are obtained, **When** the callback completes, **Then** the app creates a dedicated calendar named "Fitness" in the user's Google Calendar account.

6. **Given** the calendar is created, **When** the callback completes, **Then** the app stores the access token, refresh token, token expiry, and calendar ID in the credentials table.

7. **Given** the OAuth callback completes successfully, **When** the user is redirected, **Then** they land on the settings page with a success indication.

### Connection Status

8. **Given** a Google account is connected, **When** the user visits the settings page, **Then** they see: connected status, their timezone, and a "Disconnect" button.

9. **Given** a Google account is connected, **When** the access token expires, **Then** the app automatically refreshes it using the stored refresh token without user intervention.

10. **Given** a token refresh occurs, **When** Google returns new tokens, **Then** the updated tokens are persisted to the credentials table.

### Disconnect Flow

11. **Given** a connected Google account, **When** the user clicks "Disconnect", **Then** a confirmation prompt is shown before proceeding.

12. **Given** the user confirms disconnection, **When** the disconnect action runs, **Then** the stored credentials are deleted from the database.

13. **Given** disconnection, **When** credentials are removed, **Then** the app does not attempt to sync future schedule changes to Google Calendar.

14. **Given** disconnection, **When** the action completes, **Then** the settings page shows the disconnected state with the "Connect" button.

### Error Handling

15. **Given** the user denies consent on Google's screen, **When** redirected back, **Then** the settings page shows an error message and remains in disconnected state.

16. **Given** the user has previously revoked access from their Google account settings, **When** the app tries to use stored tokens, **Then** the API call fails, the app marks the connection as disconnected, and shows a re-authorization prompt.

17. **Given** the OAuth callback receives an invalid or expired auth code, **When** the token exchange fails, **Then** the settings page shows an error and remains disconnected.

18. **Given** the OAuth state parameter doesn't match the stored state, **When** the callback processes, **Then** the request is rejected (CSRF protection).

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| User clicks "Connect" while already connected | Button is hidden when connected; only "Disconnect" shown |
| Google API is down during connect | Token exchange fails; user sees error; can retry |
| "Fitness" calendar already exists in user's Google account (from previous connection) | Create a new one (Google allows duplicate names); or detect and reuse — implementation detail |
| User connects, disconnects, then reconnects | Full fresh flow — new tokens, new calendar |
| Refresh token expires (unused for 6+ months) | Treated as revoked access — user prompted to re-authorize |
| Network error during calendar creation (tokens saved, calendar not) | Partial state — calendar_id is null; next sync attempt should retry calendar creation |

## Test Requirements

- AC1-2: E2E — settings page shows connect button; clicking redirects to Google
- AC3-6: Integration — callback handler exchanges code, creates calendar, stores credentials
- AC8: E2E — connected state shows status + timezone + disconnect button
- AC9-10: Integration — token refresh persists new tokens
- AC11-14: E2E — disconnect flow with confirmation
- AC15: Integration — denied consent handled gracefully
- AC18: Integration — state parameter mismatch rejected

## Dependencies

- `specs/auth-system.md` — app auth protects settings page; Google OAuth is separate

## Out of Scope

- Multi-user Google account support
- Alternative calendar providers (Apple, Outlook)
- Calendar sync behavior (see `specs/google-calendar-sync.md`)
- Settings page layout beyond Google Calendar section
