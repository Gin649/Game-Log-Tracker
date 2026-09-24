# Changelog

All notable changes to Game Log — Tracker are documented here. Newest first.

## 2.0.2

## Added 
-Cheat Searching of the GameFaq database as a button in Game Profile

## v2.0.1

### Added
-Romhack.ing link added to Rom hack menu that links out to more details about the romhack

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
