# Game Log Tracker

A web app for keeping track of your RetroAchievements games. It runs in the browser, installs to your home screen like a normal app, and keeps working offline once it has loaded. There's no account to make with me, and everything you add is saved on your own device.

Live app: https://gin649.github.io/Game-Log-Tracker

For any questions and/or an invite to the discord where we're discussing this and playing games:

Discord: https://discord.gg/dJtAy4pvA
Email me: ginsretrogamehub@gmail.com

## What it does

**Overview** shows your RetroAchievements profile stats, the games you played recently with playtime and completion, and a feed of your latest unlocks.

**Game Library** lists every game you've played on RA. You can search it, sort it, filter by system, and see progress bars, award status and playtime for each game. Playtime comes from RA when it has it. When it doesn't, the app estimates it from your unlock times.

**Beaten by Year** groups everything you've beaten or mastered by the year you did it.

**Backlog** is for games you plan to play. You can search RA's game list by system and tick several results to add them in one go. You can also add games from systems RA doesn't track, using RAWG for box art and details. Those games never count toward your RA stats. An RA game moves into the Library once RA shows progress on it. A non-RA game moves when you tick "Now Playing", and marking it complete puts it in Beaten by Year. If a non-RA game shows up on RA later, you can link it to its RA entry.

**Casual / Hardcore** is one switch in the menu that flips every stat, list and progress bar between casual and hardcore numbers.

**Social** shows the people you follow on RetroAchievements, who is playing right now, and what they've unlocked lately.

### Inside a game

- Achievement list with points and unlock dates, a "!" badge on missable achievements, and a Missable Only filter.
- Drag achievements (or use the arrow buttons) to put them in your own order. The order is saved per game. You can export it as a .json file and import one someone else made.
- View Beaten Achievements shows the progression and win condition achievements RA uses to decide whether a game counts as beaten.
- Walkthrough videos: save YouTube links (single videos or playlists), watch them in the app, and it remembers where you stopped.
- Game guides: search the GameFAQs text guide archive on archive.org, or import your own .txt, .md, .html or .pdf file. The reader has search, bookmarks, text size, font and theme options, and a button that takes you back to where you were.
- Need Cheats? opens the game's GameFAQs cheats page.
- ROM Hacks lets you patch any cartridge based ROM in the browser. It handles BPS, IPS, UPS, PPF, APS and xdelta patches, including ones inside a .zip. Give it your own base ROM and it searches the RetroAchievements RAPatches repo for patches whose checksum matches, applies the one you pick, and checks the result against RA's known hashes when it can. There's also a link to search romhack.ing. Your ROM stays on your device and you download the patched file yourself. I don't host or supply any ROMs.
- A review score badge from RAWG (optional) and a link to search HowLongToBeat.
- Tap the box art to zoom in.

### Other things

- Text size controls in the menu.
- Pull down to refresh.
- Drag to scroll the system chips with a mouse.
- Install prompt on browsers that support it, and a short "Add to Home Screen" hint on iOS.

## Getting started

Open the app, go to the menu and choose Connect RA. Enter your RetroAchievements username and Web API key. You can find the key on RA under Control Panel, then Keys.

RAWG ratings and adding games from systems RA doesn't track both need a free RAWG key. Get one at https://rawg.io/apidocs and add it under Menu, then RAWG Ratings. The rest of the app works fine without it.

## Your data

Everything is stored in your browser using IndexedDB, and the app asks the browser to keep it from being cleared. Your RA login, RAWG key, added games, cached playtime, imported guides and saved videos all live there.

Nothing syncs between devices. If you switch browsers or devices, or clear the site's data, it won't come with you unless you back it up first. Menu, then Data, then Export downloads a .json file, and Import loads it on another device. The backup includes your API keys, so treat the file like a password.

## Privacy and where your requests go

None of your data is stored by me. Your login, keys and games stay in your browser.

RetroAchievements doesn't let browsers call its API directly, so those requests go through a private proxy I run on Cloudflare Workers. It passes the request along and stores nothing. The only thing it keeps track of is how many different API keys have been used, and that is never shared with me. All I see is a counter. The app itself has no analytics or tracking scripts.

RAWG lets browsers call it directly, so those requests go straight to RAWG.

If a request fails, the app falls back to public proxy services as a last resort (allorigins, codetabs, corsproxy.io, thingproxy and cors.eu.org). That happens for RetroAchievements if my proxy is down or over its free quota, and for RAWG if the direct call fails. I don't run those proxies, and they can see the requests that pass through them, including your API key, because both services want the key in the request URL.

Other sites the app contacts, and why:

- YouTube, for the video player and video titles.
- archive.org and the Guide Watch index (guides.retromodlab.com), for text guides.
- Wikidata, to find a game's GameFAQs page.
- GitHub, to search the RAPatches repo.
- media.retroachievements.org and RAWG, for images.

GameFAQs, HowLongToBeat and romhack.ing are only opened as links when you tap them.

## Offline and updates

A service worker keeps the app's files cached so it opens without a connection. When a new version is available it downloads in the background and a gold dot appears on the menu button. Nothing reloads on its own. Open the menu and tap Update app when you're ready.

## Thanks

Joey (https://www.joeysretrohandhelds.com) helped make this possible. His JoeyOS app inspired the guide lookup and the ROM patcher, and I used his approach to some features with his permission.

Achievement data comes from RetroAchievements and ratings and box art from RAWG. Text guides come from the GameFAQs archive on archive.org, indexed by the Guide Watch project. Patches come from the RAPatches repo (https://github.com/RetroAchievements/RAPatches). I'm not affiliated with any of them.

## Contact

Questions or bugs: open an issue here, or find me on Discord at https://discord.gg/dJtAy4pvA.

## License

MIT. See [LICENSE](LICENSE).

## Disclaimer

Claude AI was used to help write the code for this app. The ideas and the approach to each feature are mine, and I have reviewed and tested the code myself.
