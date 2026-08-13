# DATABASE SCHEMA & TYPESCRIPT INTERFACES
This document mirrors the **current** shape of `db.json` (mock backend, served by
JSON Server) and the corresponding TypeScript interfaces in `src/types/index.ts`.
It's a living reference — update it whenever a collection or interface shape
changes, don't just re-derive it once at project start.

## 1. Mock DB Schema (`db.json`)
```json
{
  "users": [
    {
      "id": "u1",
      "email": "admin@wanderplan.com",
      "password": "$2b$10$eO8OywzLjgCUY.fBcPYgbOxyrsgssDjngLdZ78Y1JhhHzCm9RrVWG",
      "fullName": "Admin User",
      "phoneNumber": "+84901234567",
      "mockToken": "mock-jwt-token-12345"
    }
  ],
  "authMessages": {
    "en": {
      "accountNotFound": "No account found with this email.",
      "incorrectPassword": "Incorrect password.",
      "emailAlreadyExists": "Email already exists.",
      "serverUnreachable": "Unable to reach the authentication server.",
      "registrationFailed": "Unable to create account."
    },
    "ja": { "...": "same 5 keys, Japanese copy" },
    "vi": { "...": "same 5 keys, Vietnamese copy" }
  },
  "places": [
    {
      "id": "p1",
      "title": "Tokyo Tower",
      "coverUrl": "https://example.com/tokyo-tower.jpg",
      "price": 2000,
      "rating": 4.5
    }
  ],
  "trips": [
    {
      "id": "t1",
      "name": "Japan Summer Trip",
      "budget": 50000,
      "days": [
        {
          "id": "d1",
          "date": "2026-08-01",
          "activities": [
            {
              "id": "a1",
              "type": "flight",
              "title": "Flight to NRT",
              "flightNo": "JL123",
              "startTime": "2026-08-01T08:00:00Z",
              "endTime": "2026-08-01T14:00:00Z",
              "cost": 15000
            },
            {
              "id": "a2",
              "type": "place",
              "title": "Tokyo Tower",
              "placeId": "p1",
              "startTime": "2026-08-01T16:00:00Z",
              "endTime": "2026-08-01T18:00:00Z",
              "cost": 2000
            }
          ]
        }
      ]
    }
  ]
}
```

**Notes on `users` / `authMessages`:**
- `password` is a **bcrypt hash** (`bcryptjs`, 10 salt rounds), never plaintext.
  Hashing happens client-side in `authApi.ts` since JSON Server has no server
  logic — this is a mock-only precaution, not real backend security.
- `mockToken` is an opaque `mock-jwt-token-<crypto.randomUUID()>` string, not a
  signed JWT. It carries no claims; expiry is enforced client-side (see
  `docs/features/auth.md`), not by anything in `db.json`.
- `authMessages` holds one message set per supported locale (`en`, `ja`, `vi`,
  matching `SUPPORTED_LANGUAGES` in `src/i18n/index.ts`). The client fetches
  this once per session and picks the active locale — see the "Auth messages
  caching" section of `docs/features/auth.md`.
- Full auth flow, session storage strategy, and security caveats are documented
  in `docs/features/auth.md` — this file only tracks the data shape.

## 2. TypeScript Interfaces (`src/types/index.ts`)
```ts
export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
}

export interface Place {
  id: string;
  title: string;
  coverUrl: string;
  price: number;
  rating: number;
}

interface BaseActivity {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  cost: number;
}

export interface FlightActivity extends BaseActivity {
  type: 'flight';
  flightNo: string;
}

export interface PlaceActivity extends BaseActivity {
  type: 'place';
  placeId: string;
}

export type Activity = FlightActivity | PlaceActivity;

export interface TripDay {
  id: string;
  date: string;
  activities: Activity[];
}

export interface Trip {
  id: string;
  name: string;
  budget: number;
  days: TripDay[];
}
```

**Notes:**
- `Activity` is a **tagged union** on `type` (`'flight' | 'place'`) — the
  pattern this project uses for any heterogeneous array (see
  `docs/01-architecture.md` §2). Adding a new activity kind means adding a new
  `type` literal + interface here, then a type guard in `src/utils/typeGuards.ts`
  (see `isFlightActivity` / `isPlaceActivity`).
- `User` (public, exported here) is intentionally **not** the same shape as the
  `users` row in `db.json`. `authApi.ts` keeps a private `StoredUser` interface
  (adds `password` + `mockToken`) that never leaves that file — `toPublicUser()`
  strips both fields before the rest of the app ever sees a `User`. Never widen
  the exported `User` type to include auth secrets.
