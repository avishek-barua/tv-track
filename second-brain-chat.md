# Second brain — this chat

## Trigger
TV Time app is shutting down (service ends after July 15, 2026 — company cited it wasn't sustainable to keep running free, not enough demand for a paid tier). User loves the app and wants to rebuild it themselves with extra features, for personal use only.

## Requirements gathered
- Same experience on mobile and desktop (not native apps — a responsive web app was the practical choice)
- Personal use only, no accounts/social
- Extras wanted: AI-powered recommendations, deeper stats/analytics

## What was built
`rerun.jsx` — a single-file React app called **RERUN**, styled with a dark amber/CRT "phosphor" theme, distinct signature elements (tape-strip episode grid, channel-guide episode codes like `S03E08`).

First pass was a reasonable guess at TV Time's features. User then uploaded ~40 real TV Time screenshots, which prompted a full rebuild to match the actual UI:
- 5-tab nav: Shows, Movies, Explore, Stats, AI
- Shows Watch List grouped into Watched History / Watch Next / Haven't watched for a while / Haven't started, matching TV Time's exact grouping and row format (`S01 | E07 +6`)
- Upcoming tab grouped by Yesterday/Today/Tomorrow/date with NEW/AIRED/PREMIERE badges
- Movies tracked manually (no free movie API available) — add via title/genre/runtime/release date
- Explore tab: Discover (trending via TVmaze) + Search
- Episode detail screens with 5-star Bad/OK/Good/Great/Wow rating, 12-emoji mood picker, "where did you watch" chips — all lifted directly from the screenshots
- Expanded Stats: watch time in mo/d/h, monthly chart, biggest marathons, genre/network breakdowns, remaining episodes, catch-up rate, predicted catch-up date, achievement badges
- AI tab (the explicitly requested addition): calls Claude directly from the artifact for 5 personalized recommendations based on tracked shows + watched genres

## Data/API choices
- TVmaze API for all show/episode data (free, no key, CORS-friendly) — chosen specifically because it'll keep working after TV Time itself disappears
- No movie API integrated (would need a paid/keyed service) — movies are manual entries
- Persistence: Claude artifact's `window.storage` (personal, unshared) in the in-chat version

## Then: moving to local development
User wants to run this outside claude.ai. Delivered:
- `SETUP.md` — steps to scaffold a Vite app, swap `window.storage` → `localStorage`, and handle the AI call (needs a small backend to hold the API key; direct client-side calls with an embedded key aren't safe)
- `CLAUDE.md` — instructions file for future Claude Code sessions on this repo
- This file and `second-brain-project.md`

## Open threads / things not yet done
- No backend built yet for the AI recs feature locally — currently just documented as a to-do in SETUP.md
- No migration path written for old artifact data (`window.storage`) into the local version — user would start fresh locally

## Update — first local dev pass
User did the Vite scaffold themselves and did the `window.storage` → `localStorage` swap I outlined, but did it as a literal find-replace (`localStorage.get(...)`, `localStorage.set(...)`) — that method signature doesn't exist on `localStorage`, so persistence was silently broken. Caught and fixed while implementing new requirements (now `getItem`/`setItem`, synchronous, no try/catch needed around the call itself).

User sent a `requirements.md` with three asks, all implemented in this pass:
1. **Bottom nav on every screen** — previously hidden on show/episode/movie detail views. Now always rendered; tapping a nav item exits the detail view.
2. **Confirm dialog for skipped episodes** — marking an episode watched when earlier episodes of that show are still unwatched now pops a dialog ("Just this one" / "Mark all previous") instead of silently leaving gaps. Centralized as `requestMarkWatched` in `App`, used by the Watch List quick-check, the show detail "continue tracking" row, and the episode detail page's mark-watched button.
3. **Watch history "out of screen, scroll up to see it"** — kept History above Watch Next in the DOM order (matches the real app) but auto-scrolls the list down to Watch Next on load, so History is one scroll-up away rather than gone.

Also handled the Explore/Discover requirement (split into Shows / Movies / a new "Top recommended for you" section): recommended section ranks the trending pool by genre overlap with what the user's actually watched; Movies section is honest about not having a free catalog API and just prompts to add manually.

`App.jsx` (not `rerun.jsx`) is now the canonical file — delivered back to the user as the fixed/updated version to drop into their local project.

## Update — JSON database + movie search
User sent a follow-up `requirements.md` with two more asks:
1. **"implement json database"** — replaced `localStorage` entirely with a real (if tiny) persistence layer: `server.mjs`, a one-file Express server exposing `GET/POST /api/data`, backed by `db.json` on disk. `App.jsx` now loads on mount and POSTs the whole data blob on every change via `fetch`. Added a `dbError` state that shows a red banner in the UI if the server isn't reachable, so a save failure is visible instead of silent (this was the exact failure mode that caused the earlier `localStorage.get/.set` bug to go unnoticed).
2. **"doesn't search movie"** — Explore's Search tab only ever queried TVmaze (shows only). Since there's no free movie catalog to search externally, movie search now filters the user's own `data.movies` by title and renders as a separate "Movies" section alongside "Shows" results — consistent with how Discover already splits the two. Shows an "Add a movie" shortcut when nothing local matches the query.

Delivered `server.mjs` as a new file alongside the updated `App.jsx`. Updated `SETUP.md` to walk through running the server instead of the old localStorage-swap step.

## Update — free deployment + a live bug
User created a GitHub repo (folder structure: docs at repo root, actual app in a `rerun/` subfolder) and asked how to deploy for free. Recommended Render (backend, free web service) + Vercel (frontend, free hobby tier) — $0 for a low-traffic personal app. Two code changes were required first and got made: `server.mjs` reads `process.env.PORT` instead of hardcoding 4000, and `App.jsx` reads the API base URL from `import.meta.env.VITE_API_URL` instead of hardcoding localhost. Wrote `DEPLOY.md` with the actual dashboard steps.

First deploy attempt failed: shows didn't load. Diagnosed from a network tab screenshot — the request was hitting `https://tv-track.onrender.com/` (bare root, 404) instead of `/api/data`, meaning `VITE_API_URL` was set without the `/api/data` suffix on Vercel. Straightforward fix (add the path, redeploy — Vercel bakes env vars in at build time so saving alone doesn't apply it).

## Update — third requirements round (with screenshots)
User sent `requirements.md` plus three annotated screenshots. Two of the three were real bugs, not missing features:
1. **Sticky Watch List/Upcoming segment** — `.rr-segment` now uses `position: sticky; top: 0`, applied app-wide (also affects Discover/Search and the Stats sub-tabs) rather than just the one screen shown in the screenshot.
2. **Episode check button "not working"** — actual root cause was a `<button>` nested inside another `<button>` (the check circle lived inside the row's clickable button), which is invalid HTML that browsers mishandle. Fixed by splitting into a clickable info row + a separate real button for the check.
3. **Watch history still visible instead of scrolled past** — the fix from the previous round was implemented but had a latent bug: the `useEffect` driving the scroll was keyed on `groups.history.length`, which is populated immediately from saved `watchedLog` data, while the section it scrolls *to* (Watch Next) depends on `episodesCache`, which loads slightly later. Since `history.length` didn't change between those two renders, the effect never re-ran and the scroll silently never fired. Replaced with a ref callback (fires exactly when the target node mounts, on whatever render that turns out to be) — more robust than trying to guess the right effect dependency.

Also implemented from the same requirements file:
- Stats now has "Your shows" / "Your movies" sortable library lists (sort by watch status / name / recently added), visible even before any watch history exists.

Explicitly deferred per the user's own "for future, don't implement now" note: auto-adding a show to the watch list when one of its episodes gets marked watched. Logged in `requirements.md` under a Backlog section, not built.

Added two hard-won lessons to `CLAUDE.md`'s conventions so they don't get relearned: never nest interactive buttons, and prefer ref callbacks over effects for DOM nodes that depend on async-loaded data.
