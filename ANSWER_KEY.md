# Answer Key

## Bug 1: Network waterfall

- **File:** `src/components/CardRow.tsx`, lines 22-28
- **Mechanism:** The `load` function fetches `/api/user`, then `/api/projects`, then loops through all 8 projects calling `await fetch(/api/projects/${id}/stats)` sequentially. Each stats call takes 350 ms, so the 8 stats calls take about 2.8 s total when they could run in parallel in about 350 ms.
- **Required fact A:** The stats requests run one after another (sequential, not parallel).
- **Required fact B:** The cause is sequential awaiting (`await` inside a `for` loop), and they could run in parallel (e.g. `Promise.all`).

## Bug 2: CSS layout break

- **File:** `src/components/ProjectCard.tsx`, lines 19-23
- **Mechanism:** The card row is `display: flex` with each card set to `flex: 1`. Project 3 has a very long name with no spaces. The title div has `white-space: nowrap`, which forces it to its full intrinsic width. The card has no `min-width: 0`, so the flex item cannot shrink below its content size. At 1280x720, the row overflows horizontally.
- **Required fact A:** Names the card or title element with the long project name.
- **Required fact B:** The mechanism is a flex item that cannot shrink below its content width; fixed by adding `min-width: 0` or `overflow: hidden` or removing `white-space: nowrap`.

## Bug 3: Console error with hidden cause

- **File:** `src/api/server.ts` (response shape), `src/components/StatDisplay.tsx` (crash site)
- **Mechanism:** For project 5 only, the API returns `{ data: { revenue, users, growth, tickets } }` instead of `{ revenue, users, growth, tickets }`. The component calls `stats.growth.toFixed(1)` but `stats.growth` is undefined because the stats object is actually `{ data: {...} }`. This throws a TypeError. The ErrorBoundary catches it and shows "Something went wrong".
- **Required fact A:** Names the one request (project 5 / "Data Pipeline") whose response has a different shape (nested under `data`).
- **Required fact B:** Links that shape difference to the undefined property read (`stats.growth` is undefined because the data is nested) in the component.

## Bug 4: Re-render cascade

- **File:** `src/context/AppContext.tsx` (provider value), `src/components/ActivityTable.tsx` (consumer), `src/components/NotesBox.tsx` (trigger)
- **Mechanism:** The `AppProvider` passes `{ user, theme, draftNote, setDraftNote }` as its context value. This object is created fresh on every render. When the user types in the notes box, `setDraftNote` triggers a re-render of AppProvider, which creates a new context value object, which triggers re-renders of all consumers including the 300 `TableRow` components. `React.memo` on TableRow does not help because `memo` does not block context updates. Each row creates several `Intl.NumberFormat` objects during render, making the re-render expensive.
- **Required fact A:** All 300 table rows re-render on every keystroke in the notes box.
- **Required fact B:** The cause is the context: unrelated notes state (`draftNote`) lives in the same context as `theme`, the provider value is a new object each render, and `React.memo` does not prevent re-renders triggered by context changes.
