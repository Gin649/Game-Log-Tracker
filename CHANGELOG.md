# Changelog

Notable changes to Game Log Tracker, newest first.

## v2.1.1.7

### Added
- Holding a Beaten by Year tile shows the game's title above it, since phones have no hover. Tapping still opens the game.

### Changed
- Casual and hardcore mode are now fully separate for Beaten and Mastered. Casual mode shows only casual awards, and hardcore mode only hardcore ones. A game you beat or mastered in hardcore no longer shows a Beaten/Mastered pill, a Beaten by Year entry, or a count in "started games beaten" while in casual mode, and the "(HC)" suffix is gone.
- Beaten by Year tiles are simpler: the Beaten pill and the cut-off title are gone, and Mastered games get a small pill on the bottom of the icon. Tap a tile to open the game.
- In Add Game, "Other system (not on RetroAchievements)…" is now at the top of the System list instead of the bottom. The first real system is still selected by default.

## v2.1.1.6

### Fixed
- The Back button (and back gesture) inside a game profile now closes the profile, like swiping it away, instead of leaving the app.

## v2.1.1.5

### Added
- Display > Standalone mode. Keeps your phone's system bars, including the bottom navigation bar, visible instead of going fullscreen. It is off by default, so the app opens fullscreen on the first tap as before. Switching it on leaves fullscreen straight away, and switching it off goes back in.

### Changed
- `manifest.json` now says `standalone` instead of `fullscreen`. The app asks for fullscreen itself on the first tap (unless Standalone mode is on), which is what lets the new option work. If you installed the app earlier, reinstall it (or wait for Android to refresh the install) so it stops forcing fullscreen from the manifest.

### Fixed
- Pulling down to refresh inside a game profile no longer closes the sections you had open (View Achievements, Game Guide, Subsets and so on). They stay expanded after the refresh.

## v2.1.1.4

### Fixed  
- Subset rows show their progress before you open them, e.g. "19/19 achievements · 100% · 50 pts", and keep that format once opened (it used to switch from "19 achievements" to "19/19 earned"). They also follow the Casual/Hardcore toggle while still closed.

## v2.1.1.3

### Added
- RetroAchievements Guides, in a game's Game Guide panel directly below the GameFAQs Archive download. "Find on RetroAchievements Guides" looks the game up in the guides wiki that RA set developers write (github.com/RetroAchievements/guides), lists the pages that match its title and console, and saves the one you pick to your device. There is also a search box over every guide in the wiki, for games whose guide uses a different name, and a "GitHub ↗" link on each result to open the page itself.
- Saved RA guides open in the same reader as the others, with search, bookmarks and text options. Their table of contents links jump within the guide, and the list shows them as "RA GUIDE".
- `tools/build-ra-guides-index.mjs` builds `ra-guides-index.json`, the list of guide pages in the wiki. The scheduled GitHub Action (now "Build RA indexes") refreshes it every day next to the RAPatches index.

### Fixed
- Social opens much faster. The list is saved on your device, so it shows straight away with everyone's last known status and updates behind it, instead of starting from a blank list every time. A refresh now only re-checks people who were active in the last day, plus anyone whose saved status has gone stale (15 minutes for people active this month, 2 hours for everyone else), instead of every person. The Refresh button still re-checks everyone. Statuses also load six at a time instead of four, and a failed refresh keeps the old status instead of blanking it.
- Game Library's "Last played" now matches Overview. It used to show only the date of your last achievement unlock, so playing a game without unlocking anything never moved it up. It now uses whichever is newer, the unlock or the actual last play.

### Changed
- App updates download much less. The update check now asks the server which files changed and only downloads those, instead of re-downloading the whole app (about 700 KB) every time.
- Links inside HTML guides no longer navigate the app away. `#section` links scroll the reader, and web links open in the browser. This applies to imported HTML guides too.
- Importing an HTML guide now also removes iframes, objects, embeds, forms, and `data:` links, on top of the scripts and event handlers it already removed.

## v2.1.1.2

### Added
- Subsets, a new section in a game's profile under View Beaten Achievements. It only appears for games that have RetroAchievements subsets, and it lists all of them, whether you've played them or not. Each subset opens its own achievement list with the same Reorder and Missable Only options, and you can export and import a custom order for it like the main list.
- Beaten and Mastered games on the Overview now have a small label on the corner of their box art.

### Changed
- Subsets no longer show up as separate games in Overview and Game Library. They're in their base game's profile instead.

## v2.1.1.1

### Added
- Swipe left or right on a game's profile to go back to wherever you opened it from (Overview, Game Library, Beaten by Year or Backlog). It ignores swipes that start in a text field, the video player, a sideways-scrolling list or while reordering achievements, and when the page is zoomed in.
- Display, a new item in the menu between Text Size and About. It has an option for a clock and battery readout at the top right of every screen, including the game profile and the guide reader. The battery shows as four pixel hearts that empty as it drops to 75%, 50%, 25% and 5%, with the time next to them. It works in Chrome and Edge on Android and Linux, and it's off by default.

## v2.1.1.0

### Changed
- Split the app into separate files. The scripts now live in `js/`, one per feature, and the stylesheet is in `css/`. Behavior is unchanged.
- Cleaned up the comments throughout the code.
- Updated the service worker's cache list for the new file paths.

## v2.1.0.1

### Changed
- Pull down to refresh now works on a game's profile page too. It reloads that game's profile and refreshes the data behind it.

## v2.1.0

### Added
- Social, in the menu above Data. It lists the people you follow on RetroAchievements with their avatar, what they're playing, their rich presence status, and when they were last active ("Playing now", "3h ago"). People playing right now come first, then everyone else by most recent activity.
- Tap someone in Social to see what they've unlocked in the last 14 days (tap an unlock for its description) and a link to their RetroAchievements profile.
- Social has a Refresh button and a link at the bottom for finding more people to follow.
- Every achievement in a game's list has a small teal RA button, sized to match the description text, that opens that achievement's page on RetroAchievements, where the comments and discussion are. It's hidden while reordering.

### Fixed
- The points column in the achievement list is a fixed width now, so one, two and three digit values line up and the RA button sits in the same place on every row.

## v2.0.9

### Added
- Multiple guides per game. The Game Guide panel keeps every guide you save for a game instead of replacing the last one. "+ Add another guide" lets you download, paste or import more.
- Each saved guide shows how far through it you are, for example "42% read". PDF guides don't show a percentage because the browser's own viewer handles them.
- Guides can be renamed with a Rename button on each row, so several guides for one game don't all show up as the game's name.txt. Enter saves and Escape cancels.
- An About section at the bottom of the menu with the app version, links to GitHub and Discord, a contact email, and credits.

### Fixed
- Guides saved before multiple guides existed couldn't be opened or removed. They now open, rename and delete like any other guide, and there's nothing to re-import.
- Guide names containing quotes or angle brackets could break the guide list. Names are now escaped.

## v2.0.8

### Added
- RetroAchievements requests now go through a Cloudflare Worker proxy I host, and only fall back to the public proxies if it's unavailable. This is more reliable than using the public proxies alone.
- A custom achievement order can be shared as a file. Export it from a game's achievement list, send it to a friend or post it on a forum, and they can import it into the same game on their own device.

### Changed
- In a game's profile, the completion date next to Beaten/Mastered is teal and the "Your progress" value is gold, to match the profile's other colors.

## v2.0.7

- The game profile shows the date beaten next to the Beaten badge, in the format Sep 02, 2026.
- Fixed: some hacks listed the same patch twice, and the "Official — linked by RetroAchievements" copy failed with a NetworkError. Each patch now appears once and official patches download correctly.
- The app remembers the folder your ROM came from, even when the ROM is loaded with "Remember this ROM". The "Save Patched ROM…" dialog opens in that folder. This works in Chrome and Edge. Firefox and Safari save to their default Downloads folder.
- The "What does it do?" link finds more hacks on romhack.ing. It removes "-Hack" from the name, splits run-together names into words (KirbysHalloweenAdventure becomes "Kirby's Halloween Adventure"), and restores the apostrophe in possessive names.

## v2.0.6

### Added
- Search YouTube walkthroughs. Every game profile has a Search YouTube button.
- "Find a walkthrough" opens a YouTube search for the game's title and console, with a hint on copying the link using Share, then Copy link.
- Paste as many YouTube links as you like. They're saved per game with thumbnails and titles.
- Tap a saved link to play it in the built-in player, which can go full screen.
- Saved links are included in Data backups.

## v2.0.5

### Added
- Missable achievements show a gold "!" badge in a game's achievement list, like RetroAchievements' own site, plus a "Missable Only" filter to narrow the list to just those.
- Achievements can be reordered in a game's profile by dragging or with the arrow buttons. Your order is saved per game and included in Data backups.

### Fixed
- Sync could feel slow right after this update if several backlog games turned out to already have real progress. They now move to the Library in one batched update instead of triggering a full re-render for each one.

## v2.0.4

### Added and Changed
- Backlog games move to the Game Library faster. The per-game request that already runs in the background for every game, Backlog ones included, now moves a game as soon as it sees real playtime or achievements, instead of waiting for RetroAchievements' slower bulk completion progress endpoint to catch up.
- Adding a non-RA game (PS3/PS4/PS5, Steam/PC, Xbox and so on) no longer asks you to type a console name. You pick from a platform dropdown taken from that game's RAWG data, so the same platform is always spelled the same way across custom games.
- Add Game can add several RetroAchievements games at once. Check off multiple results from a search (your selections stay across new searches), then add them all with "Add selected".
- Sorting by name in Game Library and Backlog now ignores leading RA tags like ~Hack~ and ~Homebrew~.
- The Award column in Game Library is sortable: beaten games first (alphabetical), then in-progress (alphabetical). Click again to reverse the order.

## v2.0.3

### Added and Changed
- New Backlog tab for games you've added but haven't played yet, separate from the Game Library. The tab order is now Overview, Game Library, Beaten by Year, Backlog.
- The "+ Add game" button moved from Game Library to Backlog.
- RetroAchievements games move from Backlog to Game Library on their own once RA shows real progress.
- Non-RA (manually tracked) games get a "Now Playing" checkbox in their profile. Checking it moves the game to the Game Library. Checking "Mark as beaten" also turns on Now Playing and saves the date to Beaten by Year.
- Backlog shows "Not on RA" instead of a blank dash in the achievements column for non-RA games.
- Non-RA game profiles have a "Link to RetroAchievements" panel. Search RA and convert the entry into a real RA-tracked game, with an achievement progress bar, if it turns out to be on RetroAchievements after all.

## v2.0.2

### Added and Fixed
- A button in the game profile that searches the GameFAQs cheat database.
- Playtime is more accurate and loads the most recent games first.
- Fixed a bug that stopped new updates from caching.
- Updates apply automatically the next time the app is opened after being closed.
- If the app is left idle and an update is available, a dot appears on the menu bar to prompt the update.
- Small style changes. Guides have a retro theme, and you tap Aa to switch themes.
- Mouse controls for scrolling the console chips on the PC version.

## v2.0.1

### Added
- A romhack.ing link in the ROM Hacks menu that goes to more details about the hack.

## v2.0: Big update

### Added and Changed
- GameFAQs Guide Reader.
- ROM Hacks. The list shows every matching hack for the loaded game in a scrollable panel.
- App-wide text size from 80% to 160% in 10% steps, in the menu. It's saved between visits and box art isn't affected.
- Reorganized the code into separate files with section headers for easier navigation. Same functionality.

### Fixed
- The ROM Hacks list no longer shows hacks for unrelated games (for example Super Metroid hacks showing up while browsing Super Mario World). Unverified (IPS/zip) patches are now filtered to ones that share the game's title or sit in a folder named after it.

## v1.0: Initial release

- Overview dashboard: profile stats, recently played games, recent unlocks.
- Game Library: every RA game played, searchable and sortable, with progress and playtime.
- Beaten by Year view.
- Casual / Hardcore toggle across all stats.
- Manually tracked (non-RA) games through RAWG, with optional RAWG rating badges.
- Installable PWA with offline support through a service worker.
