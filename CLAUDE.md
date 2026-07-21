# CLAUDE.md — instructions for working on RERUN

## What this is
A personal TV/movie tracker cloning TV Time (shutting down July 15, 2026), for single-user local use. No accounts, no backend, no social features.

## Stack
- React (single component currently, `App.jsx` / `rerun.jsx`)
- lucide-react (icons), recharts (charts)
- TVmaze API (`https://api.tvmaze.com`) for show/episode data — free, no key
- No movie API key available — movies are manually entered by the user
- Persistence: `localStorage` (was `window.storage` in the Claude-artifact version)

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
- Keep it a single storage key, single JSON blob — don't split into multiple localStorage keys.
- Don't add login/auth/multi-user — explicitly out of scope.
- Don't call the Anthropic API directly from client JS with an embedded key. Route through a minimal backend if the AI recs feature needs to work outside Claude's artifact sandbox.
- Match TV Time's actual UI patterns where they exist (see `second-brain-project.md` for the reference details) rather than inventing new ones — the point of this project is fidelity to the original, plus the two explicitly-requested extras: AI recommendations and a deeper stats page.
- Prefer editing the existing single-file component over fragmenting into many files unless the user asks for a refactor.

## Do not
- Add ads, telemetry, or analytics.
- Add social/sharing features (comments, followers, groups) — deliberately dropped from the TV Time feature set for this personal clone.
