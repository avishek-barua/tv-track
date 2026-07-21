# Running RERUN locally

The file `rerun.jsx` was built for Claude's in-chat artifact environment. Two things won't work as-is outside it:

1. `window.storage` (persistence) — Claude-artifact-only API.
2. The AI recs `fetch("https://api.anthropic.com/...")` call — no API key attached locally, and calling Anthropic directly from browser JS exposes your key.

Everything else (TVmaze fetches, UI, state) is plain React and works anywhere.

## 1. Scaffold a Vite React app
```bash
npm create vite@latest rerun -- --template react
cd rerun
npm install lucide-react recharts
```

## 2. Drop in the component
Copy `rerun.jsx` into `src/App.jsx`. In `src/main.jsx`, render `<App />` as usual (Vite's default template already does this).

## 3. Swap storage for localStorage
Replace the two `window.storage` calls:
```js
// load
const raw = localStorage.getItem(STORAGE_KEY);
if (raw) setData(JSON.parse(raw));

// save
localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
```
Remove the `try/catch` around `window.storage` — plain `localStorage` calls don't need it.

## 4. Handle the AI recs call
Don't call Anthropic directly from the browser. Options, easiest first:
- **Skip it for now** — everything else works without it.
- **Add a tiny backend** — a one-route Express/Next API that holds your `ANTHROPIC_API_KEY` server-side and forwards the prompt. Point the fetch at `/api/recommend` instead of `api.anthropic.com`.

## 5. Run it
```bash
npm run dev
```
Open the printed localhost URL.

## Known gaps vs. hosted version
- No built-in backend, so no cross-device sync — it's just this browser's localStorage.
- Movie data is manual-entry only (no free movie API without a key).
