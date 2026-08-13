# ARCHITECTURE & CODING CONVENTIONS
**Project:** WanderPlan (Travel MVP)

## 1. Tech Stack
- **Core:** React 18, Vite, TypeScript.
- **Node Environment:** v20.x (managed via NVM).
- **Styling:** Tailwind CSS + Material UI (MUI).
- **State Management:** Redux Toolkit (`store/slices/authSlice.ts`, `store/slices/uiSlice.ts`).
- **Routing:** React Router v6 (`ProtectedRoute` / `PublicRoute` guards).
- **Forms & Validation:** React Hook Form + Zod.
- **i18n:** `react-i18next` + `i18next-browser-languagedetector` — 3 locales (`en`, `ja`, `vi`), see `src/i18n/`.
- **Mock Backend:** JSON Server (`db.json`), consumed only through `fetch` — no axios.
- **Password Hashing (mock only):** `bcryptjs` — hashes/compares passwords client-side against `db.json` since JSON Server has no server logic. This is **not** real backend security; it exists to keep the right habits (never store/compare plaintext) ahead of a real backend. See `docs/features/auth.md`.
- **Testing:** Vitest + `@testing-library/react` + `jsdom`. Run with `npm run test` (single run) or `npm run test:watch`.
- **Utilities:** dnd-kit (Drag & Drop) and date-fns (date handling) are locked-in choices for the Sprint 3/4 timeline-board work — see `docs/02-features-by-sprint.md` — not yet installed as of this writing.

## 2. Enterprise Standards (G2-High Requirements)
AI Assistant must strictly follow these rules when generating code:
- **TypeScript Strictness:**
  - NEVER use `any`. Use `unknown` and implement proper Type Guards before manipulating data.
  - Use **Tagged Unions** for heterogeneous data arrays (e.g., Timeline items can be `flight`, `hotel`, or `activity`).
- **Styling Separation of Concerns:**
  - **Tailwind CSS:** Use exclusively for Layouts (Flexbox, Grid), Spacing (Margin, Padding), Typography, and Responsive design.
  - **Material UI (MUI):** Use exclusively for complex, interactive, and accessible components (TextFields, Modals, DatePickers, Buttons). DO NOT write custom CSS to override MUI unless absolutely necessary; use MUI's `sx` prop or ThemeProvider.
- **Component Architecture:**
  - Strictly separate **Container Components** (Data fetching, Redux state, logic) from **Presentational Components** (UI rendering, pure functions).
- **Package Management:**
  - Keep `dependencies` (production packages) and `devDependencies` (build tools, formatters, JSON server, test tooling) strictly separated in `package.json`.
- **Environment Configuration:**
  - Never hardcode API base URLs. Read from `import.meta.env.VITE_*` (typed in `src/vite-env.d.ts`) with a sane dev fallback. Commit a `.env.example`; never commit the real `.env`.
- **State Ownership:**
  - Feature state that the UI needs to react to (e.g. the logged-in user) belongs in Redux, not read ad-hoc from `localStorage`/`sessionStorage` on every render. Storage is for persistence across reloads; Redux is the source of truth components subscribe to.

## 3. Directory Structure (Feature-Based)
```text
src/
├── assets/         # Static files (images, icons)
├── components/     # Global shared presentational components (LanguageSwitcher, illustrations)
├── features/       # Feature-based modules
│   ├── auth/
│   │   ├── api/         # authApi (mockLogin/mockRegister), token/session storage, authStorage
│   │   ├── hooks/        # useAuth — the single entry point pages/components use
│   │   └── components/   # AuthLayout, AuthHeader (shared Login/Register UI)
│   └── dashboard/
│       ├── components/   # TripCard, TripGrid, BoardingPassHero, StatFlapBoard, ...
│       ├── data/          # mockTrips
│       ├── selectors.ts
│       └── types.ts
├── i18n/           # i18next setup + locales/{en,ja,vi}.json
├── layouts/        # Layout wrappers (DashboardLayout)
├── pages/          # Route-level container components (Welcome, Login, Register, Dashboard)
├── routes/         # AppRoutes, ProtectedRoute, PublicRoute
├── store/          # Redux store setup + slices (authSlice, uiSlice)
├── theme/          # MUI theme + shared palette
├── types/          # Global TypeScript interfaces (User, Place, Trip, Activity, ...)
└── utils/          # Helper functions (formatters, type guards)
```

New feature modules should follow the same `api/ hooks/ components/` split used by `features/auth/`.

## 4. Feature Documentation
Each feature gets a living doc under `docs/features/<feature>.md`, describing the
**current implementation** (file map, data flow, state shape, known gaps) — as
opposed to `docs/02-features-by-sprint.md`, which is the original forward-looking
sprint plan and is not updated as code changes. `docs/features/auth.md` is the
first example; follow its structure for new features (e.g. `dashboard.md`,
`trip-board.md` once those land).
