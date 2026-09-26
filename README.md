# Game Log — Tracker v2.0.3  Latest Updates Deployed

A lightweight, installable Progressive Web App for tracking your [RetroAchievements](https://retroachievements.org) library — recent activity, in-progress games, completions by year, and playtime — with **no account, no login, and no cloud sync**. You can also log games that aren't on RetroAchievements or that you haven't played yet, including modern titles, right alongside your RA library. Everything stays on your device.

**Live app:** <https://gin649.github.io/Game-Log-Tracker>

Link to my Discord to Discuss: <https://discord.gg/mQq8hAewe>

See [CHANGELOG.md](CHANGELOG.md) for the full additions, fixes and changes.

## Features

- **Overview** — profile stats, recently played games with live playtime and completion %, and a feed of recent unlocks
- **Game Library** — every game you've played on RA, searchable, sortable, with progress bars, award status, and estimated/real playtime for each
- **Beaten by Year** — a yearly breakdown of everything you've completed or mastered
- **Casual / Hardcore toggle** — every stat, list, and progress bar switches between casual and hardcore-only numbers
- **Manually-tracked games** — add any game you haven't played yet, or that isn't on RetroAchievements (including modern titles), via [RAWG](https://rawg.io) for box art and details. If it's on, or later gets added to, RetroAchievements, your manual entry merges with its RA data the first time you play it — so tracking just continues, with nothing to redo
- **Optional RAWG ratings** — show a review-score badge (Metacritic where available) on each game's detail view
- **ROM Hack Patching** — load a ROM you own and search [RetroAchievements' RAPatches repository](https://github.com/RetroAchievements/RAPatches) for hacks and translations for that exact game, verified against your ROM's checksum where the patch format supports it. Results are searchable by name, sorted alphabetically, and scroll rather than cut off. On browsers that support it, saving a patched ROM opens a save dialog defaulting to the same folder as the ROM you loaded
- **Game Guides** — pull in GameFAQs text guides for a game (via an archive.org mirror) right inside the app, with in-guide search, bookmarks, an adjustable reading font size, and your reading position saved automatically. Don't like the default guide? Copy and paste in any guide you find on GameFAQs yourself — pasted guides get the exact same reader features
- **Adjustable app text size** — scale all of the app's text from 80%–160% from the hamburger menu, independent of box art, which stays at its normal size
- **Installable PWA** — works offline once loaded, with a home-screen install prompt on supported browsers (manual "Add to Home Screen" instructions on iOS)

## How your data works

There's no backend and no account system. Everything — your RetroAchievements credentials, optional RAWG key, manually-added games, saved ROMs, guides, and cached playtime data — is stored locally in your browser via **IndexedDB**, using the [Persistent Storage API](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist) to ask the browser not to evict it under storage pressure.

That means:

- Your data never leaves your device unless you export it yourself.
- Switching browsers, devices, or reinstalling the app **will not** bring your data with it automatically.
- Use **Menu → Data → Export** to download a `.json` backup. Since your data only lives on this device, that export file doubles as your safety net — keep a copy somewhere safe in case anything happens to your device — and it's also how you move everything to a new device or browser: just **Import** it there and you're back up and running.

## Connecting your account

You'll need a RetroAchievements **Web API key**, found under your [Control Panel → Keys](https://retroachievements.org/controlpanel.php) on the RA website. Enter your username and that key when prompted — no password is ever needed, and the key is only ever sent directly to RetroAchievements' own API.

### RAWG (ratings + manually-tracked games)

Review-score badges and manually-tracked (non-RA) games both use the [RAWG API](https://rawg.io/apidocs). It's free — get a key from RAWG and add it under **Menu → RAWG Ratings** inside the app. You only need it if you want either of those two things; if you're only using the RetroAchievements side of the app, you can skip it entirely.

## Project structure

The app is a static site — no build step, no dependencies to install. Everything just needs to be served as-is:

| File | What it does |
| --- | --- |
| `index.html` | Page markup only — links out to the CSS/JS files below |
| `style.css` | All styling |
| `bootstrap.js` | Runs first: service worker registration, fullscreen handling |
| `app.js` | Local storage, RetroAchievements API calls, dashboard/library/year views, add game, settings, hamburger menu, app startup |
| `rom-patcher.js` | ROM Hack Patching feature — the patch engine and its UI panel |
| `guides.js` | Game Guides feature — the GameFAQs lookup and reader UI |
| `sw.js` | Service worker — caches the files above for offline use |
| `manifest.json` | PWA install metadata (icons, name, start URL) |


## Tech

- Vanilla JS, no framework, no bundler
- IndexedDB for all local storage
- Service worker for offline caching (`sw.js`)
- [RetroAchievements Web API](https://api-docs.retroachievements.org/) and [RAWG API](https://rawg.io/apidocs) for data
- [RAPatches repository](https://github.com/RetroAchievements/RAPatches) for ROM hack patches, and an archive.org mirror of GameFAQs for text guides

## Privacy

No analytics, no tracking, no accounts, no server. The app talks directly to the RetroAchievements, RAWG, and archive.org APIs from your browser and nowhere else.

## License

MIT — see [LICENSE](LICENSE).

## Self-hosting (optional, for advanced users)

Want to run your own copy instead of using the hosted version above? No build step, no dependencies to install — it's a handful of static files (see [Project structure](#project-structure) above).

1. Fork or clone this repo.
2. In **Settings → Pages**, set the source to your production branch (`main` or `gh-pages`), root folder.
3. **Important:** `manifest.json`'s `start_url` and `scope`, plus the service worker's registration, are set up for a subpath deployment. If you rename the repository, update `start_url` and `scope` in `manifest.json` to match your new repo name — otherwise the app won't be installable.
4. Push, wait for the Pages build to finish, and your app will be live at `https://<username>.github.io/<repo-name>/`.
