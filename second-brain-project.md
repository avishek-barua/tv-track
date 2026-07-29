# Second brain — RERUN (the project)

## Concept
A personal clone of TV Time (a show/movie tracking app shutting down), built to run locally, single user, no accounts. Core loop: track shows, mark episodes watched, see what's next, get stats, get AI recommendations.

## Reference: how the real TV Time app works (from user's screenshots)
- **Nav**: 3 tabs — Shows, Movies, Explore. (RERUN adds Stats and AI as 2 more.)
- **Watch List** (per Shows/Movies) has status-grouped sections, in this order when scrolled from top:
  - Watched History (most recent watched episodes, reverse chronological)
  - Watch Next (shows with an unwatched aired episode, recently active)
  - Haven't watched for a while (same but stale — no activity in a while)
  - Haven't started (added but never watched)
- **Row format**: poster thumbnail · show name pill (tappable) · `S01 | E07 +6` (season|episode, +N more unwatched) · episode title · checkmark circle (white outline = to-watch, filled = watched)
- **Upcoming tab**: episodes grouped by Yesterday / Today / Tomorrow / then absolute dates, with badges: NEW, AIRED, LATEST, PREMIERE
- **Explore**: Feed / Discover / Groups / Activity sub-tabs. Discover has "Top shows for you" and "Trending shows/movies" horizontal poster rows with a "+" quick-add overlay, plus a "Browse all shows" CTA.
- **Show detail**: banner image, thin yellow progress bar under it (% watched), About/Episodes tabs.
  - About: where-to-watch, cast row, "people also watched," community rating line graph, comments
  - Episodes: "Continue tracking" horizontal strip of next few unwatched, then all-episodes grouped by collapsible season
- **Episode detail** (tap an episode): image, code+title, air date, watched toggle, "where did you watch" (network/theater/other/unofficial icons), 5-star rating (Bad/OK/Good/Great/Wow), then a 12-emoji "how did you feel" mood grid (Shocked, Frustrated, Sad, Reflective, Touched, Amused, Scared, Bored, Understood, Thrilled, Confused, Tense), "who was your favorite" cast picker, comments.
- **Movie detail**: same pattern plus a favorite heart.
- **Lists**: custom user-created collections (not yet built in RERUN — noted as a possible future addition).
- **Stats** (very deep in the real app): time spent watching formatted as months/days/hours, weekly/monthly bar chart toggle, total episodes watched, biggest marathons table, added-shows count, top genres table, top networks table, voted ratings, character votes, comments stats, remaining episodes, upcoming-episodes chart, catch-up rate (episodes/week), time-to-watch (hours), predicted catch-up date, and several badge categories (app badges, watch badges per-show, ratings badges, comment badges, follow badges).

## RERUN's scope vs. the reference
Built: Shows/Movies/Explore/Stats/AI nav, Watch List grouping, Upcoming grouping with badges, episode & movie detail with rating/mood/where-watched, Discover grid, expanded stats (time watched, monthly chart, marathons, genres, networks, remaining episodes, catch-up rate + predicted date, 4 achievement badges).

Deliberately dropped (social/multi-user features from the original, not relevant to a personal single-user tool): Feed, Groups, Activity, following/followers, comments, community ratings, "people also watched," custom Lists.

Added beyond the original (the two features the user explicitly asked for): AI-powered recommendations tab (calls Claude with tracked shows + watched genres), and the badges/achievements system in Stats.

## Data sources
- Shows/episodes: TVmaze API — free, no key, will outlive TV Time itself
- Movies: no free API with adequate data available without a key → manual entry only; "search" for movies searches the user's own added titles, not an external catalog
- AI recs: direct call to Anthropic's API (works in Claude's artifact sandbox; needs a route on `server.mjs` to run safely outside it — see SETUP.md)
- Persistence: `server.mjs` (Express). Local dev writes to `db.json` on disk. Production uses Postgres (via `pg`, Neon's free tier) when `DATABASE_URL` is set — required because Render's free tier filesystem doesn't survive idle-restarts, which was silently wiping `db.json` in production. Single `rerun_data` table, one JSONB row, upserted whole each save — same "one blob" model regardless of backend.

## File map
- `App.jsx` — the app (single React component), now the canonical/maintained file, running locally via Vite. Actual repo layout: a `rerun/` subfolder holds the Vite project (`package.json`, `server.mjs`, `src/`); docs sit at repo root.
- `server.mjs` — the JSON-database server (`GET/POST /api/data`, writes `db.json`)
- `rerun.jsx` — superseded; the original Claude-artifact version, kept only for history
- `SETUP.md` — how to run it locally (Vite scaffold, `server.mjs`, AI backend note)
- `DEPLOY.md` — free deployment steps (Render for `server.mjs`, Vercel for the frontend, via `VITE_API_URL` / `PORT` env vars)
- `CLAUDE.md` — conventions for future Claude Code sessions on this repo
- `requirements.md` — running checklist of user-requested behavior fixes/additions (user-authored, updated as items land)
- `second-brain-chat.md` — narrative of this build conversation
- `second-brain-project.md` — this file

## Interaction details established since first build
- **Nav persistence**: bottom nav shows on every screen, including detail views; tapping it exits whatever detail view is open.
- **Skipped-episode guard**: marking an episode watched checks for earlier unwatched episodes of the same show first and offers to mark them too, rather than letting gaps happen silently — a small usability improvement over just letting people mark anything in any order.
- **Watch history placement**: kept literally above Watch Next in the DOM (true to the original), but the screen scrolls past it on load via a ref callback (not a `useEffect` — that approach had a real bug, see below) so Watch Next is what you see first.
- **Discover structure**: three sections — Top recommended for you (genre-overlap personalization), Shows (general trending), Movies (manual-add prompt, no fake data since there's no free catalog API for movies).
- **Search structure**: mirrors Discover — Shows queries TVmaze live, Movies filters the user's own tracked list by title (with a shortcut to add a new one if nothing matches).
- **Persistence failure is visible, not silent**: a `dbError` state surfaces a red banner if `server.mjs` isn't reachable, specifically because the earlier localStorage bug failed silently and went unnoticed for a while.
- **Sticky segmented controls**: every `.rr-segment` (Watch List/Upcoming, Discover/Search, Stats' Shows/Movies) stays pinned to the top of the screen while scrolling. Depends on `.rr-content` being a genuinely bounded scroll container (see below) — an earlier version silently didn't work despite having the right CSS property, because of that.
- **Stats library lists**: "Your shows" / "Your movies" blocks list everything added, sortable by watch status / name / recently added, and show up even with zero watch history — not gated behind the deeper stats.
- **The layout shell must stay height-capped**: `.rr-root`/`.rr-frame` are `height: 100vh` / `100dvh` (not `min-height`), with `overflow: hidden` on the frame, specifically so `.rr-content`'s `overflow-y:auto` is a real internal scrollport rather than an inert declaration on a box that just grows with its content. This single thing was the actual cause behind two reported bugs at once (sticky segments doing nothing, watch-history auto-scroll doing nothing) — both "fixed" once, in the wrong layer, before the real cause was found.
- **Two real bugs found and fixed while implementing "obvious" requirements** (worth remembering as a pattern): a `<button>` nested inside another `<button>` for the episode check circle (invalid HTML, silently breaks in browsers), and a `useEffect` for the watch-history auto-scroll keyed on a dependency that didn't actually change when the target element appeared (fixed with a ref callback instead). Both are now called out explicitly in `CLAUDE.md`.

## Deployment
Free stack: Render (free web service) for `server.mjs`, Vercel (free hobby tier) for the built frontend, Neon (free Postgres) for persistence in production. Required `server.mjs` to read `process.env.PORT` and `App.jsx` to read the API base URL from `import.meta.env.VITE_API_URL` — both hardcoded to localhost before, which silently breaks once frontend and backend live on different hosts. Real deploy issues hit and fixed: `VITE_API_URL` set to the bare Render URL without the `/api/data` path; and — more significant — Render's free-tier filesystem being ephemeral, silently wiping `db.json` on every idle-restart in production (worked fine locally, only broke deployed). `server.mjs` now auto-switches to Postgres when `DATABASE_URL` is present, falling back to the local file otherwise, so local dev needs no signup. (First implemented against Upstash Redis, then swapped to Postgres/Neon per the user's preference for something more standard — same auto-detect pattern either way, just a different backend behind it.)

## Possible future additions (not requested yet, just noted)
- Custom Lists (like TV Time's user-created collections)
- An `/api/recommend` route on `server.mjs` so the AI recs feature can hold the Anthropic key server-side
- A real movie data source if a free/keyed API becomes worth adding
- Data export/import or backup rotation for `db.json`, since it's currently a single unversioned file
- **Explicitly deferred by the user ("for future, don't implement now")**: auto-adding a show to the watch list the moment one of its episodes is marked watched
