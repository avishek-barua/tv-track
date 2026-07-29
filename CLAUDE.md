# CLAUDE.md — instructions for working on RERUN

## What this is
A personal TV/movie tracker cloning TV Time (shutting down July 15, 2026), for single-user local use. No accounts, no social features. Now has a minimal backend (`server.mjs`) solely for JSON-file persistence — still not multi-user, just local disk instead of browser storage.

## Status
Running locally now (Vite + React), not in claude.ai anymore. `App.jsx` is the single source of truth going forward — `rerun.jsx` was the original Claude-artifact version and is no longer maintained.

## Stack
- React (single component, `App.jsx`)
- lucide-react (icons), recharts (charts)
- TVmaze API (`https://api.tvmaze.com`) for show/episode data — free, no key
- No movie API key available — movies are manually entered by the user; movie "search" matches against the user's own added titles, not an external catalog
- Persistence: `server.mjs`. Locally, a tiny Express server serving `GET/POST http://localhost:4000/api/data` (port from `process.env.PORT` when deployed), backed by `db.json` on disk. In production, it automatically switches to Postgres (a single `rerun_data` table holding one JSONB row) whenever `DATABASE_URL` is present — required because Render's free tier has an ephemeral filesystem that wipes `db.json` on every idle-restart. Using Neon for the free Postgres host (auto-resumes on the next query when idle, unlike Supabase's free tier which fully pauses after a week and needs manual restore). Don't remove the local-file fallback; it's what keeps local dev signup-free. The frontend's API base URL is `import.meta.env.VITE_API_URL`, falling back to localhost — set this env var when deploying. Shows a red banner (`dbError` state) if the server is unreachable rather than failing silently.

## Data model
```
{
  shows: { [tvmazeId]: { id, name, image, genres, status, premiered, network, addedAt } },
  watchedLog: { [episodeId]: { watchedAt, showId, showName, season, number, runtime, genres, rating, mood, whereWatched } },
  movies: { [uuid]: { id, title, genres, runtime, releaseDate, addedAt, watchedAt, favorite, rating, mood, whereWatched } }
}
```
Everything derives from these three objects — no separate "watchlist" flag; a show's status (watch next / stale / not started) is computed live from `watchedLog` + episode air dates.

## Conventions
- Keep the data model a single JSON blob (`{shows, watchedLog, movies}`) written whole on every change — don't split `db.json`/the Redis value into multiple keys or add partial-update endpoints unless there's a real performance reason to.
- `server.mjs`'s storage backend auto-selects: Postgres if `DATABASE_URL` is present, else local `db.json`. Keep both paths working — don't hardcode one and drop the other; local dev depends on the file fallback staying signup-free, and production depends on Postgres being used whenever it's configured (Render's free tier wipes the local file on every idle-restart).
- Don't add login/auth/multi-user to `server.mjs` — it's a local single-user convenience layer, not a real backend. Don't add it to the frontend either.
- Bottom nav renders on every screen, including detail views (shows/episodes/movies). Tapping a nav item always clears the current detail view and jumps to that section.
- Marking an episode watched goes through `requestMarkWatched` (in `App`), not the raw `toggleEpisodeWatched`, wherever it's a user-initiated "mark this one" action. It checks for earlier unwatched episodes of the same show and, if any exist, opens a confirm dialog ("Just this one" vs "Mark all previous") before writing to `watchedLog`. Only bypass this wrapper for: unmarking (toggling off), season-level "Mark all" (already an explicit bulk action), and rating/mood/where-watched patches on an already-watched episode.
- Shows' Watch List keeps "Watched history" above "Watch next" in the DOM (matches the original), but auto-scrolls past it on first load so "Watch next" appears at the top — history is reached by scrolling up, not by being hidden entirely.
- Explore's Discover splits into three sections: a personalized "Top recommended for you" (genre-overlap ranked against watch history), "Shows" (general trending/top-rated from TVmaze), and "Movies" (a manual-add prompt, since there's no free movie catalog — don't fabricate movie trending data).
- Explore's Search mirrors that split: Shows queries TVmaze live; Movies filters the user's own `data.movies` by title, since there's nothing external to query — don't wire it to a fake or paid API without asking first.
- Don't call the Anthropic API directly from client JS with an embedded key. If the AI recs feature needs to work outside Claude's artifact sandbox, add the route to `server.mjs` rather than a separate service.
- `.rr-root` and `.rr-frame` must stay capped at `height: 100vh` / `100dvh` (not `min-height`), and `.rr-frame` must keep `overflow: hidden`. This is what forces `.rr-content` to be the actual internal scroll container — without it, `overflow-y:auto` on `.rr-content` is inert (the box just grows to fit content instead of clipping it), which silently breaks two things at once: `position: sticky` elements inside it (they need a real scrolling ancestor with an actual scroll offset to react to, not just the CSS property declared) and `scrollIntoView()` calls on descendants. This exact bug shipped once already — don't relax these back to `min-height` for a "let it grow naturally" reason without re-testing sticky and the watch-history auto-scroll.
- Never nest an interactive `<button>` inside another `<button>` — it's invalid HTML and browsers silently break click handling on the inner one. This already caused one real bug (the episode row check circle). When a row needs both "open detail" and "quick action" behavior, split it into a sibling clickable area + a separate button, not a nested one.
- When scrolling to or measuring a DOM node that depends on async data (e.g. `episodesCache` loading after mount), prefer a ref callback over a `useEffect` keyed on unrelated state — an effect can miss the render where the node first appears if its dependency array doesn't happen to change on that exact render. This already caused one real bug (watch-history auto-scroll silently never firing).
- Segmented controls (`.rr-segment`) are sticky (`position: sticky; top: 0`) across the app — keep that consistent rather than making some screens sticky and others not.
- Stats' "Your shows" / "Your movies" library lists should render as soon as there's anything added, independent of whether there's watch history yet — don't gate them behind the same empty-state as the deeper stats blocks.
- Match TV Time's actual UI patterns where they exist (see `second-brain-project.md` for the reference details) rather than inventing new ones — the point of this project is fidelity to the original, plus the two explicitly-requested extras: AI recommendations and a deeper stats page.
- Prefer editing the existing single-file component over fragmenting into many files unless the user asks for a refactor.

## Do not
- Add ads, telemetry, or analytics.
- Add social/sharing features (comments, followers, groups) — deliberately dropped from the TV Time feature set for this personal clone.
