# FEATURES & SPRINT SPECIFICATIONS

## Sprint 1: Infrastructure & Core UI (Current Focus)

**1. Environment & Build Tooling (Infrastructure)**
* Set up the project with Vite (React + TypeScript).
* Integrate Tailwind CSS for layout/spacing and Material UI (MUI) for complex UI components.
* Configure `package.json` with an `npm-run-all` script to run the Vite server (FE) and `json-server` (Mock DB) together with a single command.

**2. Mock Login & Authentication Flow**
* **UI:** Build the Login page (`/login`) using MUI components such as `<TextField>` and `<Button>`.
* **Logic:** When the user submits the form, skip calling a real API. Instead, automatically generate a fake token string.
* **Storage:** Store this fake token in the browser via `localStorage`.

**3. Protected Route & Layout**
* **Logic:** Build a `<ProtectedRoute>` component. This component checks `localStorage`; if there is no token, it forces a redirect to `/login`.
* **UI:** If a token is present, allow access to `/` (Dashboard). The Dashboard has a basic layout with a Sidebar (collapsible) and a Header. The Header shows a "Logout" button (clears the token and pushes to `/login`).

---

## Sprint 2: Data Visualization & Custom Hooks

**1. Discovery Search**
* **UI:** A search bar placed in the Header or on the Trip page.
* **Logic:** Apply a custom `useDebounce` hook with a 500ms delay. Only call the search API after the user has stopped typing for 500ms, to optimize performance.
* **API:** Call `fetch` or `axios` against JSON Server to retrieve the list of places.

**2. Rich Media Cards**
* **UI:** Render search results as cards. Each card shows: cover image, place name, reference price, and rating.
* **Logic:** This card must be designed as a Presentational Component, receiving data via props so it can later be reused in the drag-and-drop board.

**3. File Upload & Local Preview**
* **UI:** A Modal (using MUI Modal) that lets the user attach an image (e.g. a restaurant menu, a receipt) to a specific place.
* **Logic:** Use the browser's `URL.createObjectURL(file)` API to show an immediate preview (Local Preview) without waiting for the upload to the server.

---

## Sprint 3: Drag-and-Drop Board & Global State Management

**1. Timeline Kanban Board**
* **UI:** Split the screen into multiple columns using Tailwind Flex/Grid. The leftmost column is the "Wishlist". The following columns are Day 1, Day 2, Day 3 of the trip, in order.
* **Logic:** Integrate the `dnd-kit` library (Drag and Drop). Let the user pick up a Rich Card from the Wishlist and drop it onto any Day, or drag it from one Day to another.

**2. Global State Management**
* **Logic:** Every drag-and-drop action does not call the API immediately; instead it updates the Redux Store (Redux Toolkit) so the UI responds instantly (Optimistic UI).
* **State Structure:** Store the overall state of a "Trip", including the list of days and their corresponding "activities" arrays.

**3. Time Conflict Warning**
* **Logic:** Write a time-calculation function using the `date-fns` or `dayjs` library. When a card is dropped into a column, check whether its `startTime` and `endTime` overlap with an activity already present on that day.
* **UI:** If there is a conflict, display a red border (or a warning icon) directly on that Rich Card.

---

## Sprint 4: Complex Forms, Budgeting & Sharing

**1. Split Bill Modal**
* **UI:** Clicking a card on the timeline board opens a detailed form.
* **Logic:** Use `react-hook-form` combined with `zod` to validate the data.
* **Dynamic Fields:** The form lets the user click "Add person" to create dynamic inputs, specifying "who paid" and "who this amount is split evenly among".

**2. Budgeting**
* **Logic:** Use Redux Selectors to scan the entire Trip dataset and automatically compute the trip's total cost and how much each person owes each other.
* **UI:** Update this total-cost figure directly in the Header (real-time feedback every time a split-bill form is saved).

**3. Read-Only Share**
* **Logic:** Create a new React Router route with the pattern `/trip/share/:id`.
* **UI:** This route reuses the Dashboard's UI, but applies logic to hide all Edit buttons and disable Drag & Drop. Optimize the UI so the link recipient can only view or print.
