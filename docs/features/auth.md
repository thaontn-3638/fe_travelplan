# Auth Feature

Login, registration, session persistence, and route protection. Backed by a mock
API (`json-server`) — there is no real backend yet, so this document also tracks
which parts are mock-only and will need to change when a real backend arrives.

## File map

```
src/features/auth/
├── api/
│   ├── authApi.ts       # mockLogin / mockRegister — talks to json-server
│   ├── authStorage.ts   # localStorage vs sessionStorage picker (remember me)
│   ├── token.ts         # token storage, TTL, expiry check
│   └── session.ts       # cached User storage
├── hooks/
│   └── useAuth.ts       # the single entry point pages/components use
└── components/
    ├── AuthLayout.tsx   # shared gradient background + card shell
    └── AuthHeader.tsx   # shared avatar + title/subtitle block

src/pages/
├── LoginPage.tsx
└── RegisterPage.tsx

src/routes/
├── ProtectedRoute.tsx   # redirects to /login when not authenticated
└── PublicRoute.tsx      # redirects to /dashboard when already authenticated

src/store/slices/authSlice.ts  # Redux: { user, sessionExpired }
```

Everything outside `features/auth` (pages, routes) talks to auth exclusively
through `useAuth()`. Nothing reads `localStorage`/`sessionStorage` directly
except `token.ts` / `session.ts` / `authStorage.ts`.

## Login / register flow

1. `LoginPage` / `RegisterPage` validate the form with `react-hook-form` + `zod`.
2. On submit, they call `useAuth().login()` / `useAuth().register()`.
3. `useAuth` calls `mockLogin` / `mockRegister` in `authApi.ts`, which:
   - Fetches the active-locale error copy from `/authMessages` (cached — see
     [Auth messages caching](#auth-messages-caching) below).
   - Looks up the user by email via `GET /users?email=...`.
   - **Login:** compares the submitted password against the stored bcrypt hash
     with `bcrypt.compare`.
   - **Register:** rejects if the email already exists; otherwise hashes the
     password with `bcrypt.hash` (10 salt rounds) and `POST`s a new user
     (mock token included, no `id` — json-server v1 always assigns its own
     id on create and silently discards any `id` the client sends, so
     `mockRegister` reads the real one back from the POST response rather
     than inventing one locally. It used to invent one — the `AuthResult`
     returned an id that never matched what was actually stored, which
     stayed invisible for the rest of that same session but broke on the
     next login: `mockLogin` correctly looks the account up by email and
     returns the *real* stored id, so anything saved under the invented one
     — custom places, wishlist rows — silently stopped matching the moment
     the user logged back in.).
4. On success, `useAuth` writes the token + user to storage and dispatches
   `setUser` into Redux. On failure, `mockLogin`/`mockRegister` throw an
   `Error` with a localized message that the page shows inline (`Alert`).
5. The page navigates to `/dashboard`.

All error copy (`accountNotFound`, `incorrectPassword`, `emailAlreadyExists`,
`serverUnreachable`, `registrationFailed`) comes from `db.json`'s
`authMessages` map, keyed by locale (`en`/`ja`/`vi`). If that endpoint is
unreachable, `authApi.ts` falls back to hardcoded English defaults.

## State: `useAuth()`

```ts
interface UseAuthResult {
  isAuthenticated: boolean;
  user: User | null;
  sessionExpired: boolean;
  login: (credentials: LoginInput, rememberMe?: boolean) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  dismissSessionExpired: () => void;
}
```

- `user` lives in Redux (`authSlice`), not read ad-hoc from storage on every
  render — this is what makes the sidebar/header update immediately after
  login or logout instead of requiring a page refresh.
- `isAuthenticated` is `user !== null && hasStoredToken()` — both the cached
  user *and* a non-expired token have to be present.
- **Self-heal:** an effect watches `user` and token validity together. If the
  token disappears or expires while a user is still cached (manual
  `localStorage` edit, TTL expiry, another tab logging out) it clears the
  cached user and sets `sessionExpired: true`, rather than leaving the app in
  a half-authenticated state. An explicit `logout()` call does **not** set
  `sessionExpired` — that flag is only for involuntary expiry.
- `ProtectedRoute` / `PublicRoute` both read `isAuthenticated` from
  `useAuth()`, so they react to Redux state changes instead of only checking
  `localStorage` once per navigation.

## Session storage & "remember me"

The login form has a **Remember me** checkbox (default checked):

| `rememberMe` | Storage area | Token TTL |
|---|---|---|
| `true` (default) | `localStorage` | 30 days |
| `false` | `sessionStorage` | 1 day |

`authStorage.ts` centralizes this: writes go to exactly one area (and the
other is cleared to avoid stale duplicates); reads check `sessionStorage`
first, then `localStorage`. Registration always remembers (`rememberMe: true`)
— there's no checkbox on the register form.

Token storage (`token.ts`) wraps the raw string in `{ value, expiresAt }`. A
read past `expiresAt`, or a value that doesn't parse as that shape, is treated
as "no token" and the stale entry is removed.

`sessionExpired` in Redux drives a dismissible warning `Alert` on `LoginPage`
("Your session has expired. Please sign in again.", `auth.sessionExpired` in
the i18n files) — shown once, cleared on the next successful login or by
clicking its close button.

## Auth messages caching

`authApi.ts` fetches `/authMessages` **once per page session**, not on every
login/register attempt: `getAuthMessagesByLocale()` caches the full
per-locale map after the first successful fetch and de-dupes concurrent
in-flight requests. A failed fetch is *not* cached, so a transient mock-server
hiccup self-corrects on the next attempt instead of falling back to English
defaults for the rest of the session.

## Security notes (mock-only — revisit with a real backend)

- Passwords are bcrypt-hashed (`BCRYPT_SALT_ROUNDS = 10`) before being sent to
  `json-server` and compared with `bcrypt.compare` — not stored/compared as
  plaintext. This is still a client-side mock: `json-server` has no server
  logic, so the hashing happens in the browser. It sets the right precedent
  but is **not** equivalent to real backend-side auth.
- Mock tokens (`mock-jwt-token-<uuid>`) are opaque `crypto.randomUUID()`
  strings, not signed JWTs. They carry no claims — expiry is enforced entirely
  client-side via the `{ value, expiresAt }` wrapper in `token.ts`, which a
  user can trivially edit in devtools. Fine for a demo; must be replaced by
  real signed tokens from a real backend.
- No CSRF/XSS-hardening beyond what React gives by default (tokens sit in
  `localStorage`/`sessionStorage`, not `httpOnly` cookies).

## Testing

`src/features/auth/**/__tests__/` — Vitest + Testing Library, 28 tests:

- `api/__tests__/token.test.ts` — TTL expiry, malformed data, local vs session
  storage split.
- `api/__tests__/session.test.ts` — same storage split for the cached user.
- `api/__tests__/authApi.test.ts` — `mockLogin`/`mockRegister` happy paths and
  every error branch, plus the `/authMessages` caching behavior.
- `hooks/__tests__/useAuth.test.tsx` — reactive state after login/register/
  logout, self-heal + `sessionExpired` flagging, remember-me storage routing.

Run with `npm run test` (or `npm run test:watch`).

## Known gaps / not done here

- No cross-tab session sync (logging out in one tab doesn't reactively log
  out another open tab — only self-heals on that tab's next render/nav).
- No "forgot password" flow.
- No email verification on register.
- `logout()` is local-only; it doesn't call an API to invalidate the token
  server-side (there is no server to call).
