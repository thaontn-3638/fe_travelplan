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
      "coverUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Tokyo_Tower_2023.jpg/1280px-Tokyo_Tower_2023.jpg",
      "images": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Tokyo_Tower_2023.jpg/1280px-Tokyo_Tower_2023.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Special_observatory.jpg/1280px-Special_observatory.jpg"
      ],
      "price": 2000,
      "rating": 4.5,
      "address": "4 Chome-2-8 Shibakoen, Minato City, Tokyo",
      "lat": 35.6586,
      "lng": 139.7454,
      "region": "Tokyo",
      "country": "Japan",
      "category": "attraction",
      "description": "An iconic red-and-white lattice tower inspired by the Eiffel Tower, with an observation deck offering sweeping views over Tokyo.",
      "aliases": ["東京タワー"],
      "source": "catalog",
      "savedCount": 25
    },
    {
      "id": "p_...",
      "title": "My Secret Cafe",
      "coverUrl": "https://placehold.co/640x400/DCEEE9/223138?font=roboto&text=My%20Secret%20Cafe",
      "address": "1 Hidden Alley, Kyoto",
      "region": "Kyoto",
      "source": "custom",
      "isPublic": false,
      "createdBy": "u1",
      "createdAt": "2026-08-23T00:00:00Z",
      "savedCount": 0
    }
  ],
  "regions": [
    { "id": "r1", "name": "Kyoto", "country": "Japan", "aliases": ["京都"], "source": "catalog" },
    { "id": "r_...", "name": "Neo-Kyoto", "source": "custom", "createdBy": "u1" }
  ],
  "savedPlaces": [
    { "id": "sp1", "userId": "u1", "placeId": "p1", "addedAt": "2026-07-01T09:00:00Z" }
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

**json-server `id` behavior (applies to every collection, not just one):**
POST always assigns its **own** id and silently discards whatever `id` a
client sends in the body (`{ ...data, id: randomId() }` in
`node_modules/json-server/lib/service.js`'s `create()`). Every `createX`
function in this codebase (`createPlace`, `savePlace`, `createRegion`,
`mockRegister`) must treat its own POST **response** as the source of truth
for the created record's id — never the id it put in the request body. This
was the cause of a real bug (auth's `mockRegister` used to return its
locally-invented id instead of reading the response; see
`docs/features/auth.md`'s register-flow note) — same pattern to watch for
in any new `createX` function.

**Notes on `places` / `regions` / `savedPlaces`:**
- `places` mixes seeded `source: 'catalog'` rows with user-created
  `source: 'custom'` ones; visibility, popularity ranking, and the
  edit/delete guard are documented in `docs/features/place-search.md`, not
  here.
- This project pins **json-server v1 (beta)**, whose query syntax
  (`_sort=-field`, `field:contains=value`) is a rewrite of the classic
  json-server — see `docs/features/place-search.md`'s API table before
  assuming `q=`/`_limit`/`_order` work. `searchPlaces`/`searchRegions`
  (`src/features/places/api/`) fetch the full collection and do all
  matching (title/address/region/`aliases`, for multi-language search),
  visibility, and pagination client-side in `utils.ts` — `aliases` is an
  array field json-server can't substring-match server-side, and the mock
  catalog is small enough that this is cheap.
- Catalog `images`/`coverUrl` are real photos fetched from Wikimedia
  Commons (via each place's English Wikipedia article) at seed time, not
  hotlinked live — `utils.ts#resolveCoverUrl`'s fallback for a custom place
  with no photo is `placehold.co` (a generated placeholder, not a photo
  CDN), chosen after `picsum.photos` turned out to 503 unpredictably.

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
  price?: number;
  rating?: number;
  address: string;
  lat?: number;
  lng?: number;
  region: string;
  country?: string;
  category?: string;
  description?: string;
  images?: string[]; // gallery for the detail carousel; falls back to [coverUrl] when absent
  aliases?: string[]; // alternate-language search terms, e.g. a Japanese name
  source: 'catalog' | 'custom';
  isPublic?: boolean; // only meaningful when source = 'custom'; default false
  createdBy?: string; // userId; only when source = 'custom'
  createdAt?: string; // ISO date; only when source = 'custom'
  savedCount: number; // default 0 — total times ever added to a saved list, never decremented
}

export interface SavedPlace {
  id: string;
  userId: string;
  placeId: string;
  addedAt: string;
}

export interface Region {
  id: string;
  name: string;
  country?: string;
  aliases?: string[]; // alternate-language names, e.g. a Japanese name
  source: 'catalog' | 'custom';
  createdBy?: string; // userId; only when source = 'custom'
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
