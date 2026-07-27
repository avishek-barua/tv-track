## full app
- [x] fixed bottom navigation on every screen — nav now renders always; tapping a nav item from inside a detail screen backs out to that section
- [x] (found while implementing) local persistence was broken — the local build called `localStorage.get/set(...)`, which doesn't exist; fixed to `localStorage.getItem/setItem`
- [x] implement json database — replaced `localStorage` with `server.mjs`, a tiny Express server that reads/writes `db.json` on disk. `App.jsx` now loads/saves via `http://localhost:4000/api/data`. Shows a red banner if the server isn't running instead of silently failing to save.

## shows
- [x] when marking the latest episode watched, if earlier episodes aren't marked, show a dialog offering to mark those too ("Just this one" / "Mark all previous")
- [x] watch history sits above "Watch next" in the list, out of view by default — the screen scrolls down past it on load, so you scroll up to see it, matching the original
- [ ] when a episode of a show is marked as watched, add it in watch list.
- [ ] make watch history in shows tab outside view point. to see it we have to scroll up.

## Explore
### discover
- [x] movies and shows now have separate sections
- [x] "Top recommended for you" section — ranks shows by overlap with the genres you've actually watched (needs some watch history to populate; shows a placeholder until then)
- [ ] movies section is currently a manual-add prompt only, since there's no free movie catalog API — real movie discovery is a future item, not done here
### search
- [x] doesn't search movie — search now shows a separate "Movies" section matching against titles you've already added yourself (there's no searchable movie catalog, so this searches your own list, not the internet); offers an "Add a movie" shortcut when nothing matches
