# Changelog

All notable changes to Game Log — Tracker are documented here. Newest first.

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
