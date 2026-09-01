# Place Search / Discover Feature

Search a catalog of travel places (or create a custom one when nothing
matches), filter by category or by "already saved," and save results into a
personal wishlist. Backed by a mock API (`json-server`) — there is no real
backend yet, so this document also tracks which parts are mock-only and what
changes once a real backend arrives.

## File map

```
src/features/places/
├── api/
│   ├── httpClient.ts       # API_BASE_URL + shared requestJson fetch wrapper
│   ├── placeApi.ts         # fetchPlaceCatalog, createPlace, updatePlace, updatePlaceVisibility,
│   │                       # deletePlace, getOtherSavers, getSavedPlaces, savePlace, removeSavedPlace
│   └── regionApi.ts        # searchRegions, createRegion
├── hooks/
│   ├── useDebounce.ts      # generic debounce
│   ├── usePlaceSearch.ts   # fetch-once catalog + client-side filter/paginate
│   └── useSavedPlaces.ts   # Redux-backed saved list (shared with the header badge)
└── components/
    ├── SearchResultsList.tsx  # left column, list of PlaceCard
    ├── PlaceCard.tsx          # compact list-row card with its own save toggle
    ├── PlaceDetailPanel.tsx   # right column: carousel, details, save/edit/delete/visibility
    ├── PlaceImageCarousel.tsx # image gallery with prev/next + dot indicators
    ├── SearchEmptyState.tsx   # zero-result state with "+ Add a new place"
    ├── PlaceFormModal.tsx     # create/edit form (react-hook-form + zod)
    ├── RegionPicker.tsx       # region autocomplete + "+ Create region" fallback
    └── MultiImageUpload.tsx   # local multi-image picker with client-side compression

src/pages/DiscoverPage.tsx  # the route itself: filters, master-detail layout, guards, dialogs

src/store/slices/savedPlacesSlice.ts  # Redux: { items: SavedPlace[], loadedForUserId }
```

## Data model

Extends the existing `Place` interface (`src/types/index.ts`):

```ts
export interface Place {
  id: string;
  title: string;
  coverUrl: string;
  price?: number;
  rating?: number;               // undefined = not yet rated (new custom places)
  address: string;
  lat?: number;
  lng?: number;
  region: string;                 // province/city, e.g. "Kyoto" — grouping + search
  country?: string;               // e.g. "Japan"
  category?: string;              // one of CATEGORY_KEYS — attraction | restaurant | hotel | shopping | other
  description?: string;
  images?: string[];              // gallery for the detail carousel; falls back to [coverUrl] when absent
  aliases?: string[];             // alternate-language search terms, e.g. a Japanese name
  source: 'catalog' | 'custom';
  isPublic?: boolean;             // only meaningful when source = 'custom'; default false
  createdBy?: string;             // userId; only when source = 'custom'
  createdAt?: string;             // ISO date; only when source = 'custom'
  savedCount: number;             // default 0 — total times ever added to a saved list
}

export interface SavedPlace {
  id: string;
  userId: string;
  placeId: string;
  addedAt: string;                 // ISO date
}

export interface Region {
  id: string;
  name: string;                    // e.g. "Kyoto"
  country?: string;
  aliases?: string[];              // alternate-language names, e.g. a Japanese name
  source: 'catalog' | 'custom';    // catalog = seeded province/city list, custom = user-added
  createdBy?: string;              // userId; only when source = 'custom'
}
```

`db.json` has `places`, `savedPlaces`, and `regions` collections. The catalog
seed includes real place data (Wikimedia cover images, descriptions, Japanese
aliases) across several Japanese regions.

## Visibility rule (catalog vs custom, public vs private)

`isPlaceVisibleTo(place, currentUserId)` (`src/features/places/utils.ts`)
resolves to visible when any of these hold:

1. `source === 'catalog'` — always visible to everyone.
2. `source === 'custom'` and `isPublic === true` — behaves like a catalog
   result to every other user.
3. `source === 'custom'`, `isPublic === false`, and `createdBy === currentUserId`.

`isPublic` defaults to `false` — a custom place is private to its creator
until they explicitly make it public.

json-server's query engine can't express that OR condition directly, so
`filterVisiblePlaces` applies it client-side, once per catalog fetch (see
"Fetching & filtering" below) — not re-run on every keystroke.

## Popularity ranking (`savedCount`)

The catalog is fetched sorted by `savedCount` descending
(`GET /places?_sort=-savedCount`), so the places most often added to a saved
list surface first.

- `savedCount` only **increments**, via a `PATCH /places/:id` that follows a
  successful `POST /savedPlaces`.
- Removing a place from a saved list (`DELETE /savedPlaces/:id`) does **not**
  decrement it. A removal can mean the place was promoted into an actual trip
  schedule (a future sprint) rather than that interest dropped — decrementing
  would penalize that outcome. `savedCount` therefore tracks cumulative
  historical interest, not "currently saved by N users."
- The sort order is fixed at fetch time. It does not re-sort locally when a
  save/unsave in the current session bumps a place's own `savedCount` — the
  list only re-sorts on the next full catalog re-fetch (e.g. after a page
  reload).

## Region search

`region` is a flat top-level string field on `Place`. The `Region` collection
only drives the **picker** in the place create/edit form, to reduce spelling
drift instead of eliminating it structurally — `Place.region` itself stays a
plain string, not a foreign key.

- `RegionPicker` is an MUI `Autocomplete` (debounced 300ms) backed by
  `searchRegions(query, currentUserId)`, which returns catalog regions plus
  the current user's own custom regions, filtered by `matchesRegionQuery`
  (name, country, or alias substring match).
- If the typed text has no exact match, an extra "+ Create region '<name>'"
  option appears. Picking it calls `createRegion(name, currentUserId)`
  (`POST /regions`, `source: 'custom'`, `createdBy: currentUserId`) and
  selects the new region. A region created this way is always private to its
  creator — there is no public/private toggle for regions like `Place.isPublic`.
- Selecting or creating a region copies its `name` into `Place.region` as a
  plain string.

## Multi-language search matching

`matchesPlaceQuery(place, query, regions)` and `matchesRegionQuery(region, query)`
(`src/features/places/utils.ts`) do a case-insensitive substring match against:

- The place's own `title`, `address`, `region`, `country`, and `aliases`.
- If none of those match, the *region's* `aliases` (looked up by
  `place.region === region.name` in the supplied `regions` list) — so a query
  like "京都" (Kyoto's Japanese name) matches every place in that region even
  if the place itself has no Japanese alias of its own.

This lets a Japanese-titled search find an English-titled catalog place (or
vice versa) without every place needing its own translated alias.

## Fetching & filtering (`usePlaceSearch`)

`fetchPlaceCatalog(currentUserId)` (`placeApi.ts`) fetches the full
`savedCount`-sorted place list plus every visible region in one round trip,
and applies the visibility filter — this happens **once per `currentUserId`**,
not on every keystroke, category click, or page change.

`usePlaceSearch(rawQuery, currentUserId, { category, savedPlaceIds })` then
derives the actual result set client-side via `useMemo`, re-running only when
its own inputs change:

1. `matchesPlaceQuery` against the debounced query (500ms).
2. `matchesCategory` — exact match against the selected category, or
   everything when `category` is `null` ("All").
3. If `savedPlaceIds` is provided (Saved-only toggle is on), keep only places
   whose id is in that set.
4. `paginate` — slices into pages of 20 (`PLACES_PAGE_SIZE`).

A new debounced query, category, or saved-filter value resets `page` to 1.

Local mutations (`patchPlaceLocally`, `removePlaceLocally`, `addPlaceLocally`
— used after save/edit/delete/create) update the in-memory catalog directly
without a network round trip, so results, but not the sort order, reflect
them immediately.

`defaultSelectedId` is the first item of the current filtered/paginated
result set, but only recomputes when the query/category/saved-filter/page
change or a fresh catalog fetch lands — not when a local mutation alone
changes the catalog (e.g. bumping a place's `savedCount` after saving it).
This keeps the currently-selected card from jumping back to the top of the
list every time something in the list is saved, edited, or deleted.

## Saved places (`useSavedPlaces` + `savedPlacesSlice`)

Backed by Redux (`savedPlacesSlice`), not local component state, since the
header badge (`DashboardLayout`) and `DiscoverPage` both need the same list
and must update in lockstep — saving a place on Discover must update the
header count without a separate fetch.

- State: `{ items: SavedPlace[], loadedForUserId: string | null }`.
- `useSavedPlaces(currentUserId)` fetches `GET /savedPlaces?userId=` once per
  distinct `currentUserId` — a second mount of the hook (e.g. the header badge
  mounting alongside Discover) skips the fetch if the store already holds
  that user's rows. `refresh()` bypasses this cache for an explicit re-sync.
- `save(place)` calls `savePlace`, which re-fetches the place fresh from the
  server and re-checks visibility before writing — see "Save guard" below —
  then dispatches `addSavedPlace`.
- `remove(placeId)` calls `removeSavedPlace` (`DELETE /savedPlaces/:id`) then
  dispatches `removeSavedPlaceRow`.
- `removeLocally(placeId)` drops the local row without an API call, for when
  the server already removed it as a side effect (`deletePlace`'s self-cascade).
- `logout()` (`useAuth`) dispatches `resetSavedPlaces()`, clearing both
  `items` and `loadedForUserId` — otherwise a same-tab re-login as the same
  user would skip the re-fetch and show whatever was cached before logout.

### Save guard

`savePlace(place, userId)` re-fetches `GET /places/:id` and checks
`isPlaceVisibleTo` against that fresh record before writing — not against the
`place` argument the caller already has, which may be stale (fetched while
still public, since made private). This closes a race where a client with a
stale copy of a place could otherwise save something it no longer has any
business seeing.

## API (json-server)

This project pins **json-server v1 (beta)**, whose query engine is a rewrite
of the classic `json-server` — no `q=` full-text param. Sort is `_sort=-field`
(prefix `-` for descending); filtering syntax is `field:operator=value`. It
also hardcodes a 100 KiB request-body limit with no config override in this
version, and always overwrites any client-supplied `id` on `POST` with its
own generated one — both of these shaped the image-upload and id-handling
design below.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/places?_sort=-savedCount` | full catalog, most-saved first (fetched once per user session — see `fetchPlaceCatalog`) |
| `POST` | `/places` | create a custom place (`source: 'custom'`, `isPublic` defaults to `false`) |
| `PATCH` | `/places/:id` | creator edits fields, toggles `isPublic`, or the internal `savedCount` increment |
| `DELETE` | `/places/:id` | creator deletes their own custom place — see "Editing & deleting a custom place" |
| `GET` | `/savedPlaces?userId=` | current user's saved list |
| `GET` | `/savedPlaces?placeId=` | everyone's saved rows for one place — used by the edit/delete guard |
| `POST` | `/savedPlaces` | add a place to the list (client checks for an existing `placeId` + `userId` pair first, to avoid duplicates), followed by a `PATCH /places/:id` to increment `savedCount` |
| `DELETE` | `/savedPlaces/:id` | remove from the list — does not touch `savedCount` |
| `GET` | `/regions` | full region list, filtered client-side to catalog + this user's own custom regions |
| `POST` | `/regions` | create a custom region (`source: 'custom'`, always private to `createdBy`) |

Visibility filtering, category/saved filtering, and pagination all happen
client-side on top of the one `/places` fetch — see "Fetching & filtering."

## Discover page layout

`DiscoverPage` renders inside `DashboardLayout`; the header search box there
(shared with Dashboard's own search) is what drives `rawQuery` — Discover has
no second search field of its own. Navigating away from a route clears the
header search query so it doesn't leak into whichever page is opened next.

- **Category chips** row (below the page title): "All" plus one chip per
  `CATEGORY_KEYS` entry, single-select, default "All." A "Saved" chip with a
  bookmark icon sits at the far right and toggles the saved-only filter
  independently of category.
- **Saved-only filter** is derived directly from the `?saved=true` URL search
  param (not separately-tracked component state), so the browser Back/Forward
  buttons and the header's bookmark icon both stay in sync with the chip's
  visual state. Toggling the chip updates the URL param; clicking the header
  icon navigates straight to `/discover?saved=true`.
- **Layout** (`lg` breakpoint and up): a two-row CSS grid. Row 1 is
  `[4fr_6fr]` — a scrollable result list (`SearchResultsList`) on the left,
  the selected place's `PlaceDetailPanel` on the right, both stretched to the
  same height. Row 2, spanning only the left column, holds pagination (MUI
  `Pagination`, centered, shown only when there is more than one page). Below
  `lg`, the page stacks vertically and scrolls normally.
- **States:**
  - Initial load: centered spinner.
  - Idle (no query, no category, no saved filter): the catalog itself, in
    `savedCount` order, under a "Trending" heading.
  - Zero results with the Saved filter on: a dedicated "no saved places yet"
    empty state.
  - Zero results otherwise: `SearchEmptyState`, with a button that opens
    `PlaceFormModal` in create mode.
  - Fetch error: a dismissible `Alert` above the results area.
- **Toasts**: a single top-right `Snackbar` (clears the sticky app bar) is
  used for every action failure — a blocked edit/delete/visibility change, a
  save rejected because the place is no longer visible, or any other API
  error from a mutation.

## Save/wishlist toggle

Every `PlaceCard` in the list, and the `PlaceDetailPanel`, has its own
bookmark toggle button reflecting `isSaved(place.id)`. Clicking a card's save
button toggles the save state without also changing which card is selected
(the click still bubbles to select the card, since selecting on click is the
card's normal behavior either way). While a save/remove request for a given
place is in flight, only that place's button shows a pending state.

Saving increments `savedCount` on the place and reflects immediately via
`patchPlaceLocally`; removing does not decrement it.

## Create / edit place form (`PlaceFormModal`)

Fields: `title*`, `address*`, `region*` (via `RegionPicker`), `images*`
(via `MultiImageUpload`, at least one required), `category*` (select, one of
`CATEGORY_KEYS`), `price` (optional, `>= 0`), `description` (optional), and a
**Public** switch (default off — `isPublic: false`). Validated with
`react-hook-form` + `zod`; the same schema and field set serve both create and
edit mode.

On create, the modal closes and the new place is prepended to the current
in-memory result list and auto-selected — it is not automatically added to
the creator's saved list. On edit, the patched fields are merged into the
existing place in place.

### Image upload

Images are uploaded from local files (no URL field) via `MultiImageUpload`,
multi-select. Each file is:

1. Decoded with `createImageBitmap`, resized so its longest edge is at most
   480px, and re-encoded as a JPEG on a canvas (white background, so a
   transparent PNG doesn't turn black).
2. Quality starts at 0.72 and steps down (to a floor of 0.35) until the
   resulting base64 data URL is under a 20 KiB per-image target.
3. Accepted only if the running total of all images for this place stays
   under an 85 KiB safety budget, leaving headroom under json-server's fixed
   100 KiB request-body limit for the rest of the form fields in the same
   request.

The stored value is the base64 `data:image/jpeg;base64,...` string itself,
not a `blob:`/object URL — this is what makes an uploaded image visible after
a reload and to a different account reading the same record; an object URL
only resolves inside the browser tab that created it.

## Editing & deleting a custom place

Only the creator (`createdBy === currentUserId`) can act on their own custom
place. Three actions exist: edit its fields, delete it, or flip it from
public to private. **All three are allowed only while no one else has it
saved:**

1. `getOtherSavers(placeId, currentUserId)` fetches `GET /savedPlaces?placeId=`
   and filters out the creator's own row. If anything remains, the place is
   "in the wild."
2. If nothing remains, all three are allowed:
   - **Edit** (`PATCH /places/:id`).
   - **Delete** (`DELETE /places/:id`) — also removes the creator's own
     `savedPlaces` row for it, if any (self-cascade only).
   - **Public → private** (`PATCH /places/:id`) — the other direction
     (private → public) is always allowed regardless of savers.

**Enforcement is server-side, not just UI.** `DiscoverPage` disables/greys out
the Edit, Delete, and visibility-toggle icons for a place it can't currently
modify, but every mutation (`updatePlace`, `deletePlace`,
`updatePlaceVisibility` going private) independently re-runs the same
`getOtherSavers` check inside `placeApi.ts` before writing, throwing
`PlaceGuardError` if it fails. This means a UI that's briefly stale (e.g. mid
network round trip, or just hasn't refreshed since another user saved the
place) can never let a blocked mutation through — the client-side check is
strictly a faster-feedback / greyed-out-icon convenience, not the actual
boundary.

`DiscoverPage` also re-runs the client-side check whenever the tab regains
focus (`visibilitychange`/`focus`), alongside a saved-places refresh, so the
UI's guess narrows to "since I last looked at this tab" instead of "since I
last loaded the page." This is a UX freshness improvement only; it doesn't
change what the server-side guard allows.

This guard only checks `savedPlaces`. It does not check trip activities,
since no trip feature references `placeId` yet.

## Header integration (`DashboardLayout`)

- The header search `TextField` is shared by every page under
  `DashboardLayout` (backed by one Redux `ui.searchQuery` value); its
  placeholder swaps to a Discover-specific hint while `/discover` is active.
  The query resets to empty on every route change so a query typed on one
  page never carries into another.
- A bookmark icon with an MUI `Badge` shows the current user's saved-place
  count (from `useSavedPlaces`) and links to `/discover?saved=true`.

## Edge cases

- **Duplicate name** between a custom place and a catalog place — allowed,
  they're distinguished by `id`/`source`; no dedup logic.
- **Price of `0`** is a real value (a free place) and is preserved through
  edit round-trips, distinct from leaving the field blank.

## Testing

`src/features/places/__tests__/utils.test.ts` — Vitest, covering
`isPlaceVisibleTo`, `filterVisiblePlaces`, `canModifyPlace`, `matchesPlaceQuery`
(including the region-alias fallback), `matchesRegionQuery`, `matchesCategory`,
`resolvePlaceImages`, `paginate`, and `getPageCount`.

Run with `npm run test` (or `npm run test:watch`).

## Known gaps / not done here

- `savedCount` is incremented via a separate, non-atomic `PATCH` after
  `POST /savedPlaces` — two near-simultaneous saves can race. A real backend
  would increment atomically at the database level.
- The delete/private guard only checks `savedPlaces`. It doesn't check trip
  activities, since no trip feature currently links to a `placeId`.
- The `savedPlaces` guard check and the delete/PATCH call aren't atomic
  either (mock has no transactions) — another user could save the place
  between the check and the delete. Acceptable for a mock app, not for a
  real backend.
- `Place.region` is still a denormalized string, not a real foreign key to
  `Region` — the autocomplete picker steers users toward existing names, but
  a user who creates a custom region instead of finding the matching catalog
  one still introduces drift (e.g. "Kyoto" vs "Kyoto-shi" as two separate
  private regions).
- The full catalog (all places + regions) is fetched in one request and
  filtered/sorted/paginated client-side — fine for a few dozen mock places,
  but doesn't scale to a real catalog. A real backend should do filtering,
  sorting, and paging server-side.
- No cross-tab sync: another tab or user saving/editing/deleting a place only
  becomes visible here on the next catalog fetch or the tab-focus refresh —
  there's no push/websocket update.
