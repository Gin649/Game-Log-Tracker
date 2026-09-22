# Changelog

All notable changes to Game Log — Tracker are documented here. Newest first.

## v2.0 — September 2026

A wholesale update, mostly centered on the ROM Hack Patching feature, plus a full reorganization of the codebase.

### Added
- **Search bar** for the ROM Hacks list — filter by any part of a hack's name, live, case-insensitive
- **Adjustable app-wide text size** (80%–160%, in 10% steps) under the hamburger menu, saved between visits; box art is unaffected
- The app icon in the header is now 25% larger
- `CHANGELOG.md` (this file) and a "Project structure" section in the README

### Changed
- The ROM Hacks list now shows **every** matching hack for the loaded game instead of a capped top-10ish slice, sorted **alphabetically**, in a **scrollable** panel instead of an unbounded one
- **Saving a patched ROM** now opens a save dialog defaulting to the same folder as the ROM you loaded, on browsers that support the File System Access API (Chrome/Edge); browsers without it fall back to the previous behavior (saves to your default Downloads folder)
- **Codebase reorganized:** the single ~5,270-line `index.html` is now `index.html` (markup only) plus `style.css`, `bootstrap.js`, `app.js`, `rom-patcher.js`, and `guides.js`. Same functionality, just split into focused files with section-comment headers for easier navigation
- `sw.js`: cache list updated for the new files, `CACHE_NAME` bumped (`v52` → `v53`)

### Fixed
- The ROM Hacks list no longer shows hacks for unrelated games (e.g. Super Metroid hacks appearing while browsing Super Mario World) — unverified (IPS/zip) patches are now filtered to ones that actually share the game's title or live in a folder named after it

## v1.0 — Initial release

- Overview dashboard: profile stats, recently played games, recent unlocks
- Game Library: every RA game played, searchable/sortable, with progress and playtime
- Beaten by Year view
- Casual / Hardcore toggle across all stats
- Manually-tracked (non-RA) games via RAWG, with optional RAWG rating badges
- Installable PWA with offline support via a service worker
