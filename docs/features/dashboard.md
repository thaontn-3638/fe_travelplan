# Dashboard Feature

Trip overview screen shown after login. Backed by the real `Trip` model and
`GET /trips` (see `trip-board.md`) — Dashboard and the Itinerary feature share
one data source; there is no separate mock trip model anymore.

## File map

```
src/features/dashboard/
├── selectors.ts           # pure functions: stats, featured trip, search — operate on Trip[]
└── components/
    ├── StatFlapBoard.tsx      # split-flap stat tiles (trips, budget, ...)
    ├── BoardingPassHero.tsx   # featured trip, boarding-pass styled
    ├── DashboardTaskList.tsx  # "やること" — incomplete plans, settlement pending, outdated status
    └── EmptyTripsState.tsx    # shown when there are zero trips

src/features/itinerary/components/TripCard.tsx  # shared trip card (Dashboard + Itinerary list)
src/features/itinerary/hooks/useTrips.ts        # fetch-once Trip[] (Redux-backed)
src/features/itinerary/hooks/useTripCovers.ts   # places-by-id lookup for cover photos

src/pages/DashboardPage.tsx    # composes everything above
src/layouts/DashboardLayout.tsx # sidebar + top bar (search, account menu)
src/components/ComingSoonButton.tsx # shared disabled-with-tooltip control
src/components/TripStatusChip.tsx   # status pill (color per TripStatus) — shared with Itinerary
src/components/TravelerAvatars.tsx  # overlapping avatar stack — shared with Itinerary
src/components/PageLoading.tsx      # spinner shown while a page loads (instead of a blank page)
src/components/LoadErrorState.tsx   # load failed ≠ no data: error card + retry
```

## Layout: `DashboardLayout`

Sidebar (nav items; Dashboard, Discover, and Itinerary are live, others still
disabled) + top bar (sidebar toggle, search, language switcher, account menu).

- **Sidebar default state** is viewport-aware, not a fixed `true`:
  `uiSlice`'s `isSidebarOpen` initializes from `window.innerWidth` against the
  MUI `md` breakpoint, so it opens on desktop and stays closed on mobile
  (`Drawer` is `persistent` on desktop, `temporary` on mobile).
- **Nav active state** compares `item.path` against `useLocation().pathname`,
  matching both an exact route and any of its sub-routes (`/itinerary/123`
  keeps the Itinerary nav item highlighted).
- **Search** lives in `uiSlice.searchQuery` (global, since the input is in
  the layout header but results render in the page below it). The `TextField`
  is `flex-1` on mobile and a fixed `300px` from `sm:` up — it used to be
  `hidden sm:block`, which looked like it hid the field on mobile but didn't
  (MUI's own `display: flex` won the cascade over Tailwind's `hidden`), and
  was the actual cause of a real horizontal-overflow bug. Don't reintroduce a
  fixed-width search field without `min-w-0` somewhere in the flex chain.

## Page: `DashboardPage`

1. `useTrips()` fetches the trips **this account can see** once (Redux-cached —
   see `trip-board.md` and `canViewTrip()`); `useExpenses()` loads expenses so
   the task list knows which trips still have open balances.
2. Renders: greeting + countdown → `StatFlapBoard` (3 tiles: trip count, trips
   this month, total cap — summed **per currency**, never mixed) → featured
   trip (`BoardingPassHero`, via `getFeaturedTrip`) → **やること** task list
   (`DashboardTaskList`) — or `EmptyTripsState` if there are zero trips.
3. "Saved places" is no longer a stat tile — the header already shows it as a
   badge. The old "All trips" grid was removed: it duplicated the 旅程 screen.
4. Loading → `PageLoading` spinner; trip fetch failed → `LoadErrorState` with a
   retry button. A failed fetch is **not** shown as the "no trips yet" state
   (`useTrips` exposes `error` and no longer stores `[]` on failure).

### 合計予算 tile

No exchange rates, so each currency is its own line: `JPY ¥2,205,000` /
`USD $4,000.00` — only currencies that at least one trip uses (no VND line when
there is no VND trip). Rendered as a plain list (`FlapStat.lines`), not as
split-flap tiles: chunking `¥2,205,000 + $4,000.00` into flap halves read as
unrelated numbers. Trip count and this-month tiles keep the flap style.

### Featured trip budget bar

Same thresholds as the 精算 hub: mint up to 80 %, amber above 80 %, **coral when
over the cap**, plus a "+¥N over" line.

## Task list (やること)

`getDashboardTasks(trips, moneyByTrip, today)` in `selectors.ts` — pure, takes
`today` as a `yyyy-MM-dd` string in the user's local time (`todayISO()`), so it
is testable with a fixed date. Priority order:

1. **Status out of date** — in the date range but still idea/planning/confirmed
   → suggest 旅行中; past `endDate` but not settling/done → suggest 精算待ち (has
   expenses) or 完了 (none); 旅行中 before the start date → suggest 確定.
   One-click change with an Undo snackbar.
2. **Waiting to settle** — status 精算待ち, or the trip has ended with a
   non-zero balance. Skipped when (1) already exists for the same trip.
3. **Plan incomplete** — trip not started yet and `tripProgress < 4`; the
   button jumps to the first missing wizard step (`nextIncompleteStep`).
   Sorted by days until departure, with an "あとN日" chip within 30 days.

Max 5 rows, then "show more". "後で" hides one task in this browser
(`localStorage`, keyed per user; failure to read/write is ignored) and shows an
**Undo** snackbar. Hidden tasks can be brought back with "非表示にしたタスクを表示（N）"
next to the heading (shown only while N > 0).

## Trip cover

`TripCard`/`BoardingPassHero` show a photo cover:
`resolveTripCoverUrl(trip, placesById)` (`features/itinerary/utils/tripDefaults.ts`)
uses the first place in the itinerary (earliest day, then earliest `order`).
Without any place it falls back to one of four illustrated SVG covers in
`public/covers/` (sky + mountains + flight path in the app palette), picked
deterministically from the trip id so a list of empty trips isn't one image
repeated.

## Trip status

`status` is a static field on `Trip`, taken as-is — **not** derived from
`startDate`/`endDate`/today's date. An earlier version (when Dashboard still
used mock data) auto-promoted `confirmed`/`planning` trips to `ongoing` when
today fell inside their date range; that was deliberately reverted. The task
list only **suggests** a status from the dates — the user confirms with a
click. Don't add silent client-side status derivation.

## Not-yet-built features

The Settings nav item was removed (2026-10). The Detail screen's "Share" button
is now a real feature (`trip-share.md`), so `ComingSoonButton` currently has no
users. If a placeholder is needed again, keep the `disabled` + reason pattern —
but note a disabled button never shows its tooltip on touch screens; prefer an
enabled control with a visible "coming soon" badge.

## Testing

`src/features/dashboard/__tests__/` — Vitest + Testing Library:

- `selectors.test.ts` — task-list rules (status suggestions, settle, plan,
  priority order, de-duplication), featured trip on departure day, cap summed
  per currency.
- `EmptyTripsState.test.tsx` — renders the no-trips copy.

Run with `npm run test`. No component tests for `TripCard`, `BoardingPassHero`,
`DashboardPage`, etc. — verified manually during development instead.

## Known gaps / not done here

- "後で" is per-browser only (localStorage) — it does not sync across devices.
- `budget`/`spent`/`travelers` still exist on `Trip` for Dashboard's stat
  board and boarding-pass hero, but nothing in the Itinerary create/edit flow
  manages them yet (new trips default to `budget: null`, `spent: 0`, and a
  single traveler — the creator).
