# auth/

Authentication route handlers — JWT login/logout and Google OAuth.

## Subdirectories
- `login/` — `POST /api/auth/login` — validates credentials, sets JWT cookie
- `logout/` — `POST /api/auth/logout` — clears JWT cookie
- `google/` — Google OAuth 2.0 consent + callback flow ([README](./google/README.md))
