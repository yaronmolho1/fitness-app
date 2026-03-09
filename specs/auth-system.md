# Auth System
**Status:** ready
**Epic:** Foundation
**Depends:** specs/db-schema-migrations.md

## Description
As a user, I can log in with a username and password so that all app routes are protected and only I can access my data.

## Acceptance Criteria

### Environment configuration
- [ ] `AUTH_USERNAME`, `AUTH_PASSWORD_HASH`, `JWT_SECRET`, and `JWT_EXPIRES_IN` are read from environment variables at runtime
- [ ] `AUTH_PASSWORD_HASH` is a bcrypt hash — plaintext passwords are never stored in env or code
- [ ] `JWT_EXPIRES_IN` defaults to `7d` when not set
- [ ] App fails to start (or login always fails) if `AUTH_USERNAME`, `AUTH_PASSWORD_HASH`, or `JWT_SECRET` are missing

### Login page
- [ ] A login page is accessible at `/login` without authentication
- [ ] Login page renders a username field, a password field, and a submit button
- [ ] Submitting valid credentials redirects the user to the app home route
- [ ] Submitting invalid credentials (wrong username or wrong password) shows an error message and does not redirect
- [ ] The error message does not reveal whether the username or password was wrong (generic "Invalid credentials")
- [ ] The password field input is masked (`type="password"`)
- [ ] The login form is usable on mobile (no horizontal scroll, touch-friendly inputs)

### Credential validation
- [ ] Login validates the submitted username against `AUTH_USERNAME` (exact match)
- [ ] Login hashes the submitted password and compares against `AUTH_PASSWORD_HASH` using bcrypt
- [ ] A timing-safe comparison is used — no early-exit string comparison for credentials

### JWT issuance (per architecture auth strategy)
- [ ] On successful login, a JWT is issued using the `jose` library (Edge-compatible — no `better-sqlite3` dependency)
- [ ] JWT payload includes at minimum: `sub` (username), `iat` (issued-at), `exp` (expiry)
- [ ] JWT expiry is set to `JWT_EXPIRES_IN` value
- [ ] JWT is signed with `JWT_SECRET`

### Cookie attributes (per architecture auth strategy)
- [ ] JWT is stored in a cookie named `auth-token`
- [ ] Cookie is `httpOnly` (not accessible via JavaScript)
- [ ] Cookie is `secure` (HTTPS only)
- [ ] Cookie `sameSite` is `lax`
- [ ] Cookie expiry matches JWT expiry

### Middleware route protection (per architecture auth strategy)
- [ ] Middleware runs on every request and validates the `auth-token` cookie using `jose`
- [ ] Middleware does NOT import `better-sqlite3` or any Node.js-only module (Edge runtime constraint)
- [ ] Unauthenticated requests to any `/(app)` route are redirected to `/login`
- [ ] Authenticated requests to `/login` are redirected to the app home route (no re-login loop)
- [ ] Public routes are not protected: `/login`, `/api/auth/login`, `/api/auth/logout`, `/api/health`
- [ ] An expired JWT is treated as unauthenticated — user is redirected to `/login`
- [ ] A tampered or invalid JWT signature is treated as unauthenticated — user is redirected to `/login`

### Logout
- [ ] A logout action clears the `auth-token` cookie
- [ ] After logout, navigating to any `/(app)` route redirects to `/login`
- [ ] Logout is accessible from within the app (not just via direct URL)

### No session storage
- [ ] No session table exists in the database — auth is stateless JWT only
- [ ] No server-side session state is maintained between requests

## Edge Cases

- Submitting the login form with an empty username or empty password shows a validation error without making a server request
- Submitting the login form with correct username but wrong password returns the generic error message
- Submitting the login form with wrong username but correct password format returns the generic error message
- A JWT with a valid signature but expired `exp` claim is rejected by middleware
- A cookie with a valid name but corrupted/non-JWT value is rejected by middleware (not a crash)
- Manually deleting the `auth-token` cookie in the browser causes the next request to redirect to `/login`
- Accessing `/login` while already authenticated redirects to the app home (no double-login)
- `JWT_SECRET` rotation: old tokens signed with the previous secret are rejected after rotation (expected behavior, not a bug)
- Very long username or password inputs (>1000 chars) are handled without crashing the login handler
- Concurrent requests with the same valid JWT all succeed (stateless — no race condition)

## Test Requirements

- **Unit — credential validation**: call the login validation function with correct credentials; assert JWT is returned. Call with wrong password; assert error is returned. Call with wrong username; assert error is returned.
- **Unit — JWT issuance**: assert issued JWT contains `sub`, `iat`, `exp` fields. Assert `exp` matches configured `JWT_EXPIRES_IN`.
- **Unit — JWT verification**: verify a valid JWT; assert success. Verify an expired JWT; assert rejection. Verify a tampered JWT; assert rejection.
- **Integration — login flow**: POST to login with valid credentials; assert `auth-token` cookie is set with correct attributes (`httpOnly`, `secure`, `sameSite=lax`).
- **Integration — login failure**: POST to login with invalid credentials; assert no cookie is set and error message is returned.
- **Integration — middleware protection**: make a request to a protected route without a cookie; assert redirect to `/login`.
- **Integration — middleware pass-through**: make a request to a protected route with a valid JWT cookie; assert the route responds normally (not redirected).
- **Integration — expired token**: make a request with an expired JWT cookie; assert redirect to `/login`.
- **Integration — logout**: set a valid cookie, call logout, then request a protected route; assert redirect to `/login`.
- **E2E — full login flow**: navigate to `/login`, fill credentials, submit; assert redirect to app home and nav is visible.
- **E2E — protected route redirect**: navigate directly to a protected route without logging in; assert redirect to `/login`.
- **E2E — logout**: log in, click logout, assert redirect to `/login` and protected routes are inaccessible.
