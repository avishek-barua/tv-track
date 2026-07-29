# Deploying RERUN for free

Two pieces to deploy separately: the frontend (static React build) and the backend (`server.mjs`, which needs to keep running to serve `/api/data`).

## Before you deploy — two code changes (already applied)
- `App.jsx` now reads the API URL from `VITE_API_URL` at build time (falls back to localhost for local dev).
- `server.mjs` now reads the port from `process.env.PORT` (free hosts assign their own port, not 4000).

Also add `db.json` to `.gitignore` if it isn't already — it's your personal data, no reason to commit it.

## 1. Backend → Render (free tier)
1. Push your repo to GitHub (sounds like this is already done).
2. On [render.com](https://render.com): **New → Web Service** → connect your repo.
3. Set **Root Directory** to `rerun` (the folder with `package.json` and `server.mjs`).
4. Build command: `npm install`
5. Start command: `node server.mjs`
6. Instance type: **Free**
7. Deploy. You'll get a URL like `https://rerun-xxxx.onrender.com`.

**Free-tier caveat:**
- The service sleeps after 15 minutes of no traffic — first request after that takes ~30–50s to wake up. That's just slow, not data loss.

**Important — persistence:** Render's free tier has an *ephemeral* filesystem. Every time the service wakes back up from sleep, it can be a fresh container, and `db.json` gets wiped. Fix this with a real free Postgres database before you rely on the deployed app (see below) — `server.mjs` already supports it, you just need one environment variable.

## 1b. Persistent storage → Neon Postgres (free, no card, auto-resumes)
1. Sign up free at [neon.tech](https://neon.tech).
2. Create a project — a database is created automatically, free tier.
3. On the project dashboard, copy the **connection string** (starts with `postgres://...`, includes `?sslmode=require`).
4. Add `pg` to your dependencies before pushing: `npm install pg`
5. On Render → your web service → **Environment** tab → add:
   - `DATABASE_URL` = (the connection string from step 3)
6. Render redeploys automatically. `server.mjs` detects `DATABASE_URL`, creates a small table on first boot, and stores everything there instead of the local file. Check the deploy logs for `(Postgres)` in the startup line to confirm.

Locally, leave `DATABASE_URL` unset — `server.mjs` falls back to `db.json` on disk automatically, so nothing changes about local dev.

Why Neon specifically: its free tier suspends the underlying compute when idle (to stay free) but **auto-resumes on the very next query**, with no manual dashboard action — unlike Supabase's free tier, which fully pauses a project after a week of inactivity and needs you to click "restore" in the dashboard before it'll respond again. For a personal app that might sit untouched for a while, that difference matters.

## 2. Frontend → Vercel (free tier)
1. On [vercel.com](https://vercel.com): **Add New → Project** → import the same repo.
2. Root directory: `rerun`
3. Framework preset: Vite (build command `npm run build`, output `dist` — Vercel usually detects this automatically)
4. Add an environment variable:
   - `VITE_API_URL` = `https://rerun-xxxx.onrender.com/api/data` (your Render URL from step 1, with `/api/data` on the end)
5. Deploy. You'll get a URL like `https://rerun-yourname.vercel.app` — that's your app, usable from any device.

## AI recs tab
Still needs its own solution (see `SETUP.md`) — nothing here changes that.

## Cost
Render's free web service tier, Vercel's free hobby tier, and Neon's free Postgres tier are all $0 for this kind of low-traffic personal app.
