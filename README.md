# WanderPlan

WanderPlan is a travel-planning web app for small groups — families or friends
planning a trip together. It covers the whole journey of a trip in one place:

1. **Plan** — pick destinations, lay out each day, schedule times.
2. **Budget** — estimate costs before you go.
3. **Spend & settle** — log real expenses during the trip and work out who owes whom.
4. **Share** — send a read-only link to anyone, no account needed.

The UI is available in **Japanese, English and Vietnamese** (Japanese is the
primary design language). This is a front-end project: the "backend" is a mock
REST API served by [JSON Server](https://github.com/typicode/json-server) from
`db.json`.

---

## Features

| Area | What you can do |
|---|---|
| **Dashboard** | See your next trip, a to-do list (unfinished plans, trips waiting to be settled, statuses that look out of date) and your total budget per currency. |
| **Discover** (`/discover`) | Search places by name, address or region (multi-language aliases), filter by category, save places to your wishlist, add your own custom places (public or private). |
| **Itinerary** (`/itinerary`) | A 4-step wizard: **1** basics (destinations, dates, party size, members) → **2** arrange places and activities per day (drag & drop, or a "move to day" menu on mobile) → **3** set times on a calendar → **4** budget. Trips can be viewed as cards or as a Kanban board by status. |
| **Trip detail** | Read-only view with list, timeline (hover to see notes) and cost tabs. |
| **Budget (Step 4)** | A budget tree up to 3 levels deep, per-person or lump-sum items, a cap for the whole trip or per person, JPY / USD / VND. |
| **Settlement** (`/settlement`) | Log expenses (split equally or by exact amounts; children are paid for by a guardian), compare plan vs. actual, settle through a treasurer, see who changed which expense (history tab), and view your own spending stats per currency. |
| **Sharing** | The trip owner can publish a read-only link at two independent levels: **Level 1** the plan (no member names), **Level 2** actual spending and settlement. |
| **Collaboration** | Members linked to an account can edit the trip. Only the owner can delete the trip, remove members or manage sharing. If two people edit the same part of a trip, the second save asks which version to keep. |

---

## Tech stack

- **React 18 + TypeScript + Vite**
- **Material UI** for interactive components, **Tailwind CSS** for layout and spacing
- **Redux Toolkit** (auth, UI, trips, saved places), **React Router** (data router)
- **React Hook Form + Zod** for forms
- **react-i18next** — `src/i18n/locales/{ja,en,vi}.json`
- **@dnd-kit** (drag & drop), **FullCalendar** (Step 3 schedule), **date-fns**
- **JSON Server v1 (beta)** as the mock API, **bcryptjs** for mock password hashing
- **Vitest + Testing Library + jsdom** for tests

---

## Getting started

### Requirements

- Node.js 20 or newer
- npm

### Install and run

```bash
npm install
cp .env.example .env      # VITE_API_BASE_URL=http://localhost:3000
npm run dev:all           # Vite (http://localhost:5173) + JSON Server (http://localhost:3000)
```

Then open http://localhost:5173 and sign in with the demo account:

| Email | Password |
|---|---|
| `thao@gmail.com` | `Aa@123456` |

You can also register a new account from the sign-up page.

### Scripts

| Command | Description |
|---|---|
| `npm run dev:all` | Run the app and the mock API together |
| `npm run dev` | Run only the Vite dev server |
| `npm run mock` | Run only JSON Server on port 3000 |
| `npm run build` | Type-check and build for production |
| `npm run test` | Run all tests once (`npm run test:watch` to watch) |
| `npm run lint` | Run ESLint |

---

## Mock data (`db.json`)

`db.json` holds users, places, regions, saved places, trips, expenses and
expense history. A few things to know:

- **Stop JSON Server before editing `db.json` or running a script.** JSON Server
  keeps the data in memory and overwrites the file on the next write, so changes
  made while it is running are lost.
- JSON Server v1 does **not** create a collection on `POST` — every collection
  the app writes to must already exist in `db.json`.
- Data scripts live in `scripts/` (all are safe to run more than once, and most
  write a `db.before-*.json` backup first):

| Script | Purpose |
|---|---|
| `node scripts/seed-test-data.mjs` | Add test regions, places and trips covering many UI cases (`--reset` removes them) |
| `node scripts/migrate-expense-history.mjs --backfill` | Create the `expenseHistory` collection and backfill "added" rows |
| `node scripts/fix-expense-creators.mjs` | Re-attribute expenses whose creator can't see the trip to the trip owner |
| `node scripts/migrate-*.mjs` | One-off migrations of older data shapes (trips, budget, ownership) |

> This is a **mock** backend: access rules (who can see which trip, share
> links, place guards) are enforced in the client only. A real backend must
> enforce them on the server.

---

## Project structure

```text
src/
├── components/        # Shared UI (status chip, avatars, loading / error states, language switcher)
├── features/          # One folder per feature: api/ · components/ · hooks/ · utils/ · __tests__/
│   ├── auth/          # Login, register, session handling
│   ├── dashboard/     # Dashboard widgets and selectors
│   ├── places/        # Discover: search, saved places, custom places
│   ├── itinerary/     # Trip wizard, board, schedule, sharing dialog, access rules
│   ├── budget/        # Step 4 budget tree and money helpers
│   └── settlement/    # Expenses, settlement, spending stats, history
├── hooks/             # Cross-feature hooks (unsaved-changes guard)
├── i18n/              # i18next setup and ja / en / vi translations
├── layouts/           # App shell (sidebar + header)
├── pages/             # Route-level pages
├── routes/            # Router and route guards
├── store/             # Redux store and slices
├── theme/             # MUI theme and colour palette
├── types/             # Shared TypeScript types
└── utils/             # Formatting, dates, keyboard, error messages
docs/                  # Architecture, schema and per-feature specs
scripts/               # Seed and migration scripts for db.json
```

Business rules are kept in pure functions under each feature's `utils/` folder
(for example `itineraryRules.ts`, `budgetRules.ts`, `settlementRules.ts`) and
are covered by unit tests.

---

## Documentation

Start with these, then read the spec for the feature you are working on:

- [`docs/01-architecture.md`](docs/01-architecture.md) — tech stack and coding conventions
- [`docs/03-database-schema.md`](docs/03-database-schema.md) — `db.json` shape and TypeScript types
- Feature specs in [`docs/features/`](docs/features):
  [`auth`](docs/features/auth.md) ·
  [`dashboard`](docs/features/dashboard.md) ·
  [`place-search`](docs/features/place-search.md) ·
  [`trip-board`](docs/features/trip-board.md) ·
  [`trip-budget`](docs/features/trip-budget.md) ·
  [`trip-share`](docs/features/trip-share.md)

The feature specs are living documents: update the matching spec whenever you
change a rule or a data shape.
