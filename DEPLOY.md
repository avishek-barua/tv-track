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

**Free-tier caveats:**
- The service sleeps after 15 minutes of no traffic — first request after that takes ~30–50s to wake up.
- The disk `db.json` lives on is not guaranteed to survive every redeploy. Fine for a personal hobby project; don't treat it as a real backup. If that ever matters, swap the file-based store for a free hosted KV/DB (e.g. Upstash Redis's free tier) later — not needed to get started.

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
Both Render's free web service tier and Vercel's free hobby tier are $0 for this kind of low-traffic personal app.
