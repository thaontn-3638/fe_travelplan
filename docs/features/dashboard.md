# Dashboard Feature

Trip overview screen shown after login. Mock data (`MOCK_TRIPS`) for now — no
`db.json` collection yet — but the data shape already mirrors the real `Trip`
model in `src/types/index.ts` so swapping in a real API later is a data-source
change, not a component rewrite.

## File map

```
src/features/dashboard/
├── data/
│   └── mockTrips.ts       # static TripSummary[] + SAVED_PLACES_COUNT
├── types.ts               # TripStatus, TripIcon, Traveler, TripSummary
├── selectors.ts           # pure functions: stats, featured trip, search
└── components/
    ├── StatFlapBoard.tsx      # split-flap stat tiles (trips, budget, ...)
    ├── BoardingPassHero.tsx   # featured trip, boarding-pass styled
    ├── TripGrid.tsx           # grid of TripCard + AddTripCard
    ├── TripCard.tsx           # one trip, clickable
    ├── TripDetailsDialog.tsx  # read-only detail popup on card click
    ├── TripStatusChip.tsx     # status pill (color per TripStatus)
    ├── TravelerAvatars.tsx    # overlapping avatar stack
    ├── TripCoverIcon.tsx      # SVG icon per TripIcon
    ├── iconGradients.ts       # cover gradient per TripIcon (from theme/palette)
    ├── EmptyTripsState.tsx    # shown when there are zero trips
    └── AddTripCard.tsx        # disabled "create trip" placeholder

src/pages/DashboardPage.tsx    # composes everything above
src/layouts/DashboardLayout.tsx # sidebar + top bar (search, account menu)
src/components/ComingSoonButton.tsx # shared disabled-with-tooltip control
```

## Layout: `DashboardLayout`

Sidebar (nav items, all disabled except Dashboard — no other routes exist
yet) + top bar (sidebar toggle, search, language switcher, account menu).

- **Sidebar default state** is viewport-aware, not a fixed `true`:
  `uiSlice`'s `isSidebarOpen` initializes from `window.innerWidth` against the
  MUI `md` breakpoint, so it opens on desktop and stays closed on mobile
  (`Drawer` is `persistent` on desktop, `temporary` on mobile).
- **Nav active state** compares `item.path` to `useLocation().pathname` —
  not hardcoded to `/dashboard`.
- **Search** lives in `uiSlice.searchQuery` (global, since the input is in
  the layout header but results render in the page below it). The `TextField`
  is `flex-1` on mobile and a fixed `300px` from `sm:` up — it used to be
  `hidden sm:block`, which looked like it hid the field on mobile but didn't
  (MUI's own `display: flex` won the cascade over Tailwind's `hidden`), and
  was the actual cause of a real horizontal-overflow bug. Don't reintroduce a
  fixed-width search field without `min-w-0` somewhere in the flex chain.

## Page: `DashboardPage`

1. Reads `MOCK_TRIPS` directly — no fetch, no loading state (mock only).
2. If `searchQuery` (from `uiSlice`) is non-empty, renders **only** the search
   results section — every other section (greeting, countdown, stats,
   featured trip, all-trips grid) is hidden. Clearing the query restores the
   normal view. This is a same-page mode switch, not a separate route — there
   was no reason to add routing overhead for filtering an in-memory array.
3. Otherwise renders: greeting + countdown → `StatFlapBoard` → featured trip
   (`BoardingPassHero`, via `getFeaturedTrip`) → `TripGrid` of all trips — or
   `EmptyTripsState` if `MOCK_TRIPS` is empty.
4. Clicking any `TripCard` opens `TripDetailsDialog` for that trip (local
   `selectedTrip` state, shared between the normal and search-results modes).

## Search

`searchTripsByName(trips, query)` in `selectors.ts` — case-insensitive
substring match against `trip.name`.

**Important:** it matches `name`, never a translated display string. `name`
is a plain, locale-independent field (mirrors `Trip.name` on the real model —
a user-typed trip name has no "translation"). `title`/`subtitle`/`destination`
are still driven by `translationKey` for *display* — those are demo flavor
text pretending to be officially-translated content, not the real shape. If
search had matched the translated `title` instead (the first implementation
did), switching the UI language changed what a previously-typed query
matched — same text, different result set. Keep this split if the mock data
ever grows: canonical field for identity/search, translated fields for
display only.

## Trip status

`status` is a static field on `TripSummary`, taken as-is — **not** derived
from `startDate`/`endDate`/today's date. An earlier version auto-promoted
`confirmed`/`planning` trips to `ongoing` when today fell inside their date
range; that was deliberately reverted. Once a real backend exists, `status`
will come from the server and must stay authoritative — don't reintroduce
client-side status derivation.

## Not-yet-built features

Every entry point for a feature that doesn't exist yet (sidebar nav items
other than Dashboard, "Open itinerary", "View all", "+ New trip",
`AddTripCard`) uses the same pattern: `disabled` + `title="Coming soon"`
(`ComingSoonButton` for text links, native `disabled` for buttons/inputs).
Keep new placeholders consistent with this — a clickable-looking element that
silently does nothing (no disabled state, no tooltip) reads as broken, not
as "not built yet".

## Testing

`src/features/dashboard/__tests__/` — Vitest + Testing Library:

- `selectors.test.ts` — `searchTripsByName` (case-insensitivity, empty query,
  no-match, locale-independence)
- `EmptyTripsState.test.tsx` — renders the no-trips copy

Run with `npm run test`. No component tests yet for `TripCard`,
`BoardingPassHero`, `DashboardPage`, etc. — verified manually in-browser
during development instead (see PR history), not automated.

## Known gaps / not done here

- No real backend — `db.json` has no `trips`/`places` collection yet; all
  data is `MOCK_TRIPS`.
- No pagination/virtualization — fine at 6 mock trips, will matter at scale.
- `TripDetailsDialog` is read-only — no edit/delete.
- No component-level render tests (only pure-logic + one presentational
  component are covered).
