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
