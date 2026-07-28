## full app
- [x] watchlist and upcoming tab should be sticky — the segmented control (Watch List/Upcoming, Discover/Search, Shows/Movies in Stats) now stays pinned to the top of the screen while the list scrolls underneath it

## shows
- [x] check button inside show is not working, should mark as watched when checked — root cause: the check circle was a `<span>` nested inside the row's `<button>`, which is invalid HTML (button-in-button); browsers silently break click handling on that. Split into a clickable row (opens episode detail) and a separate real `<button>` for the check, which now marks watched directly.
- [x] watch history should be outside the viewport, scroll up to see it — this was supposed to already work but had a real bug: the scroll only ran in a `useEffect` keyed on `history.length`, which is available immediately from saved data, while the "Watch Next" section it scrolls to depends on episode data that loads a moment later — so the effect fired once, found nothing to scroll to yet, and never ran again. Replaced with a ref callback that fires exactly when the Watch Next section actually appears in the DOM, whichever render that happens on.

## Explore
### discover
- [ ] movies section is currently a manual-add prompt only, since there's no free movie catalog API — real movie discovery is a future item, not done here
### search
(no open items right now)

## stats
- [x] full sortable list of every added show/movie — new "Your shows" / "Your movies" blocks at the bottom of each Stats tab, with a sort dropdown (watch status / name / recently added). Shows list even before any watch history exists, so it's useful as a plain library view too.

## Backlog — explicitly deferred, do not implement yet
- When an episode of a show is marked watched, add the show to the watch list automatically (if not already there).
