# App Shell & Navigation
**Status:** done
**Epic:** Foundation
**Depends:** specs/auth-system.md

## Description
As a coach or athlete, I can navigate the app from a persistent shell so that I can reach any section quickly from both desktop and mobile without losing context.

## Acceptance Criteria

### Route group structure
- [ ] An `(app)` route group exists containing all authenticated app routes
- [ ] An `(auth)` route group exists containing the login page
- [ ] All routes under `(app)` are protected by the auth middleware (per specs/auth-system.md)
- [ ] Routes under `(auth)` are public (no auth required)

### Root layout
- [ ] A root layout wraps all `(app)` routes and renders the navigation shell
- [ ] The root layout does not render on `(auth)` routes (login page has no nav shell)
- [ ] The root layout includes a main content area where page content is rendered

### Desktop navigation (sidebar)
- [ ] On desktop viewports, a sidebar navigation is rendered
- [ ] The sidebar is persistent — it does not collapse or hide on desktop
- [ ] The sidebar contains navigation links to all top-level sections of the app
- [ ] The currently active route is visually indicated in the sidebar
- [ ] The sidebar includes a logout control

### Mobile navigation (bottom bar)
- [ ] On mobile viewports, a bottom navigation bar is rendered instead of the sidebar
- [ ] The bottom bar is fixed to the bottom of the viewport
- [ ] The bottom bar contains navigation links to the primary sections of the app
- [ ] The currently active route is visually indicated in the bottom bar
- [ ] The bottom bar does not obscure page content (page content accounts for bottom bar height)

### Responsive breakpoint
- [ ] The switch between sidebar (desktop) and bottom bar (mobile) is controlled by a CSS breakpoint
- [ ] No layout shift or flash occurs when the page loads on either viewport size

### Health endpoint (per ADR-004, ADR-008)
- [ ] `GET /api/health` is a Route Handler accessible without authentication
- [ ] `GET /api/health` returns HTTP 200 with JSON body `{ "status": "ok", "db": "connected" }`
- [ ] `GET /api/health` verifies the database connection is live before responding (not a static response)
- [ ] If the database is unreachable, `GET /api/health` returns HTTP 503 with `{ "status": "error", "db": "disconnected" }`

### Navigation sections
- [ ] Navigation includes a link to the Today's Workout section
- [ ] Navigation includes a link to the Exercise Library section
- [ ] Navigation includes a link to the Mesocycles section
- [ ] Navigation includes a link to the Calendar section
- [ ] Navigation includes a link to the Daily Routines section

## Edge Cases

- Navigating directly to a deep `/(app)` route while unauthenticated redirects to `/login` (middleware handles this — shell never renders for unauthenticated users)
- On a viewport exactly at the breakpoint boundary, only one navigation pattern renders (no double nav)
- The bottom bar on mobile does not overlap with the iOS safe area / home indicator (safe area insets respected)
- `GET /api/health` called while the database file is locked or missing returns 503, not a 500 crash
- Refreshing the page on any `/(app)` route preserves the active nav indicator for that route
- The logout control in the sidebar is reachable via keyboard navigation (accessibility)

## Test Requirements

- **Integration — health endpoint up**: call `GET /api/health` with a live database; assert HTTP 200 and `{ status: "ok", db: "connected" }` body
- **Integration — health endpoint DB down**: call `GET /api/health` with the database unavailable; assert HTTP 503 and `{ status: "error", db: "disconnected" }` body
- **Integration — health endpoint no auth**: call `GET /api/health` without an `auth-token` cookie; assert HTTP 200 (public route, not redirected)
- **E2E — desktop sidebar renders**: load an app route at desktop viewport width; assert sidebar is visible and bottom bar is not
- **E2E — mobile bottom bar renders**: load an app route at mobile viewport width; assert bottom bar is visible and sidebar is not
- **E2E — active nav indicator**: navigate to each top-level section; assert the corresponding nav item is marked active
- **E2E — logout from nav**: click the logout control in the sidebar; assert redirect to `/login`
- **E2E — unauthenticated deep link**: navigate directly to a protected route without auth; assert redirect to `/login` (no shell rendered)
- **E2E — route group isolation**: navigate to `/login`; assert no nav shell is rendered on the page
