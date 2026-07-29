# Running RERUN locally

`App.jsx` is the current file (the old artifact-only `rerun.jsx` is no longer used). It talks to two things outside the browser:

1. A local JSON-db server (`server.mjs`) for persistence, instead of `localStorage`.
2. Anthropic's API for the AI recs tab — needs your own key, see step 4.

## 1. Scaffold a Vite React app
```bash
npm create vite@latest rerun -- --template react
cd rerun
npm install lucide-react recharts express cors pg
```

## 2. Drop in the files
- `App.jsx` → `src/App.jsx`
- `server.mjs` → project root

## 3. Run the JSON database server
```bash
node server.mjs
```
Leave this running in its own terminal — it serves `http://localhost:4000/api/data` and writes to `db.json` in the folder you ran it from. `App.jsx` already points at that URL. If the app shows a red banner saying it can't reach the DB, this isn't running.

## 4. Handle the AI recs call
Don't call Anthropic directly from the browser with an embedded key. Options, easiest first:
- **Skip it for now** — everything else works without it.
- **Add a route to `server.mjs`** — hold your `ANTHROPIC_API_KEY` there and forward the prompt, then point the fetch at `/api/recommend` instead of `api.anthropic.com`.

## 5. Run it
```bash
npm run dev
```
Open the printed localhost URL. Make sure `server.mjs` is already running.

## Known gaps
- No cross-device sync — `db.json` lives on this machine only.
- Movie data is manual-entry only (no free movie catalog API without a key).
