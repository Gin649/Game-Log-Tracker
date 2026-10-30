# Game Log Tracker

A web app for keeping track of all your games by tracking retroachievements and completions. It includes so many other features to make playing and beating games fun and easy. It runs in the browser and installs to your home screen. Everything you add is saved on your own device and can be exported wherever you need it.

Live app: https://gin649.github.io/Game-Log-Tracker

Join the Discord: https://discord.gg/6dgZA4yD2

Play some games with us. 

## What it does

**Overview** shows your RetroAchievements profile stats, the games you played recently with playtime and completion, and a feed of your latest unlocks. Games you've beaten or mastered get a small label on the corner of their box art. Pull down to refresh.

**Game Library** lists every game you've played on RA. You can search it, sort it, filter by system, and see progress bars, award status and playtime for each game. Playtime comes from RA when it has it. When it doesn't, the app estimates it from your unlock times. "Last played" matches Overview, using whichever is newer, your last unlock or your last play. The Award column is sortable, and sorting by name ignores tags like ~Hack~ and ~Homebrew~. A "Hide beaten" button next to the search box hides beaten and mastered games for the mode you're in, so you only see games in progress. The System chip counts follow it, and it's remembered between visits.

**Beaten by Year** groups everything you've beaten or mastered by the year you did it. Mastered games get a small pill on the bottom of the icon. Tap a tile to open the game, or hold it to see the title, since phones have no hover.

**Backlog** is for games you plan to play. You can search RA's game list by system and tick several results to add them in one go. You can add several at once, and your ticks stay across new searches. You can also add games from systems RA doesn't track, using RAWG for box art and details. For those, you pick the platform from a dropdown of RAWG's data instead of typing it, and "Other system (not on RetroAchievements)" is at the top of the System list and selected by default, so a non-RA game only needs a title. Platforms RA names (RAWG's "NES" becomes "NES/Famicom") are renamed to match so they group under the same System chip as your RA games. Those games never count toward your RA stats. An RA game moves into the Library once RA shows progress on it. A non-RA game moves when you tick "Now Playing", and marking it complete puts it in Beaten by Year. If a non-RA game shows up on RA later, you can link it to its RA entry.

**Casual / Hardcore** is one switch in the menu that flips every stat, list and progress bar between casual and hardcore numbers. Beaten and Mastered are fully separate too: casual mode shows only casual awards, and hardcore mode only hardcore ones.

**Social** shows the people you follow on RetroAchievements, who is playing right now, and what they've unlocked lately. It fills the whole screen. Tap someone to see their unlocks from the last 14 days and a link to their RA profile. The list is saved on your device, so it opens straight away and updates behind it, and the Refresh button re-checks everyone.

### Inside a game

- Game Details, above View Achievements, shows the average time other players take to beat and to master the game from RA, for the mode you're in, plus a write-up from RAWG with a Read more toggle. A section with nothing to show is left out, and games you added by hand get just the write-up. The profile also shows the date you beat the game next to the Beaten badge.
- Achievement list with points and unlock dates, a "!" badge on missable achievements, and a Missable Only filter. Unlocked achievements are listed with the latest unlock first, followed by the locked ones, unless you've saved your own order. A small RA button on each one opens its page on RetroAchievements, where the comments are.
- Drag achievements (or use the arrow buttons) to put them in your own order. The order is saved per game. You can export it as a .json file and import one someone else made.
- View Beaten Achievements shows the progression and win condition achievements RA uses to decide whether a game counts as beaten.
- Subsets: if a game has RetroAchievements subsets, a Subsets section lists all of them, whether you've played them or not. Each row shows your progress before you open it, and each one opens its own achievement list with the same reordering and order export and import. Subsets don't show up as separate rows in Overview or Game Library.
- Walkthrough videos: search YouTube for the game from its profile, save links (single videos or playlists), watch them in the app, and it remembers where you stopped.
- Game guides: search the GameFAQs text guide archive on archive.org, download an achievement guide from the RetroAchievements guides wiki, or import your own .txt, .md, .html or .pdf file. You can keep several guides per game, rename them, and see how far through each one you are. The reader has search (type a word, then tap → or press Enter), bookmarks, text size, font and theme options, and a button that takes you back to where you were. Links in HTML guides scroll the reader or open in your browser, and imported HTML has scripts, iframes, objects, embeds, forms and `data:` links removed.
- Need Cheats? opens the game's GameFAQs cheats page.
- ROM Hacks lets you patch a ROM in the browser. It handles BPS, IPS, UPS, PPF, APS and xdelta patches, including ones inside a .zip. Give it your own base ROM and it searches the RetroAchievements RAPatches repo for patches whose checksum matches, applies the one you pick, and checks the result against RA's known hashes when it can. There's also a link to search romhack.ing, and "What does it do?" finds more details about a hack there. In Chrome and Edge, the app remembers the folder your ROM came from and the save dialog opens there. Your ROM stays on your device and you download the patched file yourself. I don't host or supply any ROMs.
- A review score badge (optional) that averages RAWG's score with IGDB's critic and user ratings into one number out of 100. A game with only one source still shows that score, and games with none show "NR". There's also a link to search HowLongToBeat.
- Tap the box art to zoom in.

### Other things

- Text size controls in the menu.
- Controller support. Plug in or pair a gamepad and press a button: the D-pad or left stick moves a highlight, A confirms, B goes back, the right stick scrolls, Select opens the menu, X refreshes, L1 / R1 change console and L2 / R2 change tab. Touch still works and hides the highlight. A and B can be swapped under Controller in the menu. It works with gamepads and with handhelds whose controls arrive as arrow keys, Enter and Esc, and the page has to be in front.
- An optional clock and battery readout at the top of every screen, turned on under Display in the menu. The battery shows as four pixel hearts that empty as it drops to 75, 50, 25 and 5 percent, with the time next to them. It needs Chrome or Edge on Android or Linux, because other browsers don't let sites read the battery. It's off by default.
- Standalone mode, under Display in the menu, keeps your phone's system bars visible instead of going fullscreen. It's off by default, so the app opens fullscreen on the first tap.
- Pull down to refresh, on a game's profile too. Sections you had open stay open.
- The Back button and back gesture inside a game profile close it instead of leaving the app.
- About, at the bottom of the menu, has the app version, links to GitHub and Discord, a contact email and credits.
- Swipe left or right on a game's profile to go back to the screen you opened it from.
- Drag to scroll the system chips with a mouse.
- Install prompt on browsers that support it, and a short "Add to Home Screen" hint on iOS.

## Getting started

Open the app, go to the menu and choose Connect RA. Enter your RetroAchievements username and Web API key. You can find the key on RA under Control Panel, then Keys.

RAWG ratings and adding games from systems RA doesn't track both need a free RAWG key. Get one at https://rawg.io/apidocs and add it under Menu, then RAWG Ratings. The rest of the app works fine without it.

## Your data

Everything is stored in your browser using IndexedDB, and the app asks the browser to keep it from being cleared. Your RA login, RAWG key, added games, cached playtime, custom achievement orders, imported guides and saved videos all live there.

Nothing syncs between devices. If you switch browsers or devices, or clear the site's data, it won't come with you unless you back it up first. Menu, then Data, then Export downloads a .json file, and Import loads it on another device. The backup includes your API keys, so treat the file like a password.

## Privacy and where your requests go

None of your data is stored by me. Your login, keys and games stay in your browser.

RetroAchievements doesn't let browsers call its API directly, so those requests go through a private proxy I run on Cloudflare Workers. It passes the request along and stores nothing. The only thing it keeps track of is how many different API keys have been used, and that is never shared with me. All I see is a counter. The app itself has no analytics or tracking scripts.

RAWG lets browsers call it directly, so those requests go straight to RAWG. IGDB ratings go through the same Worker.

If a request fails, the app falls back to public proxy services as a last resort (allorigins, codetabs, corsproxy.io, thingproxy and cors.eu.org). That happens for RetroAchievements if my proxy is down or over its free quota, and for RAWG if the direct call fails. I don't run those proxies, and they can see the requests that pass through them, including your API key, because both services want the key in the request URL.

Other sites the app contacts, and why:

- YouTube, for the video player and video titles.
- archive.org and the Guide Watch index (guides.retromodlab.com), for text guides.
- Wikidata, to find a game's GameFAQs page.
- GitHub, to search the RAPatches repo and to download guides from the RetroAchievements guides wiki.
- media.retroachievements.org and RAWG, for images.

GameFAQs, HowLongToBeat and romhack.ing are only opened as links when you tap them.

## Offline and updates

A service worker keeps the app's files cached so it opens without a connection. When a new version is available it downloads in the background, fetching only the files that changed, and a gold dot appears on the menu button. Nothing reloads on its own. Open the menu and tap Update app when you're ready.

## Running your own copy

It's a static site with no build step and nothing to install.

```
index.html
sw.js            service worker, has to stay in the root
manifest.json
icon-*.png, apple-touch-icon.png
css/style.css
js/              the scripts, one file per feature
tools/           scripts that build ra-patches-index.json and ra-guides-index.json
```

1. Fork or clone the repo.
2. In Settings, then Pages, set the source to your branch and the root folder.
3. If you rename the repo, change `start_url` and `scope` in `manifest.json` to match, or the app won't be installable.
4. The scripts load in the order listed at the bottom of `index.html`, and later ones use globals from earlier ones, so keep that order. If you add or rename a file, update the list in `index.html` and `ASSETS_TO_CACHE` in `sw.js`.
5. Change `CACHE_NAME` in `sw.js` every time you deploy, or returning visitors will keep their old cached copy.

A scheduled GitHub Action ("Build RA indexes") refreshes the RAPatches index and the RA guides index every day, so they only update on a copy that keeps `.github/workflows` and has Actions enabled.

The RA proxy address in `js/ra-api.js` is mine and is set up for this site. A copy on a different address will fall back to the public proxies. To avoid that, deploy your own Worker that forwards RA API calls and change the URL there.

## Thanks

Joey (https://www.joeysretrohandhelds.com) helped make this possible. His JoeyOS app inspired the guide lookup and the ROM patcher, and I used his approach with his permission.

Achievement data comes from RetroAchievements and ratings and box art from RAWG. Text guides come from the GameFAQs archive on archive.org, indexed by the Guide Watch project. Patches come from the RAPatches repo (https://github.com/RetroAchievements/RAPatches). I'm not affiliated with any of them.

## Contact

Questions or bugs: open an issue here, or find me on Discord.

## License

MIT. See [LICENSE](LICENSE).
