## full app
- [x] watchlist and upcoming tab should be sticky — the previous CSS fix (`position:sticky` on `.rr-segment`) was correct but inert, because of a deeper bug: `.rr-root`/`.rr-frame` used `min-height:100vh` instead of `height:100vh`, so they grew with content instead of staying capped. That meant `.rr-content`'s `overflow-y:auto` never became a real internal scrollbox (nothing ever overflowed its own box — the box just grew to match), so it never got an actual scroll offset for sticky to react to. Capped `.rr-root`/`.rr-frame` to `100vh`/`100dvh` and gave `.rr-frame` `overflow:hidden`, which forces `.rr-content` to be the genuine scrolling container. Sticky segments now actually work.

## shows
- [x] watch history visible only when scrolled up — same root cause as above. The ref-callback scroll logic from the previous round was already correct; it had nothing real to scroll within, since `.rr-content` wasn't a bounded scroll container either. Fixed by the same CSS change.

## Explore
### discover
- [ ] movies section is currently a manual-add prompt only, since there's no free movie catalog API — real movie discovery is a future item, not done here
### search
(no open items right now)

## stats
(no open items right now)

## Backlog — explicitly deferred, do not implement yet
- When an episode of a show is marked watched, add the show to the watch list automatically (if not already there).
