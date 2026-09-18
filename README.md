# Game Log — Tracker

A lightweight, installable Progressive Web App for tracking your [RetroAchievements](https://retroachievements.org) library — recent activity, in-progress games, completions by year, and playtime — with **no account, no login, and no cloud sync**. Everything stays on your device.

**Live app:** <https://gin649.github.io/Game-Log-Tracker>

## Features

- **Overview** — profile stats, recently played games with live playtime and completion %, and a feed of recent unlocks
- **Game Library** — every game you've played on RA, searchable, sortable, with progress bars, award status, and estimated/real playtime for each
- **Beaten by Year** — a yearly breakdown of everything you've completed or mastered
- **Casual / Hardcore toggle** — every stat, list, and progress bar switches between casual and hardcore-only numbers
- **Manually-tracked games** — add games that aren't on RetroAchievements (via [RAWG](https://rawg.io) for box art and details); they're tracked separately and never count toward RA-based stats
- **Optional RAWG ratings** — show a review-score badge (Metacritic where available) on each game's detail view
- **Installable PWA** — works offline once loaded, with a home-screen install prompt on supported browsers (manual "Add to Home Screen" instructions on iOS)

## How your data works

There's no backend and no account system. Everything — your RetroAchievements credentials, optional RAWG key, manually-added games, and cached playtime data — is stored locally in your browser via **IndexedDB**, using the [Persistent Storage API](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist) to ask the browser not to evict it under storage pressure.

That means:
- Your data never leaves your device unless you export it yourself.
- Switching browsers, devices, or reinstalling the app **will not** bring your data with it automatically.
- Use **Menu → Data → Export** to download a `.json` backup, and **Import** it on any other device/browser you want that data to show up on.

## Connecting your account

You'll need a RetroAchievements **Web API key**, found under your [Control Panel → Keys](https://retroachievements.org/controlpanel.php) on the RA website. Enter your username and that key when prompted — no password is ever needed, and the key is only ever sent directly to RetroAchievements' own API.

### Optional: RAWG ratings

Review-score badges and manually-tracked (non-RA) games both use the [RAWG API](https://rawg.io/apidocs). It's free — get a key from RAWG and add it under **Menu → RAWG Ratings** inside the app. Entirely optional; the app works fully without it.

## Tech

- Vanilla JS, no framework, no bundler
- IndexedDB for all local storage
- Service worker for offline caching (`sw.js`) — bump `CACHE_NAME` there when deploying changes so returning visitors pick up the new version instead of a stale cached copy
- [RetroAchievements Web API](https://api-docs.retroachievements.org/) and [RAWG API](https://rawg.io/apidocs) for data

## Privacy

No analytics, no tracking, no accounts, no server. The app talks directly to the RetroAchievements and RAWG APIs from your browser and nowhere else.

## License

MIT — see [LICENSE](LICENSE).

## Self-hosting (optional, for advanced users)

Want to run your own copy instead of using the hosted version above? No build step, no dependencies to install — it's a static `index.html`, `sw.js`, and `manifest.json`.

1. Fork or clone this repo.
2. In **Settings → Pages**, set the source to your production branch (`main` or `gh-pages`), root folder.
3. **Important:** `manifest.json`'s `start_url` and `scope`, plus the service worker's registration, are set up for a subpath deployment. If you rename the repository, update `start_url` and `scope` in `manifest.json` to match your new repo name — otherwise the app won't be installable.
4. Push, wait for the Pages build to finish, and your app will be live at `https://<username>.github.io/<repo-name>/`.
