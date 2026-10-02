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
      "email": "kenji@gmail.com",
      "password": "$2b$10$eO8OywzLjgCUY.fBcPYgbOxyrsgssDjngLdZ78Y1JhhHzCm9RrVWG",
      "fullName": "Kenji Tanaka",
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
      "ownerId": "u1",
      "name": "Kyoto 5-Day Trip",
      "regions": [{ "id": "r1", "name": "Kyoto", "country": "Japan" }],
      "startDate": "2026-09-20",
      "endDate": "2026-09-24",
      "status": "planning",
      "travelers": [
        { "id": "tv1", "userId": "u1", "fullName": "Kenji Tanaka", "initials": "KT", "colorClass": "bg-ocean" },
        { "id": "tv2", "fullName": "Bi", "initials": "B", "colorClass": "bg-mint", "isChild": true, "guardianId": "tv1" }
      ],
      "party": { "adults": 1, "children": 1 },
      "currency": "JPY",
      "budget": null,
      "budgetPerPerson": 80000,
      "spent": 12000,
      "budgetPlan": [
        { "id": "bn1", "parentId": null, "category": "lodging", "title": "Ryokan", "pricingMode": "lumpSum", "lumpSum": 44000, "quantity": 2, "order": 0 }
      ],
      "treasurerId": "tv1",
      "days": [
        {
          "id": "d1",
          "date": "2026-09-20",
          "items": [
            { "id": "i1", "kind": "place", "placeId": "p1", "startTime": "09:00", "endTime": "11:00", "order": 0, "note": "Đi sớm" },
            { "id": "i2", "kind": "activity", "title": "Onsen", "category": "other", "startTime": null, "endTime": null, "order": 1 }
          ]
        }
      ],
      "unscheduledItems": [],
      "shareToken": "190337c929e34210a6660fd26aa7829d",
      "shareScope": { "plan": true, "actual": false },
      "sharedAt": "2026-10-02T02:52:00.000Z",
      "updatedAt": "2026-10-02T02:52:00.000Z"
    }
  ],
  "expenses": [
    {
      "id": "e1",
      "tripId": "t1",
      "kind": "expense",
      "date": "2026-09-20",
      "category": "food",
      "title": "Ramen",
      "amount": 3000,
      "payerId": "tv1",
      "splitMode": "equal",
      "shares": [{ "travelerId": "tv1" }, { "travelerId": "tv2" }],
      "createdAt": "2026-09-20T12:00:00.000Z",
      "createdBy": "u1"
    }
  ],
  "expenseHistory": [
    {
      "id": "h1",
      "tripId": "t1",
      "expenseId": "e1",
      "action": "update",
      "at": "2026-09-20T14:00:00.000Z",
      "userId": "u1",
      "userName": "Kenji Tanaka",
      "before": { "kind": "expense", "date": "2026-09-20", "category": "food", "title": "Ramen", "amount": 2700, "payerId": "tv1", "splitMode": "equal", "shares": [{ "travelerId": "tv1" }, { "travelerId": "tv2" }] },
      "after": { "kind": "expense", "date": "2026-09-20", "category": "food", "title": "Ramen", "amount": 3000, "payerId": "tv1", "splitMode": "equal", "shares": [{ "travelerId": "tv1" }, { "travelerId": "tv2" }] }
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
Nguồn sự thật là `src/types/index.ts`; tóm tắt các type chính (chi tiết từng
field + luật nghiệp vụ: `docs/features/trip-board.md` §2 và
`docs/features/trip-budget.md` §2):

```ts
export type Currency = 'JPY' | 'VND' | 'USD';
export type TripStatus = 'idea' | 'planning' | 'confirmed' | 'ongoing' | 'settling' | 'done';

export interface ItineraryItem {          // tagged union theo `kind`
  id: string;
  kind: 'place' | 'activity';
  placeId?: string;                       // kind = 'place'
  title?: string; category?: string;      // kind = 'activity'
  startTime: string | null;               // "HH:mm" — cả hai cùng null hoặc cùng có giá trị
  endTime: string | null;
  order: number;
  note?: string;                          // <= 100 ký tự
}

export interface Trip {
  id: string;
  ownerId?: string;                       // chủ trip (R14) — optional chỉ cho dữ liệu cũ
  name: string;
  regions: TripRegion[];
  startDate: string; endDate: string | null;
  status: TripStatus;
  travelers: Traveler[]; party: PartySize;
  currency: Currency;
  budget: number | null; budgetPerPerson: number | null; spent: number;
  budgetPlan: BudgetNode[]; treasurerId?: string;
  days: ItineraryDay[]; unscheduledItems: ItineraryItem[];
  shareToken?: string | null; sharedAt?: string;   // link xem công khai (trip-share.md)
  shareScope?: { plan: boolean; actual: boolean }; // 2 mức chia sẻ, thiếu = chỉ plan
  updatedAt: string;
}

export interface Expense { /* trip-budget.md §2.4 */ }
export interface ExpenseHistoryEntry { /* trip-budget.md §2.5b — append-only */ }
```

**Notes:**
- `ItineraryItem` is a **tagged union** on `kind` (`'place' | 'activity'`) — the
  pattern this project uses for any heterogeneous array (see
  `docs/01-architecture.md` §2). The old `Activity` / `type: 'flight' | 'place'`
  model was migrated away (`scripts/migrate-trips.mjs`).
- `User` (public, exported here) is intentionally **not** the same shape as the
  `users` row in `db.json`. `authApi.ts` keeps a private `StoredUser` interface
  (adds `password` + `mockToken`) that never leaves that file — `toPublicUser()`
  strips both fields before the rest of the app ever sees a `User`. Never widen
  the exported `User` type to include auth secrets.

## Trip ownership (2026-10-02)

`Trip.ownerId` (userId của người tạo). Một tài khoản thấy trip khi là chủ **hoặc**
là thành viên đã gắn tài khoản (`travelers[].userId`) — `canViewTrip()` trong
`features/itinerary/utils/tripAccess.ts`. json-server không lọc được điều kiện
"hoặc" nên `getTrips(userId)` lọc ở client; backend thật phải lọc ở server.
Dữ liệu cũ: chạy `node scripts/migrate-ownership.mjs` (tắt json-server trước).

## Collections thêm sau (2026-10-02)

| Collection / field | Dùng cho | Migration |
|---|---|---|
| `expenses` | Khoản chi thực tế + giao dịch quyết toán (`trip-budget.md` §2.4) | có từ trước |
| `expenseHistory` | Lịch sử thêm / sửa / xoá khoản chi (`trip-budget.md` S10) | `node scripts/migrate-expense-history.mjs [--backfill]` |
| `Trip.shareToken`, `Trip.sharedAt`, `Trip.shareScope` | Link xem công khai, 2 mức (`trip-share.md`) | không cần — field optional |

json-server v1 **không** tự tạo collection khi POST vào một collection chưa có
(trả 404), nên collection mới phải có sẵn trong `db.json`. Mọi migration: tắt
json-server trước khi chạy — server giữ dữ liệu trong bộ nhớ và ghi đè
`db.json` ở lần ghi kế tiếp.

json-server v1 cũng **bỏ qua** tham số lọc theo field lồng (`?share.token=`) và
trả về toàn bộ collection — vì vậy `shareToken` là field cấp một, và
`getSharedTrip()` vẫn lọc lại ở client.
