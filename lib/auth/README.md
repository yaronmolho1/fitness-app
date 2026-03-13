# auth/

Single-user JWT authentication. Env-based credentials, Edge-compatible via `jose`.

## Files
- `config.ts` — lazy-loaded auth config from env vars, `validateCredentials()` with timing-safe bcrypt
- `jwt.ts` — `issueToken()` and `verifyToken()` using `jose` HS256 signing
- `utils.ts` — `parseExpiresIn()` duration string parser (e.g. "7d" → seconds)
- `actions.ts` — `logout()` server action: clears auth cookie, redirects to login
