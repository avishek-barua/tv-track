## full app
- [x] fixed bottom navigation on every screen — nav now renders always; tapping a nav item from inside a detail screen backs out to that section
- [x] (found while implementing) local persistence was broken — the local build called `localStorage.get/set(...)`, which doesn't exist; fixed to `localStorage.getItem/setItem`
- [ ] implement json database
## shows
- [x] when marking the latest episode watched, if earlier episodes aren't marked, show a dialog offering to mark those too ("Just this one" / "Mark all previous")
- [x] watch history sits above "Watch next" in the list, out of view by default — the screen scrolls down past it on load, so you scroll up to see it, matching the original

## Explore
### discover
- [x] movies and shows now have separate sections
- [x] "Top recommended for you" section — ranks shows by overlap with the genres you've actually watched (needs some watch history to populate; shows a placeholder until then)
- [ ] movies section is currently a manual-add prompt only, since there's no free movie catalog API — real movie discovery is a future item, not done here
### search
- [ ] doesn't search movie
