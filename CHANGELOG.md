# Changelog

All notable changes to Game Log — Tracker are documented here. Newest first. 

## v2.0.7

- New: Search YouTube walkthroughs. Every game profile now has a Search YouTube button.
- The game profile now shows the date beaten beside the Beaten badge, in the format Sep 02, 2026.
- Fixed: Some hacks listed the same patch twice, and the "Official — linked by RetroAchievements" copy failed with a NetworkError. Each patch now appears once, and official patches download correctly.
- The app now remembers the folder your ROM came from, even when the ROM is loaded from "Remember this ROM". The Save Patched ROM… dialog opens in that folder. This works in Chrome and Edge. Firefox and Safari save to their default Downloads folder.
- The What does it do? link now finds more hacks on romhack.ing. It removes "-Hack" from the name, splits run-together names into separate words (KirbysHalloweenAdventure becomes "Kirby's Halloween Adventure"), and restores the apostrophe in possessive names.

## v2.0.6
 
### Added
- New: Search YouTube walkthroughs. Every game profile now has a Search YouTube button.
- Find a walkthrough opens a YouTube search for that game's title and console, with a hint on how to copy the link, using Share → Copy link.
- Paste as many YouTube links as you like and they're saved per game, with thumbnails and titles.
- Tap a saved link to play it in the built-in player, which can be maximized to full screen.
- Saved links are included in Data backups.

## v2.0.5
 
### Added
- Missable achievements now show a gold "!" badge in a game's achievement list, matching RetroAchievements' own site, plus a "Missable Only" filter toggle to narrow the list down to just those
- Added the ability to reorder achievements in a game's profile by dragging or using the arrow buttons, with your custom order saved automatically per game and included in Data backups.

### Fixed
- App sync could feel sluggish right after this update if several backlog games turned out to already have real progress — they now move to the Library in one batched update instead of triggering a separate full re-render for each one

## v2.0.4
 
### Added and Changed
- Backlog games move to the Game Library faster: the per-game endpoint that already runs in the background for every game (including Backlog ones) now promotes a game the instant it sees real playtime or achievements, instead of waiting on RetroAchievements' slower bulk completion-progress endpoint to catch up
- Adding a non-RA game (PS3/PS4/PS5, Steam/PC, Xbox, etc.) no longer needs a typed-in console name — pick from a platform dropdown pulled straight from that game's own RAWG data instead, so the same platform is always spelled the same way across every custom game
- Add Game now supports adding several RetroAchievements games at once: check off multiple results from a search (selections persist across new searches), then add them all in one go with the **Add selected** button
- Sorting by name in Game Library and Backlog now ignores leading RA tags like ~Hack~ and ~Homebrew~ 
- Game Library's Award column is now sortable: beaten games first (alphabetical), then in-progress (alphabetical); click again to flip the order

## v2.0.3

### Added and Changed
- New **Backlog** tab for games you've added but haven't played yet, separate from the Game Library — tab order is now Overview, Game Library, Beaten by Year, Backlog
- The **+ Add game** button now lives in Backlog instead of Game Library
- RetroAchievements games move themselves from Backlog to Game Library automatically once RA shows real progress on them
- Non-RA (manually tracked) games get a **Now Playing** checkbox in their profile — checking it moves the game into the Game Library; checking **Mark as beaten** turns Now Playing on too and saves the date to Beaten by Year
- Backlog now shows **"Not on RA"** for non-RA games instead of a blank dash in the achievements column
- Non-RA game profiles now have a **Link to RetroAchievements** panel to search RA and convert the entry into a real RA-tracked game, complete with an achievement progress bar, once it turns out to be on RetroAchievements after all

## v2.0.2

### Added and Fixed
- Added GameFaqs cheat database search as a button in Game Profile
- Playtime data is more accurate
- Playtime loads the most recent games first
- Fixed bug that wasn't allowing new updates to cache
- Updates now apply automatically the next time the app is opened after being closed
- If app is left idle and there is an update, a notification dot will display on the menu bar to prompt the update
- Small style changes, added retro theme to Guides, click Aa to switch theme
- Added mouse controls to scroll consoles when using PC version of the app

## v2.0.1

### Added
- Romhack.ing link added to Rom hack menu that links out to more details about the ROMhack

## v2.0 - Big Update

### Added and Changed
- GameFaqs Guide Reader interface Added
- ROM Hacks interface Added
  - The ROM Hacks list shows **every** matching hack for the loaded game in a **scrollable** panel
- **Adjustable app-wide text size** (80%–160%, in 10% steps) under the hamburger menu, saved between visits; box art is unaffected
- **Codebase reorganized:** Same functionality, just split into focused files with section-comment headers for easier navigation

### Fixed
- The ROM Hacks list no longer shows hacks for unrelated games (e.g. Super Metroid hacks appearing while browsing Super Mario World) — unverified (IPS/zip) patches are now filtered to ones that actually share the game's title or live in a folder named after it

## v1.0 — Initial release

- Overview dashboard: profile stats, recently played games, recent unlocks
- Game Library: every RA game played, searchable/sortable, with progress and playtime
- Beaten by Year view
- Casual / Hardcore toggle across all stats
- Manually-tracked (non-RA) games via RAWG, with optional RAWG rating badges
- Installable PWA with offline support via a service worker
