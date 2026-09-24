// ==============================================================================
// GAME LOG TRACKER — APP CORE
// Local storage, RetroAchievements API calls, the dashboard/library/year
// views, the add-game and game-detail-modal flows, RAWG ratings, data
// export/import, the hamburger menu (incl. text size), install banner,
// pull-to-refresh, and the app's startup sequence at the bottom of this
// file. rom-patcher.js and guides.js extend the game detail modal from
// here but can load in any order relative to each other.
// ==============================================================================

  // ============================================================================
  // SECTION — Local storage & persistence
  // ============================================================================
  // --- window.storage: IndexedDB-backed, with Persistent Storage API ---
  // All app data (RA credentials, RAWG key, manually-added games, caches)
  // lives here now — entirely on-device, no cloud copy. IndexedDB is far
  // more resistant to the browser silently clearing storage under space
  // pressure than localStorage is, and requesting persistent storage below
  // asks the browser not to evict this data automatically at all.
  if(!window.storage){
    const IDB_NAME = 'GameLogTrackerDB';
    const IDB_VERSION = 1;
    const IDB_STORE = 'kv';
    const nsKey = (key, shared) => (shared ? 'shared:' : 'priv:') + key;
    const stripNs = (key, shared) => key.slice((shared ? 'shared:' : 'priv:').length);

    let idbOpenPromise = null;
    function openIdb(){
      if(idbOpenPromise) return idbOpenPromise;
      idbOpenPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if(!db.objectStoreNames.contains(IDB_STORE)){
            db.createObjectStore(IDB_STORE, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return idbOpenPromise;
    }

    window.storage = {
      get: async (key, shared) => {
        const db = await openIdb();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const req = tx.objectStore(IDB_STORE).get(nsKey(key, shared));
          req.onsuccess = () => {
            if(!req.result) reject(new Error('No value found for key: ' + key));
            else resolve({ key, value: req.result.value, shared: !!shared });
          };
          req.onerror = () => reject(req.error);
        });
      },
      set: async (key, value, shared) => {
        const db = await openIdb();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put({ key: nsKey(key, shared), value });
          tx.oncomplete = () => resolve({ key, value, shared: !!shared });
          tx.onerror = () => reject(tx.error);
        });
      },
      delete: async (key, shared) => {
        const db = await openIdb();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).delete(nsKey(key, shared));
          tx.oncomplete = () => resolve({ key, deleted: true, shared: !!shared });
          tx.onerror = () => reject(tx.error);
        });
      },
      list: async (prefix, shared) => {
        const db = await openIdb();
        const p = nsKey(prefix || '', shared);
        return new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const req = tx.objectStore(IDB_STORE).getAllKeys();
          req.onsuccess = () => {
            const keys = req.result.filter(k => String(k).startsWith(p)).map(k => stripNs(k, shared));
            resolve({ keys, prefix, shared: !!shared });
          };
          req.onerror = () => reject(req.error);
        });
      },
      // Not part of the standard interface — used only by the Data export/
      // import feature to work with the whole store at once.
      _getAllRaw: async () => {
        const db = await openIdb();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const req = tx.objectStore(IDB_STORE).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
      },
      _putAllRaw: async (rawEntries) => {
        const db = await openIdb();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          rawEntries.forEach(entry => tx.objectStore(IDB_STORE).put(entry));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      },
    };
  }

  if(navigator.storage && navigator.storage.persist){
    navigator.storage.persisted().then(already => {
      if(!already) navigator.storage.persist().then(granted => {
        console.log('Persistent storage request:', granted ? 'granted' : 'declined by browser');
      });
    });
  }

  // --- "Add to home screen" install prompt ---
  // Chrome/Edge/Android stopped showing their own install UI automatically
  // on most sites — a page has to capture beforeinstallprompt and offer its
  // own button, or nothing visible happens at all, which is what was seen.
  // iOS Safari never fires that event; there's no programmatic install API
  // there, so it gets a manual "tap Share, then Add to Home Screen" message
  // instead of a button.
  (function(){
    const banner = document.getElementById('install-banner');
    const msgEl = document.getElementById('install-banner-msg');
    const installBtn = document.getElementById('btn-install-app');
    const dismissBtn = document.getElementById('install-banner-dismiss');
    if(!banner) return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true; // iOS Safari's own installed-flag
    if(isStandalone) return; // already installed — never show this

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    let deferredPrompt = null;

    async function wasDismissed(){
      try{
        const r = await window.storage.get('pwa-install-dismissed', false);
        return !!(r && r.value);
      }catch(e){ return false; } // nothing stored yet — not dismissed
    }
    async function setDismissed(){
      try{ await window.storage.set('pwa-install-dismissed', 'true', false); }catch(e){}
    }

    (async () => {
      if(await wasDismissed()) return;
      if(isIOS){
        msgEl.textContent = 'Install this app: tap the Share icon, then "Add to Home Screen".';
        installBtn.style.display = 'none';
        banner.style.display = 'flex';
      }
      // Non-iOS: stays hidden until (and unless) beforeinstallprompt fires below.
    })();

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      wasDismissed().then(dismissed => {
        if(dismissed) return;
        msgEl.textContent = 'Install Game Log Tracker on your device for quick, offline access.';
        installBtn.style.display = 'inline-block';
        banner.style.display = 'flex';
      });
    });

    installBtn.addEventListener('click', async () => {
      if(!deferredPrompt) return;
      installBtn.disabled = true;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      banner.style.display = 'none';
      installBtn.disabled = false;
    });

    window.addEventListener('appinstalled', () => {
      banner.style.display = 'none';
      setDismissed();
    });

    dismissBtn.addEventListener('click', () => {
      banner.style.display = 'none';
      setDismissed();
    });
  })();

  const MEDIA = 'https://media.retroachievements.org';
  let creds = null; // { username, apiKey }
  let libraryData = [];
  let recentGamesData = [];
  let lastProfile = null; // re-used to recompute profile stats once library data loads
  let userPoints = null; // { Points (hardcore), SoftcorePoints } from API_GetUserPoints.php — these are disjoint, not overlapping subsets
  let statsMode = 'casual'; // 'casual' | 'hardcore' — toggled from the menu
  let libraryIndex = {}; // GameID -> library entry, for looking up beaten status
  let librarySort = { key: 'lastPlayed', dir: 'desc' };
  const estHoursCache = {}; // in-memory, keyed by GameID, for this session — { hours, beaten }
  const achievementsListCache = {}; // in-memory, keyed by GameID — full per-achievement list with earn dates, opportunistically filled by getEstimatedHours()
  let systemFilter = 'All';

  // Serializes loadAll() against manual add/remove operations so they can
  // never interleave — e.g. adding a game while the initial post-login load
  // is still fetching used to let that load's later completion silently
  // overwrite the just-added game with stale data. Now anything queued here
  // always waits for whatever's already running to fully settle first.
  let taskQueue = Promise.resolve();
  function enqueueTask(fn){
    const run = taskQueue.then(fn, fn);
    taskQueue = run.catch(() => {}); // one failure shouldn't jam the queue for later tasks
    return run;
  }
  let loadGeneration = 0; // bumped each loadAll() call; lets a stale/superseded run detect it's outdated
  let activeTab = 'overview';
  const gameExtendedCache = {}; // in-memory, keyed by GameID

  const $ = (sel) => document.querySelector(sel);

  function parseRADate(dateStr){
    if(!dateStr) return null;
    let s = String(dateStr).trim();
    if(s.indexOf('T') === -1) s = s.replace(' ', 'T');
    if(!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z'; // RA API times are UTC with no offset marker
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function timeAgo(dateStr){
    const d = parseRADate(dateStr);
    if(!d) return '—';
    const diff = (Date.now() - d.getTime()) / 1000;
    if(diff < 60) return 'just now';
    if(diff < 3600) return Math.floor(diff/60) + 'm ago';
    if(diff < 86400) return Math.floor(diff/3600) + 'h ago';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // --- Networking: try a direct call, fall back to CORS proxies ---
  async function raFetch(endpoint, params){
    const qs = new URLSearchParams({ ...params, y: creds.apiKey, u: creds.username });
    const targetUrl = `https://retroachievements.org/API/${endpoint}?${qs.toString()}`;

    async function validate(label, res){
      if(res.status === 401 || res.status === 403){
        if(label === 'direct'){
          // Only the direct call is guaranteed to have actually reached RetroAchievements —
          // a proxy returning 401/403 is often the proxy's own auth wall, not RA's.
          const err = new Error('RetroAchievements rejected the username or API key (HTTP ' + res.status + ').');
          err.authFailure = true;
          throw err;
        }
        throw new Error(`${label}: HTTP ${res.status} (likely the proxy, not RetroAchievements)`);
      }
      if(!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
      let data;
      try{ data = await res.json(); }
      catch(e){ throw new Error(`${label}: response wasn't valid JSON`); }
      if(data && data.Error) throw new Error(data.Error);
      if(data === null || (Array.isArray(data) && data.length === 0 && endpoint.includes('Profile'))){
        throw new Error(`${label}: empty response`);
      }
      return data;
    }

    async function attempt(label, run){
      let res;
      try{ res = await run(); }
      catch(networkErr){ throw new Error(`${label}: blocked (${networkErr.message})`); }
      return validate(label, res);
    }

    // Races a set of promises, resolving with whichever succeeds first.
    // Only rejects once every single one has failed, collecting all reasons.
    // (Written by hand instead of using Promise.any for wider compatibility.)
    function raceFirstSuccess(promises){
      return new Promise((resolve, reject) => {
        let remaining = promises.length;
        const errors = [];
        promises.forEach(p => {
          p.then(resolve, (err) => {
            errors.push(err && err.message ? err.message : String(err));
            remaining--;
            if(remaining === 0) reject(new Error(errors.join('; ')));
          });
        });
      });
    }

    // Try direct first — fast when it works, and its status is the only one we
    // can trust as a real signal from RetroAchievements itself (not a proxy).
    try{
      return await attempt('direct', () => fetch(targetUrl));
    }catch(directErr){
      if(directErr.authFailure) throw directErr;
      // Otherwise fall through and race the proxies below.
    }

    const proxyAttempts = [
      attempt('allorigins', () => fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(targetUrl))),
      attempt('codetabs',   () => fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(targetUrl))),
      attempt('corsproxy',  () => fetch('https://corsproxy.io/?url=' + encodeURIComponent(targetUrl))),
      attempt('thingproxy', () => fetch('https://thingproxy.freeboard.io/fetch/' + targetUrl)),
      attempt('corseu',     () => fetch('https://cors.eu.org/' + targetUrl)),
    ];

    try{
      return await raceFirstSuccess(proxyAttempts);
    }catch(aggregateErr){
      throw new Error('Every connection route failed — ' + aggregateErr.message);
    }
  }

  function imgUrl(path){
    if(!path) return '';
    return path.startsWith('http') ? path : MEDIA + path;
  }

  // --- Playtime ---
  // RetroAchievements now tracks real playtime directly (UserTotalPlaytime,
  // in seconds) for accounts with this feature enabled, returned by the
  // same GetGameInfoAndUserProgress call we already make per game — so this
  // costs no extra requests. Some games can still come back with 0/no value
  // if RA hasn't computed real time for that play history yet (e.g. it
  // predates the feature), in which case we fall back to our own estimate:
  // for a beaten/completed/mastered game, the calendar span from first
  // unlock to the one that earned the award; otherwise, unlock timestamps
  // grouped into "sessions" (gaps under 30 minutes count as continuous
  // play) and summed. Both fallbacks are rough proxies — real data is used
  // whenever RA actually has it.
  const SESSION_GAP_MIN = 30;
  const SESSION_START_MIN = 5;

  function estimateHoursFromTimestamps(msTimestamps){
    if(!msTimestamps || msTimestamps.length === 0) return null;
    const sorted = [...new Set(msTimestamps)].sort((a,b) => a - b);
    let totalMin = SESSION_START_MIN;
    for(let i = 1; i < sorted.length; i++){
      const diffMin = (sorted[i] - sorted[i-1]) / 60000;
      totalMin += diffMin <= SESSION_GAP_MIN ? diffMin : SESSION_START_MIN;
    }
    return totalMin / 60;
  }

  function beatenSpanHoursFromTimestamps(msTimestamps){
    if(!msTimestamps || msTimestamps.length === 0) return null;
    const sorted = [...new Set(msTimestamps)].sort((a,b) => a - b);
    return (sorted[sorted.length - 1] - sorted[0]) / 3600000;
  }

  function formatDuration(entry, short){
    if(!entry || entry.hours == null) return '—';
    const totalMinutes = Math.round(entry.hours * 60);
    if(totalMinutes < 60){
      return short ? `${totalMinutes}m` : `${totalMinutes} min${totalMinutes === 1 ? '' : 's'}`;
    }
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const mins = totalMinutes % 60;
    if(days > 0){
      if(short) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
      const hrPart = hours > 0 ? ` ${hours} hr${hours === 1 ? '' : 's'}` : '';
      return `${days} day${days === 1 ? '' : 's'}${hrPart}`;
    }
    if(short) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    const minPart = mins > 0 ? ` ${mins} min${mins === 1 ? '' : 's'}` : '';
    return `${hours} hr${hours === 1 ? '' : 's'}${minPart}`;
  }

  async function getEstimatedHours(gameId, force){
    if(!force && estHoursCache[gameId] !== undefined) return estHoursCache[gameId];

    const localGame = libraryIndex[gameId];
    const officialAward = !!(localGame && localGame.HighestAwardKind);
    // RA only assigns an official "beaten" award when the achievement set's
    // author tagged specific win-condition achievements — many sets never
    // do. A 100%-complete game is functionally beaten either way, so treat
    // it the same regardless of whether that formal tag exists. (Only
    // matters for the estimate fallback below, not for real RA data.)
    const fullyCompleted = !!(localGame && Number(localGame.MaxPossible) > 0 &&
      Number(localGame.NumAwarded) >= Number(localGame.MaxPossible));
    const beaten = officialAward || fullyCompleted;
    const cacheKey = `ra-hours:${creds.username}:${gameId}`;
    if(!force){
    try{
      const r = await window.storage.get(cacheKey, false);
      if(r && r.value){
        const parsed = JSON.parse(r.value);
        // Only trust a cached *miss* (hours: null) for a much shorter window —
        // RA may simply not have finished computing playtime for this game
        // yet, and we don't want that temporary gap sticking around for the
        // full 12h once RA does have it.
        const ttl = parsed.hours == null ? 5 * 60 * 1000 : 12 * 60 * 60 * 1000;
        if(Date.now() - parsed.ts < ttl){
          estHoursCache[gameId] = { hours: parsed.hours, beaten, real: !!parsed.real };
          return estHoursCache[gameId];
        }
      }
    }catch(e){ /* not cached yet */ }
    }

    let hours = null;
    let real = false;
    try{
      const data = await raFetch('API_GetGameInfoAndUserProgress.php', { g: gameId, a: 1 });

      if(data && data.Achievements){
        achievementsListCache[gameId] = Object.values(data.Achievements)
          .sort((a,b) => (a.DisplayOrder ?? 0) - (b.DisplayOrder ?? 0));
      }

      const realSeconds = Number(data && data.UserTotalPlaytime);
      if(realSeconds > 0){
        hours = realSeconds / 3600;
        real = true;
      }else{
        const achievements = (data && data.Achievements) ? Object.values(data.Achievements) : [];
        const dates = [];
        achievements.forEach(a => {
          const d1 = parseRADate(a.DateEarned);
          const d2 = parseRADate(a.DateEarnedHardcore);
          if(d1) dates.push(d1.getTime());
          if(d2) dates.push(d2.getTime());
        });
        hours = beaten ? beatenSpanHoursFromTimestamps(dates) : estimateHoursFromTimestamps(dates);
      }
    }catch(e){ hours = null; }

    estHoursCache[gameId] = { hours, beaten, real };
    try{ await window.storage.set(cacheKey, JSON.stringify({ hours, real, ts: Date.now() }), false); }catch(e){ /* non-fatal */ }
    return estHoursCache[gameId];
  }

  async function loadEstimatedHoursFor(games, onProgress, forceIds){
    const CONCURRENCY = 8;
    const targets = games.filter(g =>
      g && g.GameID != null &&
      (estHoursCache[g.GameID] === undefined || (forceIds && forceIds.has(g.GameID)))
    );
    let idx = 0;
    let doneSinceRender = 0;
    async function worker(){
      while(idx < targets.length){
        const g = targets[idx++];
        const force = !!(forceIds && forceIds.has(g.GameID));
        await getEstimatedHours(g.GameID, force);
        doneSinceRender++;
        if(onProgress && doneSinceRender % 4 === 0) onProgress();
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
    if(onProgress) onProgress(); // final render to catch any remainder
  }

  // Almost always already populated by getEstimatedHours() above (it fetches
  // this exact endpoint for every game in the library on load) — this only
  // hits the network itself if that hasn't happened yet for this game.
  async function getAchievementsList(gameId){
    if(achievementsListCache[gameId]) return achievementsListCache[gameId];
    const data = await raFetch('API_GetGameInfoAndUserProgress.php', { g: gameId, a: 1 });
    const list = (data && data.Achievements)
      ? Object.values(data.Achievements).sort((a,b) => (a.DisplayOrder ?? 0) - (b.DisplayOrder ?? 0))
      : [];
    achievementsListCache[gameId] = list;
    return list;
  }

  function achRowHtml(a, isLocked, isHardcoreMode){
    const badge = imgUrl('/Badge/' + a.BadgeName + (isLocked ? '_lock' : '') + '.png');
    const earnedDate = isHardcoreMode ? a.DateEarnedHardcore : a.DateEarned;
    return `
      <div class="ach-row ${isLocked ? 'locked' : ''}">
        <img src="${badge}" alt="">
        <div class="info">
          <p class="t">${a.Title || 'Untitled'}</p>
          <p class="d">${a.Description || ''}</p>
          ${!isLocked ? `<p class="when">Unlocked ${timeAgo(earnedDate)}</p>` : ''}
        </div>
        <div class="pts">${a.Points ?? ''}</div>
      </div>
    `;
  }

  function renderAchievementsList(list, isHardcoreMode){
    if(!list || list.length === 0) return '<div class="achievements-list-loading">No achievement data available.</div>';
    // Match the rest of the app's hardcore/casual convention: hardcore mode
    // only counts an achievement as earned if it was unlocked in hardcore
    // (DateEarnedHardcore); casual mode counts any unlock at all
    // (DateEarned is set on every unlock, hardcore or not).
    const earned = list.filter(a => isHardcoreMode ? a.DateEarnedHardcore : a.DateEarned);
    const locked = list.filter(a => isHardcoreMode ? !a.DateEarnedHardcore : !a.DateEarned);
    return earned.map(a => achRowHtml(a, false, isHardcoreMode)).join('') + locked.map(a => achRowHtml(a, true, isHardcoreMode)).join('');
  }

  // RA marks a game "Beaten" once the player has earned every achievement
  // typed as "progression", plus at least one typed as "win_condition" (if
  // any exist) — per RA's own Progression & Win Condition guidelines. Not
  // every game's set has been typed by RA's developer community yet, so an
  // empty result here doesn't necessarily mean the game can't be beaten —
  // just that this particular set hasn't been marked up with those types.
  function getBeatenAchievements(list){
    return (list || []).filter(a => {
      const t = String(a.Type || a.type || '').toLowerCase();
      return t === 'progression' || t === 'win_condition' || t === 'win';
    });
  }

  function renderBeatenAchievementsList(list, isHardcoreMode){
    const beaten = getBeatenAchievements(list);
    if(beaten.length === 0){
      return '<div class="achievements-list-loading">This game\'s achievement set hasn\'t been marked with progression/win-condition achievements on RetroAchievements yet.</div>';
    }
    const earned = beaten.filter(a => isHardcoreMode ? a.DateEarnedHardcore : a.DateEarned);
    const locked = beaten.filter(a => isHardcoreMode ? !a.DateEarnedHardcore : !a.DateEarned);
    return earned.map(a => achRowHtml(a, false, isHardcoreMode)).join('') + locked.map(a => achRowHtml(a, true, isHardcoreMode)).join('');
  }

  // --- Persistence via window.storage (local only — no cloud copy) ---
  async function saveCreds(username, apiKey){
    try{ await window.storage.set('ra-credentials', JSON.stringify({ username, apiKey }), false); }
    catch(e){ /* non-fatal */ }
  }
  async function loadCreds(){
    try{
      const r = await window.storage.get('ra-credentials', false);
      if(r && r.value) return JSON.parse(r.value);
    }catch(e){ /* none stored yet */ }
    return null;
  }
  async function clearCreds(){
    try{ await window.storage.delete('ra-credentials', false); }catch(e){}
  }

  // --- "Need Cheats?" (GameFAQs) ---
  // Pressing the button opens that game's GameFAQs cheats page in a new tab. GameFAQs blocks
  // in-app fetching, so it only links out. The link needs the game's numeric GameFAQs ID, which is
  // looked up on Wikidata (free, and its API allows browser requests) the first time and then
  // remembered per game. GameFAQs shows the same cheats for every platform version, so any of a
  // game's IDs works. If no match is found, it opens GameFAQs' search for the title instead.
  const CHEATS_URL = id => `https://gamefaqs.gamespot.com/-/${id}-/cheats`; // if this pattern doesn't reach the cheats page, fix it here only
  const WD_API = 'https://www.wikidata.org/w/api.php';
  const WD_SPARQL = 'https://query.wikidata.org/sparql';
  // RA console name (lowercase) -> Wikidata platform labels (lowercase) that count as a match.
  // Consoles not listed here are matched on title only.
  const WD_PLATFORMS = {
    'game boy': ['game boy'],
    'game boy color': ['game boy color'],
    'game boy advance': ['game boy advance'],
    'snes/super famicom': ['super nintendo entertainment system', 'super famicom', 'snes'],
    'nes/famicom': ['nintendo entertainment system', 'family computer', 'famicom', 'nes'],
    'genesis/mega drive': ['sega genesis', 'mega drive', 'sega mega drive', 'genesis'],
    'nintendo 64': ['nintendo 64'],
    'playstation': ['playstation'],
    'playstation 2': ['playstation 2'],
    'playstation portable': ['playstation portable'],
    'nintendo ds': ['nintendo ds'],
    'master system': ['sega master system', 'master system'],
    'game gear': ['game gear', 'sega game gear'],
    'sega cd': ['sega cd', 'mega-cd', 'sega mega-cd'],
    'saturn': ['sega saturn', 'saturn'],
    'dreamcast': ['dreamcast', 'sega dreamcast'],
    'pc engine/turbografx-16': ['turbografx-16', 'pc engine', 'turbografx-16/pc engine'],
    'atari 2600': ['atari 2600'],
    'atari 7800': ['atari 7800'],
    'atari lynx': ['atari lynx'],
    'virtual boy': ['virtual boy'],
    'neo geo pocket': ['neo geo pocket', 'neo geo pocket color'],
    'wonderswan': ['wonderswan', 'wonderswan color']
  };

  // RA titles carry tags and "X, The" ordering that Wikidata doesn't use.
  function cheatsCleanTitle(t){
    let s = String(t || '').replace(/\[[^\]]*\]/g, ' ').replace(/~[^~]*~/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/^(.*?),\s*(the|a|an)\b(.*)$/i, '$2 $1$3');
    return s.replace(/\s+/g, ' ').trim();
  }
  function cheatsNormTitle(t){
    return cheatsCleanTitle(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  // 2 = same title, 1 = one contains the other (without a sequel number/numeral tacked on), 0 = no match
  function cheatsTitleScore(a, b){
    if(!a || !b) return 0;
    if(a === b) return 2;
    const short = a.length <= b.length ? a : b;
    const long = a.length <= b.length ? b : a;
    if(short.length / long.length < 0.6 || !(' ' + long + ' ').includes(' ' + short + ' ')) return 0;
    const extra = (' ' + long + ' ').replace(' ' + short + ' ', ' ').trim().split(' ');
    if(extra.some(w => /^\d+$/.test(w) || /^(ii|iii|iv|v|vi|vii|viii|ix|x)$/.test(w))) return 0;
    return 1;
  }
  // cands: [{ qid, title, names[], itemPlats[], statements:[{ id, preferred, qplats[] }] }]
  function pickWikidataMatch(title, consoleName, cands){
    const target = cheatsNormTitle(title);
    const accepted = WD_PLATFORMS[String(consoleName || '').trim().toLowerCase()] || null;
    let best = null;
    (cands || []).forEach(c => {
      let ts = 0;
      (c.names || []).forEach(n => { ts = Math.max(ts, cheatsTitleScore(target, cheatsNormTitle(n))); });
      if(!ts || !c.statements || !c.statements.length) return;
      const itemHasConsole = accepted && c.itemPlats.length ? c.itemPlats.some(p => accepted.includes(p)) : null;
      c.statements.forEach(s => {
        // true = ID is confirmed to be this console's version; false = wrong console;
        // null = can't tell (e.g. the game is on several platforms and Wikidata doesn't say which one this ID is for)
        let ok = null;
        if(accepted){
          if(s.qplats.length) ok = s.qplats.some(p => accepted.includes(p));
          else if(itemHasConsole === false) ok = false;
          else if(itemHasConsole === true && c.itemPlats.length === 1 && c.statements.length === 1) ok = true;
        }
        if(ok === false) return;
        const score = ts * 10 + (ok === true ? 5 : 0) + (s.preferred ? 1 : 0);
        if(!best || score > best.score) best = { score, id:s.id, qid:c.qid, title:c.title, platformOk:ok, ids:c.statements.map(x => x.id) };
      });
    });
    return best;
  }
  async function wdJson(url){
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try{
      const r = await fetch(url, { signal: ctrl.signal });
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    }finally{ clearTimeout(timer); }
  }
  // Resolves to { found, id?, qid?, title?, platformOk?, at }. Throws on network/API errors
  // (those are shown to the user and NOT cached).
  async function lookupCheats(title, consoleName){
    if(/^\s*~/.test(title || '')) return { v:2, found:false, reason:'hack', at:Date.now() };
    const search = cheatsCleanTitle(title);
    if(!search) return { v:2, found:false, at:Date.now() };
    const sp = new URLSearchParams({ action:'wbsearchentities', search, language:'en', uselang:'en', type:'item', limit:'20', format:'json', origin:'*' });
    const sr = await wdJson(`${WD_API}?${sp}`);
    const hits = (sr.search || []).filter(h => /^Q\d+$/.test(h.id));
    if(!hits.length) return { v:2, found:false, at:Date.now() };
    const sparql = `SELECT ?item ?id ?rank ?qplatLabel ?platLabel WHERE {
      VALUES ?item { ${hits.map(h => 'wd:' + h.id).join(' ')} }
      ?item p:P4769 ?st . ?st ps:P4769 ?id . ?st wikibase:rank ?rank .
      FILTER(?rank != wikibase:DeprecatedRank)
      OPTIONAL { ?st pq:P400 ?qplat . ?qplat rdfs:label ?qplatLabel . FILTER(LANG(?qplatLabel) = "en") }
      OPTIONAL { ?item wdt:P400 ?plat . ?plat rdfs:label ?platLabel . FILTER(LANG(?platLabel) = "en") }
    }`;
    const rows = await wdJson(`${WD_SPARQL}?${new URLSearchParams({ query:sparql, format:'json' })}`);
    const byQ = {};
    hits.forEach(h => {
      byQ[h.id] = { qid:h.id, title:h.label || h.id, names:[h.label, h.match && h.match.text].filter(Boolean), statements:{}, itemPlats:[] };
    });
    ((rows.results && rows.results.bindings) || []).forEach(b => {
      const c = byQ[b.item.value.split('/').pop()];
      if(!c) return;
      const st = c.statements[b.id.value] || (c.statements[b.id.value] = { id:b.id.value, preferred:false, qplats:[] });
      if(/PreferredRank$/.test(b.rank.value)) st.preferred = true;
      if(b.qplatLabel && !st.qplats.includes(b.qplatLabel.value.toLowerCase())) st.qplats.push(b.qplatLabel.value.toLowerCase());
      if(b.platLabel && !c.itemPlats.includes(b.platLabel.value.toLowerCase())) c.itemPlats.push(b.platLabel.value.toLowerCase());
    });
    const cands = Object.values(byQ).map(c => ({ ...c, statements: Object.values(c.statements) }));
    const m = pickWikidataMatch(title, consoleName, cands);
    return m && /^\d+$/.test(String(m.id))
      ? { v:2, found:true, id:String(m.id), ids:(m.ids || []).map(String).filter(x => /^\d+$/.test(x)), qid:m.qid, title:m.title, platformOk:m.platformOk, at:Date.now() }
      : { v:2, found:false, at:Date.now() };
  }

  function cheatsAutoKey(gameId){ return `cheatsauto:${creds.username.trim().toLowerCase()}:${gameId}`; }
  async function loadCheatsAuto(gameId){
    try{
      const r = await window.storage.get(cheatsAutoKey(gameId), false);
      if(r && r.value){
        const o = JSON.parse(r.value);
        if(o && typeof o === 'object' && o.v === 2 && (!o.found || /^\d+$/.test(String(o.id)))) return o;
      }
    }catch(e){ /* not looked up yet */ }
    return null;
  }
  async function saveCheatsAuto(gameId, o){
    try{ await window.storage.set(cheatsAutoKey(gameId), JSON.stringify(o), false); }catch(e){ /* non-fatal */ }
  }
  // Cached match if we have one, otherwise a Wikidata lookup. Falls back to GameFAQs' own search.
  // Resolves to { url, final }: final=false means a network problem, so it isn't remembered and
  // the next tap should try again.
  async function resolveCheatsUrl(gameId, title, consoleName){
    const searchUrl = `https://gamefaqs.gamespot.com/search?game=${encodeURIComponent(title)}`;
    let auto = await loadCheatsAuto(gameId);
    const retryMissAfter = 7 * 24 * 3600 * 1000; // re-check "not found" results weekly
    if(!auto || (!auto.found && Date.now() - (auto.at || 0) > retryMissAfter)){
      try{
        auto = await lookupCheats(title, consoleName);
        await saveCheatsAuto(gameId, auto);
      }catch(e){ return { url:searchUrl, final:false }; }
    }
    return { url: auto.found ? CHEATS_URL(auto.id) : searchUrl, final:true };
  }

  function setupCheatsUI(gameId, title, card, consoleName){
    const btn = card.querySelector('#modal-cheats-btn');
    if(!btn) return;
    // The lookup starts as soon as the game profile opens, so by the time the button is tapped the
    // link is usually already known and the page opens instantly, inside the tap itself (which
    // browsers require to allow a new tab). The saved result means it's only ever done once per game.
    let readyUrl = null, failed = false, pending = null, busy = false;
    function start(){
      failed = false;
      pending = resolveCheatsUrl(gameId, title, consoleName).then(r => {
        if(r.final) readyUrl = r.url; else failed = true;
        return r;
      });
      return pending;
    }
    start();

    btn.addEventListener('click', () => {
      if(readyUrl){ window.open(readyUrl, '_blank', 'noopener'); return; }
      if(busy) return;
      busy = true;
      const idleHtml = btn.innerHTML;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.innerHTML = '<span class="cheats-spinner" aria-hidden="true"></span>Finding cheats…';
      // Open the tab first (still inside the tap), then send it to the page once we know where.
      const tab = window.open('', '_blank');
      try{ if(tab) tab.document.write('<title>Finding cheats…</title><body style="font-family:sans-serif;background:#15121f;color:#eee;padding:24px">Finding cheats…</body>'); }catch(e){}
      (failed ? start() : pending).then(r => {
        if(tab && !tab.closed){ tab.location.href = r.url; } else { window.open(r.url, '_blank'); }
      }).finally(() => {
        busy = false;
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.innerHTML = idleHtml;
      });
    });
  }

  // --- Game guides (manually imported — never fetched automatically; see
  // the "Game Guide" panel in the game profile for why) ---
  function guideKey(gameId){
    return `guide:${creds.username.trim().toLowerCase()}:${gameId}`;
  }
  async function loadGuide(gameId){
    try{
      const r = await window.storage.get(guideKey(gameId), false);
      if(r && r.value) return JSON.parse(r.value);
    }catch(e){ /* none imported yet */ }
    return null;
  }
  async function saveGuide(gameId, guide){
    try{ await window.storage.set(guideKey(gameId), JSON.stringify(guide), false); }
    catch(e){ /* non-fatal */ }
  }
  async function deleteGuide(gameId){
    try{ await window.storage.delete(guideKey(gameId), false); }catch(e){}
  }
  function readFileAsText(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('Could not read file'));
      r.readAsText(file);
    });
  }
  function readFileAsDataURL(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('Could not read file'));
      r.readAsDataURL(file);
    });
  }
  // Strips anything that could execute when an imported HTML guide is later
  // rendered — <script> tags, inline event handlers, javascript: URLs. This
  // runs on every HTML import regardless of source, since a guide file is
  // just an arbitrary file the person picked off their device.
  function sanitizeGuideHtml(rawHtml){
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    doc.querySelectorAll('script,style,link,meta').forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(attr => {
        const n = attr.name.toLowerCase();
        // Author colours/backgrounds assume a white page; on the reader's
        // black background they render text invisible.
        if(n === 'style' || n === 'color' || n === 'bgcolor' || n === 'text' || n === 'background') el.removeAttribute(attr.name);
        if(n.startsWith('on')) el.removeAttribute(attr.name);
        if((n === 'href' || n === 'src') && /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
      });
    });
    return doc.body ? doc.body.innerHTML : rawHtml;
  }
  async function importGuideFile(gameId, file){
    const name = file.name || 'guide';
    const ext = (name.split('.').pop() || '').toLowerCase();
    let kind, content;
    if(ext === 'pdf'){
      kind = 'pdf';
      content = await readFileAsDataURL(file);
    }else if(ext === 'html' || ext === 'htm'){
      kind = 'html';
      content = sanitizeGuideHtml(await readFileAsText(file));
    }else{
      // .txt, .md, or anything unrecognized — plain text is the safest
      // default, and matches how GameFAQs guides are almost always shared
      kind = 'text';
      content = await readFileAsText(file);
    }
    const guide = { filename: name, kind, content, scrollFrac: 0, savedAt: Date.now() };
    await saveGuide(gameId, guide);
    return guide;
  }

  // --- Saved base ROMs (for the ROM patching feature below) ---
  // Stored as a raw { filename, bytes: Uint8Array } via structured clone —
  // deliberately NOT JSON-stringified like everything else here, since
  // base64-encoding a multi-megabyte ROM would bloat it by another third
  // for no reason. IndexedDB stores typed arrays natively.
  function romKey(gameId){
    return `rom:${creds.username.trim().toLowerCase()}:${gameId}`;
  }
  async function saveRom(gameId, filename, bytes){
    await window.storage.set(romKey(gameId), { filename, bytes }, false);
  }
  async function loadRom(gameId){
    try{
      const r = await window.storage.get(romKey(gameId), false);
      if(r && r.value) return r.value; // { filename, bytes }
    }catch(e){ /* none saved */ }
    return null;
  }
  async function deleteRom(gameId){
    try{ await window.storage.delete(romKey(gameId), false); }catch(e){}
  }

  // --- Manually added ("wishlist") games ---
  // Keyed by a normalized (lowercase, trimmed) username so that reconnecting
  // with different capitalization — RA logins are case-insensitive — can't
  // silently land on a different storage slot and appear empty.
  function manualGamesKey(){
    return `ra-manual-games:${creds.username.trim().toLowerCase()}`;
  }

  async function loadManualGames(){
    try{
      const r = await window.storage.get(manualGamesKey(), false);
      if(r && r.value) return JSON.parse(r.value);
    }catch(e){ /* not found under the normalized key — check the old format below */ }

    // Fallback for games saved before this key was normalized, keyed by the
    // exact username string as originally typed.
    try{
      const legacyKey = `ra-manual-games:${creds.username}`;
      if(legacyKey !== manualGamesKey()){
        const r = await window.storage.get(legacyKey, false);
        if(r && r.value){
          const migrated = JSON.parse(r.value);
          await saveManualGames(migrated); // re-save under the normalized key going forward
          return migrated;
        }
      }
    }catch(e){ /* nothing under the old key either */ }

    return [];
  }
  async function saveManualGames(list){
    try{ await window.storage.set(manualGamesKey(), JSON.stringify(list), false); }
    catch(e){ /* non-fatal */ }
  }

  async function removeManualGame(gameId){
    return enqueueTask(async () => {
      libraryData = libraryData.filter(g => g.GameID !== gameId);
      const manual = await loadManualGames();
      await saveManualGames(manual.filter(g => g.GameID !== gameId));
      renderSystemChips();
      renderLibrary();
      renderByYear();
    });
  }

  // --- Console + game list lookups, for manually adding a game ---
  async function getConsoleList(){
    const cacheKey = 'ra-consoles';
    try{
      const r = await window.storage.get(cacheKey, false);
      if(r && r.value){
        const parsed = JSON.parse(r.value);
        if(Date.now() - parsed.ts < 30 * 24 * 60 * 60 * 1000) return parsed.data;
      }
    }catch(e){ /* not cached yet */ }

    const data = await raFetch('API_GetConsoleIDs.php', {});
    try{ await window.storage.set(cacheKey, JSON.stringify({ data, ts: Date.now() }), false); }catch(e){}
    return data;
  }

  async function getGameListForConsole(consoleId){
    const cacheKey = `ra-gamelist:${consoleId}`;
    try{
      const r = await window.storage.get(cacheKey, false);
      if(r && r.value){
        const parsed = JSON.parse(r.value);
        if(Date.now() - parsed.ts < 7 * 24 * 60 * 60 * 1000) return parsed.data;
      }
    }catch(e){ /* not cached yet */ }

    const data = await raFetch('API_GetGameList.php', { i: consoleId, f: 1 });
    try{ await window.storage.set(cacheKey, JSON.stringify({ data, ts: Date.now() }), false); }catch(e){}
    return data;
  }

  // --- RAWG ratings (optional) ---
  // RAWG auths with a plain API key as a URL query param, and — unlike RA —
  // actually supports CORS for direct browser calls, so this tries direct
  // first and only falls back to proxies if that fails.
  let rawgCreds = null; // { apiKey }, lazy-loaded

  async function loadRawgCreds(){
    try{
      const r = await window.storage.get('rawg-credentials', false);
      if(r && r.value) return JSON.parse(r.value);
    }catch(e){ /* not set up yet */ }
    return null;
  }
  async function saveRawgCreds(apiKey){
    try{ await window.storage.set('rawg-credentials', JSON.stringify({ apiKey }), false); }
    catch(e){ /* non-fatal */ }
  }
  async function removeRawgCreds(){
    rawgCreds = null;
    try{ await window.storage.delete('rawg-credentials', false); }catch(e){ /* non-fatal */ }
  }

  async function rawgGet(url){
    function raceFirstSuccess(promises){
      return new Promise((resolve, reject) => {
        let remaining = promises.length;
        const errors = [];
        promises.forEach(p => {
          p.then(resolve, (err) => {
            errors.push(err && err.message ? err.message : String(err));
            remaining--;
            if(remaining === 0) reject(new Error(errors.join('; ')));
          });
        });
      });
    }

    async function attempt(label, run){
      let res;
      try{ res = await run(); }
      catch(networkErr){ throw new Error(`${label}: blocked (${networkErr.message})`); }
      if(!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
      let data;
      try{ data = await res.json(); }
      catch(e){ throw new Error(`${label}: response wasn't valid JSON`); }
      return data;
    }

    try{
      return await attempt('direct', () => fetch(url));
    }catch(directErr){ /* fall through to proxies */ }

    return raceFirstSuccess([
      attempt('allorigins', () => fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url))),
      attempt('codetabs',   () => fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url))),
      attempt('corsproxy',  () => fetch('https://corsproxy.io/?url=' + encodeURIComponent(url))),
      attempt('thingproxy', () => fetch('https://thingproxy.freeboard.io/fetch/' + url)),
      attempt('corseu',     () => fetch('https://cors.eu.org/' + url)),
    ]);
  }

  async function fetchRawgRatingLive(title){
    if(!rawgCreds) rawgCreds = await loadRawgCreds();
    if(!rawgCreds || !rawgCreds.apiKey) return null;

    const url = `https://api.rawg.io/api/games?key=${encodeURIComponent(rawgCreds.apiKey)}&search=${encodeURIComponent(title)}&page_size=5`;
    const json = await rawgGet(url);
    const results = (json && json.results) || [];
    if(results.length === 0) return null;

    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Prefer RAWG's real Metacritic score when they have one on file; fall
    // back to RAWG's own community rating (scaled 0-5 -> 0-100) otherwise —
    // common for older/retro titles Metacritic never covered. Critically,
    // RAWG returns rating:0 / metacritic:0 for games with NO data yet, not
    // null — so those need to be treated as "nothing here", not a real 0.
    function extractScore(g){
      if(g.metacritic != null && g.metacritic > 0){
        return { score: g.metacritic, metacritic: true };
      }
      if(g.rating != null && g.rating > 0 && Number(g.ratings_count) > 0){
        return { score: g.rating * 20, metacritic: false };
      }
      return null;
    }

    // Try the exact title match first, but if THAT entry has no usable score,
    // check the other results the search returned before giving up entirely —
    // sometimes the exact match is a barely-populated RAWG entry while a
    // closely related listing among the top results has real review data.
    const exact = results.find(r => norm(r.name) === norm(title));
    const ordered = exact ? [exact, ...results.filter(r => r !== exact)] : results;

    for(const g of ordered){
      const extracted = extractScore(g);
      if(extracted){
        return {
          score: Math.round(extracted.score),
          metacritic: extracted.metacritic,
          matchedName: g.name,
        };
      }
    }
    return null;
  }

  async function getRawgRating(title, forceRefresh){
    const cacheKey = `rawg-rating:${title.toLowerCase()}`;
    if(!forceRefresh){
      try{
        const r = await window.storage.get(cacheKey, false);
        if(r && r.value){
          const parsed = JSON.parse(r.value);
          const isStaleZeroBug = parsed.data && parsed.data.score === 0; // fixed bug artifact — never a real score
          const ttl = parsed.data ? 30 * 24 * 60 * 60 * 1000 : 10 * 60 * 1000;
          if(!isStaleZeroBug && Date.now() - parsed.ts < ttl) return parsed.data;
        }
      }catch(e){ /* not cached yet */ }
    }

    let data = null;
    try{ data = await fetchRawgRatingLive(title); }
    catch(e){
      data = null;
      console.error(`RAWG lookup failed for "${title}":`, e.message);
    }

    try{ await window.storage.set(cacheKey, JSON.stringify({ data, ts: Date.now() }), false); }
    catch(e){ /* non-fatal */ }
    return data;
  }

  // ============================================================================
  // SECTION — Dashboard, library table & year-view rendering
  // ============================================================================
  // --- Rendering ---
  function renderProfile(p){
    lastProfile = p;

    // Both computed stats below are derived from the library data this app
    // already pulls (RA's public API has no direct field for either) — so
    // they're only accurate once library data has loaded; renderProfile()
    // gets called again after that finishes to fill these in for real.
    let unlocksLabel = '—';
    let startedBeatenLabel = '—';
    if(libraryData && libraryData.length > 0){
      let casualUnlocks = 0, hardcoreUnlocks = 0;
      let startedCasual = 0, beatenCasual = 0;
      let startedHardcore = 0, beatenHardcore = 0;
      libraryData.forEach(g => {
        if(g.customConsole) return; // manually-tracked, non-RA games never count toward RA stats
        const awarded = Number(g.NumAwarded || 0);
        const hardcore = Number(g.NumAwardedHardcore || 0);
        casualUnlocks += Math.max(0, awarded - hardcore);
        hardcoreUnlocks += hardcore;
        if(awarded > 0){
          startedCasual++;
          if(g.HighestAwardKind) beatenCasual++;
        }
        if(hardcore > 0){
          startedHardcore++;
          if(g.HighestAwardKind === 'beaten-hardcore' || g.HighestAwardKind === 'mastered') beatenHardcore++;
        }
      });
      const unlocks = statsMode === 'hardcore' ? hardcoreUnlocks : casualUnlocks;
      const started = statsMode === 'hardcore' ? startedHardcore : startedCasual;
      const beaten = statsMode === 'hardcore' ? beatenHardcore : beatenCasual;
      unlocksLabel = unlocks.toLocaleString();
      startedBeatenLabel = started > 0 ? ((beaten / started) * 100).toFixed(2) + '%' : '0%';
    }

    // Real hardcore/softcore points from API_GetUserPoints.php — these are
    // disjoint totals RA tracks directly (NOT TotalPoints minus softcore;
    // that undercounts, since hardcore points aren't a subset of TotalPoints
    // the way the profile endpoint's field naming might suggest).
    const points = userPoints
      ? (statsMode === 'hardcore' ? Number(userPoints.Points || 0) : Number(userPoints.SoftcorePoints || 0))
      : (statsMode === 'hardcore' ? null : Number(p.TotalSoftcorePoints || 0)); // fallback casual-only, before the points endpoint has loaded
    const pointsLabel = points == null ? '—' : points.toLocaleString();
    const modeColor = statsMode === 'hardcore' ? 'var(--gold)' : 'var(--teal)';
    const ptsLabel = statsMode === 'hardcore' ? 'hardcore pts' : 'casual pts';
    const unlocksLbl = statsMode === 'hardcore' ? 'achievements unlocked (hardcore)' : 'achievements unlocked (casual)';

    $('#profile-hero').innerHTML = `
      <img class="avatar" src="${imgUrl(p.UserPic)}" alt="${p.User}">
      <div class="who">
        <h2>${p.User}</h2>
        <p class="motto">${p.Motto ? p.Motto : 'Member since ' + (parseRADate(p.MemberSince) ? parseRADate(p.MemberSince).toLocaleDateString() : '—')}</p>
      </div>
      <div class="stat-row">
        <div class="stat"><div class="num" style="color:${modeColor}">${pointsLabel}</div><div class="lbl">${ptsLabel}</div></div>
        <div class="stat"><div class="num" style="color:${modeColor}">${unlocksLabel}</div><div class="lbl">${unlocksLbl}</div></div>
        <div class="stat"><div class="num" style="color:${modeColor}">${startedBeatenLabel}</div><div class="lbl">started games beaten</div></div>
      </div>
    `;
  }

  function awardPill(kind){
    if(statsMode === 'hardcore'){
      // From a hardcore-only lens, softcore-earned completions don't count —
      // only games actually beaten/mastered in hardcore mode show as done.
      if(kind === 'mastered') return '<span class="pill pill-gold">Mastered</span>';
      if(kind === 'beaten-hardcore') return '<span class="pill pill-gold">Beaten (HC)</span>';
      return '<span class="pill pill-muted">In progress</span>';
    }
    const map = {
      'mastered':        { label: 'Mastered',    cls: 'pill-teal' },
      'completed':       { label: 'Mastered',    cls: 'pill-teal' },
      'beaten-hardcore': { label: 'Beaten (HC)',  cls: 'pill-gold' },
      'beaten-softcore': { label: 'Beaten',       cls: 'pill-teal' },
    };
    const m = map[kind];
    if(!m) return '<span class="pill pill-muted">In progress</span>';
    return `<span class="pill ${m.cls}">${m.label}</span>`;
  }

  function renderRecentGames(games){
    const el = $('#recent-games');
    if(!games || games.length === 0){ el.innerHTML = '<div class="empty">No recently played games found.</div>'; return; }
    el.innerHTML = games.slice(0, 12).map(g => {
      const total = Number(g.NumPossibleAchievements || g.AchievementsTotal || 0);
      const earned = statsMode === 'hardcore' ? Number(g.NumAchievedHardcore || 0) : Number(g.NumAchieved || 0);
      const pct = total ? Math.round((earned/total)*100) : 0;
      const est = estHoursCache[g.GameID];
      const hoursHtml = est
        ? `<span class="val" style="color:var(--gold)">${est.real ? '' : '≈ '}${formatDuration(est)}</span>`
        : 'estimating…';
      return `
        <div class="cart" data-game-id="${g.GameID}">
          <img class="art" src="${imgUrl(g.ImageIcon)}" alt="${g.Title}">
          <div class="body">
            <p class="title">${g.Title}</p>
            <p class="console">${g.ConsoleName}</p>
            <div class="progress-track"><div class="progress-fill ${pct>=100?'complete':''} ${statsMode==='hardcore'?'hardcore':''}" style="width:${pct}%"></div></div>
            <div class="prog-lbl"><span>${earned}/${total}</span><span>${pct}%</span></div>
            <div class="hours">${hoursHtml}</div>
          </div>
        </div>
      `;
    }).join('');
    el.querySelectorAll('.cart').forEach(card => {
      card.addEventListener('click', () => openGameModal(Number(card.getAttribute('data-game-id'))));
    });
  }

  function renderUnlocks(list){
    const el = $('#recent-unlocks');
    if(!list || list.length === 0){ el.innerHTML = '<div class="empty">No unlocks in the last few days. Go play something!</div>'; return; }
    el.innerHTML = list.slice(0, 20).map(a => {
      const isHardcore = Number(a.HardcoreMode) === 1;
      return `
      <div class="unlock">
        <div class="unlock-row">
          <img src="${imgUrl('/Badge/' + a.BadgeName + '.png')}" alt="">
          <div class="info">
            <p class="t">${a.Title}</p>
            <p class="g">${a.GameTitle}</p>
          </div>
          ${isHardcore ? '<span class="pill pill-muted">HC</span>' : ''}
          <div class="pts" style="color:${isHardcore ? 'var(--muted)' : 'var(--teal)'}">${a.Points}</div>
          <div class="when">${timeAgo(a.Date)}</div>
        </div>
        <p class="unlock-desc">${a.Description || 'No description available.'}</p>
      </div>
    `;
    }).join('');
    el.querySelectorAll('.unlock').forEach(row => {
      row.addEventListener('click', () => row.classList.toggle('expanded'));
    });
  }

  function renderSystemChips(){
    const chipRow = $('#system-chips');
    const counts = {};
    const source = activeTab === 'year'
      ? libraryData.filter(g => {
          if(g.customConsole) return g.manualBeaten && g.manualBeatenDate;
          if(!g.HighestAwardKind || !g.HighestAwardDate) return false;
          if(statsMode === 'hardcore') return g.HighestAwardKind === 'beaten-hardcore' || g.HighestAwardKind === 'mastered';
          return true;
        })
      : libraryData;
    source.forEach(g => { counts[g.ConsoleName] = (counts[g.ConsoleName] || 0) + 1; });
    const systems = Object.keys(counts).sort((a,b) => counts[b] - counts[a]);

    if(systems.length === 0){ chipRow.innerHTML = ''; return; }

    const chips = ['All', ...systems];
    chipRow.innerHTML = chips.map(sys => `
      <button class="chip ${sys === systemFilter ? 'active' : ''}" data-sys="${sys}">
        ${sys}${sys === 'All' ? '' : ` (${counts[sys]})`}
      </button>
    `).join('');

    chipRow.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        systemFilter = chip.getAttribute('data-sys');
        renderSystemChips();
        renderLibrary();
        renderByYear();
      });
    });
  }

  function renderLibrary(){
    const wrap = $('#lib-table-wrap');
    libraryData.forEach(g => { g.estHours = (estHoursCache[g.GameID] && estHoursCache[g.GameID].hours) ?? -1; });
    const searchVal = ($('#lib-search').value || '').toLowerCase();
    let rows = libraryData.filter(g =>
      g.Title.toLowerCase().includes(searchVal) &&
      (systemFilter === 'All' || g.ConsoleName === systemFilter)
    );

    const { key, dir } = librarySort;
    rows = rows.slice().sort((a,b) => {
      let av = a[key], bv = b[key];
      if(typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if(av < bv) return dir === 'asc' ? -1 : 1;
      if(av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });

    $('#lib-count').textContent = rows.length ? `(${rows.length})` : '';

    if(rows.length === 0){ wrap.innerHTML = '<div class="empty">No games match.</div>'; return; }

    wrap.innerHTML = `
      <table class="lib-table">
        <thead><tr>
          <th data-key="Title">Game</th>
          <th data-key="HighestAwardKind">Award</th>
          <th data-key="pct">Progress</th>
          <th data-key="estHours" title="In-progress games: estimated active playtime. Beaten/completed games: time from first unlock to the award.">Playtime</th>
          <th data-key="lastPlayed">Last played</th>
        </tr></thead>
        <tbody>
          ${rows.map(g => {
            const isCustom = g.customConsole === true;
            const est = estHoursCache[g.GameID];
            const earned = Number(g.NumAwarded || 0);
            const hoursLabel = isCustom ? '—' : (est ? formatDuration(est, true) : '…');
            const hoursColor = 'var(--gold)';
            const awardCell = isCustom
              ? (g.manualBeaten ? '<span class="pill pill-teal">Beaten</span>' : '<span class="pill pill-muted">In progress</span>')
              : awardPill(g.HighestAwardKind);
            const isHardcoreMode = statsMode === 'hardcore';
            const awardedForMode = isHardcoreMode ? Number(g.NumAwardedHardcore || 0) : Number(g.NumAwarded || 0);
            const pctForMode = Number(g.MaxPossible) ? Math.round((awardedForMode / Number(g.MaxPossible)) * 100) : 0;
            const progressCell = isCustom
              ? '<span style="color:var(--muted);font-size:0.75rem;">—</span>'
              : `
                <div class="bar">
                  <div class="progress-track"><div class="progress-fill ${pctForMode>=100?'complete':''} ${isHardcoreMode?'hardcore':''}" style="width:${pctForMode}%"></div></div>
                </div>
                <span style="font-family:'Space Mono',monospace;font-size:0.6875rem;color:var(--muted)">${awardedForMode}/${g.MaxPossible} · ${pctForMode}%</span>
              `;
            const lastPlayedLabel = isCustom
              ? (g.manualBeatenDate ? new Date(g.manualBeatenDate).toLocaleDateString() : 'Never')
              : (g.lastPlayed ? timeAgo(g.lastPlayed) : 'Never');
            return `
            <tr data-game-id="${g.GameID}">
              <td><div class="g-title"><img src="${imgUrl(g.ImageIcon)}" alt=""><span>${g.Title}</span>${g.manual ? `<button class="manual-remove" data-remove-id="${g.GameID}" title="Remove">✕</button>` : ''}</div></td>
              <td>${awardCell}</td>
              <td>${progressCell}</td>
              <td style="font-family:'Space Mono',monospace;font-size:0.75rem;color:${hoursColor}">${hoursLabel}</td>
              <td style="color:var(--muted);font-size:0.75rem;">${lastPlayedLabel}</td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll('th[data-key]').forEach(th => {
      th.addEventListener('click', () => {
        const k = th.getAttribute('data-key');
        librarySort.dir = (librarySort.key === k && librarySort.dir === 'desc') ? 'asc' : 'desc';
        librarySort.key = k;
        renderLibrary();
      });
    });
    wrap.querySelectorAll('tbody tr').forEach(row => {
      row.addEventListener('click', () => openGameModal(Number(row.getAttribute('data-game-id'))));
    });
    wrap.querySelectorAll('.manual-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeManualGame(Number(btn.getAttribute('data-remove-id')));
      });
    });
  }

  function renderByYear(){
    const el = $('#year-wrap');
    const raBeaten = libraryData.filter(g => {
      if(g.customConsole || !g.HighestAwardKind || !g.HighestAwardDate) return false;
      if(systemFilter !== 'All' && g.ConsoleName !== systemFilter) return false;
      if(statsMode === 'hardcore'){
        return g.HighestAwardKind === 'beaten-hardcore' || g.HighestAwardKind === 'mastered';
      }
      return true;
    });
    const manualBeaten = libraryData.filter(g =>
      g.customConsole && g.manualBeaten && g.manualBeatenDate &&
      (systemFilter === 'All' || g.ConsoleName === systemFilter)
    );
    const done = [...raBeaten, ...manualBeaten];
    if(done.length === 0){
      el.innerHTML = '<div class="empty">No completions yet — beat or master a game and it\'ll show up here.</div>';
      return;
    }

    const casualFirst = { 'beaten-softcore': 0, 'completed': 1, 'beaten-hardcore': 2, 'mastered': 3 };
    const byYear = {};
    done.forEach(g => {
      let year;
      if(g.customConsole){
        const d = new Date(g.manualBeatenDate);
        if(isNaN(d.getTime())) return;
        year = d.getFullYear();
      }else{
        const parsed = parseRADate(g.HighestAwardDate);
        if(!parsed) return;
        year = parsed.getFullYear();
      }
      if(!byYear[year]) byYear[year] = [];
      byYear[year].push(g);
    });

    const years = Object.keys(byYear).sort((a,b) => b - a);
    el.innerHTML = years.map(year => {
      const games = byYear[year].slice().sort((a,b) =>
        (casualFirst[a.HighestAwardKind] ?? (a.customConsole ? -1 : 9)) - (casualFirst[b.HighestAwardKind] ?? (b.customConsole ? -1 : 9))
      );
      return `
        <div class="year-group">
          <div class="year-heading">${year} <span class="n">${games.length} completion${games.length===1?'':'s'}</span></div>
          <div class="year-icons">
            ${games.map(g => `
              <div class="year-item" data-game-id="${g.GameID}" title="${g.Title}">
                <img src="${imgUrl(g.ImageIcon)}" alt="">
                <div class="yt">${g.Title}</div>
                ${g.customConsole ? '<span class="pill pill-teal">Beaten</span>' : awardPill(g.HighestAwardKind)}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
    el.querySelectorAll('.year-item').forEach(item => {
      item.addEventListener('click', () => openGameModal(Number(item.getAttribute('data-game-id'))));
    });
  }

  function showError(msg){
    $('#connect-error').innerHTML = `<div class="error-box">${msg}</div>`;
  }

  // ============================================================================
  // SECTION — Game detail modal (manually-added games)
  // ============================================================================
  // --- Game detail modal ---
  async function getGameExtended(gameId){
    if(gameExtendedCache[gameId]) return gameExtendedCache[gameId];

    const cacheKey = `ra-gameinfo:${gameId}`;
    try{
      const r = await window.storage.get(cacheKey, false);
      if(r && r.value){
        const parsed = JSON.parse(r.value);
        if(Date.now() - parsed.ts < 7 * 24 * 60 * 60 * 1000){
          gameExtendedCache[gameId] = parsed.data;
          return parsed.data;
        }
      }
    }catch(e){ /* not cached yet */ }

    const data = await raFetch('API_GetGameExtended.php', { i: gameId });
    gameExtendedCache[gameId] = data;
    try{ await window.storage.set(cacheKey, JSON.stringify({ data, ts: Date.now() }), false); }catch(e){ /* non-fatal */ }
    return data;
  }

  function findGameLocal(gameId){
    return libraryData.find(g => g.GameID === gameId) || recentGamesData.find(g => g.GameID === gameId) || null;
  }

  async function attachRawgLookup(gameId, title, card){
    if(!rawgCreds) rawgCreds = await loadRawgCreds();
    if(!rawgCreds){
      const note = card.querySelector('.modal-note');
      if(note) note.insertAdjacentHTML('afterend', `<p class="rawg-setup-note"><a id="rawg-setup-link">Set up RAWG</a> to show review scores here.</p>`);
      const link = card.querySelector('#rawg-setup-link');
      if(link) link.addEventListener('click', () => { closeGameModal(); openRawgModal(); });
    }else{
      const badge = card.querySelector('#rawg-badge');
      if(badge) badge.innerHTML = `<span class="rawg-score tier-muted">…</span>`;

      const runRawgLookup = (force) => {
        getRawgRating(title, force).then(rating => {
          if(card.dataset.gameId !== String(gameId)) return; // modal moved on to another game
          const badgeEl = card.querySelector('#rawg-badge');
          if(!badgeEl) return;

          const label = rating ? String(rating.score) : 'N/A';
          const tier = !rating ? 'tier-muted' : rating.score >= 80 ? 'tier-green' : rating.score >= 50 ? 'tier-yellow' : 'tier-red';
          badgeEl.innerHTML = `<span class="rawg-score ${tier}" id="rawg-retry" title="Tap to look up again">${label}</span>`;

          const retryEl = card.querySelector('#rawg-retry');
          if(retryEl){
            retryEl.style.cursor = 'pointer';
            retryEl.addEventListener('click', () => {
              badgeEl.innerHTML = `<span class="rawg-score tier-muted">…</span>`;
              runRawgLookup(true);
            });
          }
        });
      };
      runRawgLookup(false);
    }
  }

  async function updateManualBeatenStatus(gameId, beaten, dateStr){
    return enqueueTask(async () => {
      const idx = libraryData.findIndex(g => g.GameID === gameId);
      if(idx === -1) return;
      libraryData[idx] = { ...libraryData[idx], manualBeaten: beaten, manualBeatenDate: beaten ? dateStr : null };

      const manual = await loadManualGames();
      const manualIdx = manual.findIndex(g => g.GameID === gameId);
      if(manualIdx !== -1){
        manual[manualIdx] = { ...manual[manualIdx], manualBeaten: beaten, manualBeatenDate: beaten ? dateStr : null };
        await saveManualGames(manual);
      }
      renderLibrary();
      renderByYear();
    });
  }

  function renderCustomGameModal(gameId, local, card){
    const boxArt = imgUrl(local.ImageBoxArt || local.ImageIcon || '');
    card.querySelector('.modal-art').src = boxArt;

    let releasedLabel = '—';
    if(local.released){
      const d = new Date(local.released);
      releasedLabel = isNaN(d.getTime()) ? local.released : d.toLocaleDateString();
    }
    const beatenDateValue = local.manualBeatenDate || '';

    card.querySelector('.modal-body').innerHTML = `
      <h2>${local.Title}</h2>
      <p class="sub">${local.ConsoleName}</p>

      <div class="modal-meta">
        <div class="mi"><div class="k">GENRE</div><div class="v">${local.genre || '—'}</div></div>
        <div class="mi"><div class="k">RELEASED</div><div class="v">${releasedLabel}</div></div>
      </div>

      <div class="modal-progress">
        <div class="row"><span>Progress</span><span style="color:var(--muted)">—</span></div>
        <div class="row"><span>Playtime</span><span style="color:var(--muted)">—</span></div>
        <div class="row"><span>Status</span><span>${local.manualBeaten ? '<span class="pill pill-teal">Beaten</span>' : '<span class="pill pill-muted">In progress</span>'}</span></div>
      </div>

      <div class="field" style="text-align:left;margin-bottom:14px;">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-family:inherit; font-size:0.8125rem; color:var(--text);">
          <input type="checkbox" id="manual-beaten-checkbox" ${local.manualBeaten ? 'checked' : ''} style="width:16px;height:16px;">
          <span>Mark as beaten</span>
        </label>
        <div id="manual-beaten-date-wrap" style="margin-top:10px; ${local.manualBeaten ? '' : 'display:none;'}">
          <label>Date beaten</label>
          <input type="date" id="manual-beaten-date" value="${beatenDateValue}">
        </div>
      </div>

      <button class="btn-view-achievements" id="modal-guide-btn"><span class="arrow">▸</span> Game Guide</button>
      <div class="guide-panel" id="modal-guide-panel" style="display:none;"></div>

      <button class="btn-view-achievements" id="modal-cheats-btn"><span class="arrow">↗</span> Need Cheats?</button>

      ${isCartridgeConsole(local.ConsoleName) ? `
      <button class="btn-view-achievements" id="modal-patch-btn"><span class="arrow">▸</span> ROM Hacks</button>
      <div class="guide-panel" id="modal-patch-panel" style="display:none;"></div>
      ` : ''}

      <div class="modal-links">
        <a href="https://howlongtobeat.com/?q=${encodeURIComponent(local.Title)}" target="_blank" rel="noopener">Search HowLongToBeat ↗</a>
      </div>

      <p class="modal-note">Not on RetroAchievements — tracked manually, and not included in any RetroAchievements-based stats. Ratings via <a href="https://rawg.io" target="_blank" rel="noopener" style="color:var(--teal)">RAWG</a>.</p>
    `;

    const checkbox = card.querySelector('#manual-beaten-checkbox');
    const dateWrap = card.querySelector('#manual-beaten-date-wrap');
    const dateInput = card.querySelector('#manual-beaten-date');

    checkbox.addEventListener('change', async () => {
      dateWrap.style.display = checkbox.checked ? 'block' : 'none';
      if(checkbox.checked && !dateInput.value){
        dateInput.value = new Date().toISOString().slice(0, 10);
      }
      await updateManualBeatenStatus(gameId, checkbox.checked, dateInput.value || null);
    });
    dateInput.addEventListener('change', async () => {
      if(checkbox.checked){
        await updateManualBeatenStatus(gameId, true, dateInput.value || null);
      }
    });

    attachRawgLookup(gameId, local.Title, card);
    setupGameGuideUI(gameId, local.Title, card, local.ConsoleID);
    setupCheatsUI(gameId, local.Title, card, local.ConsoleName);
    if(isCartridgeConsole(local.ConsoleName)) setupRomPatchUI(gameId, local.Title, card, local.ConsoleName);
  }


// ==============================================================================
// SECTION — Game detail modal (official RA games) + everything after it
// (box art zoom viewer, add game, RAWG settings, data export/import,
// install banner, pull-to-refresh, hamburger menu incl. text size, tabs,
// and the startup sequence that kicks the app off)
// ==============================================================================

  let openAchievementsGameId = null; // gameId whose achievements panel is currently rendered in the modal, if any — lets the hardcore toggle refresh it in place without re-fetching
  let openBeatenAchievementsGameId = null; // same, for the Beaten Achievements panel

  async function openGameModal(gameId){
    const card = $('#modal-card');
    const local = findGameLocal(gameId);
    card.dataset.gameId = gameId;
    openAchievementsGameId = null;
    openBeatenAchievementsGameId = null;
    $('#modal-backdrop').classList.add('open');
    card.innerHTML = `
      <button class="modal-close" id="modal-close-btn">✕</button>
      <div class="modal-art-wrap">
        <img class="modal-art" src="" alt="">
        <div class="rawg-badge-row"><span id="rawg-badge"></span></div>
      </div>
      <div class="modal-body"><div class="loading">Loading game info</div></div>
    `;
    $('#modal-close-btn').addEventListener('click', closeGameModal);

    if(local && local.customConsole){
      renderCustomGameModal(gameId, local, card);
      return;
    }

    let ext;
    try{
      ext = await getGameExtended(gameId);
    }catch(e){
      if(card.dataset.gameId !== String(gameId)) return;
      card.querySelector('.modal-body').innerHTML = `<div class="error-box">Could not load game details: ${e.message}</div>`;
      return;
    }
    if(card.dataset.gameId !== String(gameId)) return; // user moved on to another game while this loaded

    const title = ext.Title || (local && local.Title) || 'Unknown game';
    const console_ = ext.ConsoleName || (local && local.ConsoleName) || '—';
    const genre = ext.Genre || '—';
    const developer = ext.Developer || '—';
    const publisher = ext.Publisher || '—';
    const released = ext.Released ? parseRADate(ext.Released) : null;
    const releasedLabel = released ? released.toLocaleDateString(undefined, { year:'numeric', month:'long', day: ext.ReleasedAtGranularity === 'year' ? undefined : 'numeric' }) : '—';
    const boxArt = imgUrl(ext.ImageBoxArt || (local && local.ImageIcon));

    const totalAch = Number(ext.NumAchievements || (local && (local.MaxPossible || local.NumPossibleAchievements)) || 0);

    const isHardcoreMode = statsMode === 'hardcore';
    const earned = local ? (isHardcoreMode ? Number(local.NumAwardedHardcore ?? 0) : Number(local.NumAwarded ?? local.NumAchieved ?? 0)) : 0;
    const pct = totalAch ? Math.round((earned/totalAch)*100) : 0;
    const est = estHoursCache[gameId];
    const awardKind = local ? local.HighestAwardKind : null;

    const raUrl = `https://retroachievements.org/game/${gameId}`;
    const hltbUrl = `https://howlongtobeat.com/?q=${encodeURIComponent(title)}`;

    card.querySelector('.modal-art').src = boxArt;
    card.dataset.gameId = gameId;
    card.querySelector('.modal-body').innerHTML = `
      <h2>${title}</h2>
      <p class="sub">${console_}</p>

      <div class="modal-meta">
        <div class="mi"><div class="k">GENRE</div><div class="v">${genre}</div></div>
        <div class="mi"><div class="k">RELEASED</div><div class="v">${releasedLabel}</div></div>
        <div class="mi"><div class="k">DEVELOPER</div><div class="v">${developer}</div></div>
        <div class="mi"><div class="k">PUBLISHER</div><div class="v">${publisher}</div></div>
      </div>

      <div class="modal-progress">
        <div class="row"><span>Your progress</span><span>${earned}/${totalAch || '?'} · ${pct}%</span></div>
        <div class="row"><span>Status</span><span>${awardPill(awardKind)}</span></div>
        <div class="row"><span>${est && est.real ? 'Playtime' : (est && est.beaten ? 'Time to beat' : 'Est. playtime')}</span><span style="color:var(--gold)">${est ? formatDuration(est) : '—'}</span></div>
      </div>

      <button class="btn-view-achievements" id="modal-view-ach-btn"><span class="arrow">▸</span> View Achievements</button>
      <div class="achievements-list" id="modal-achievements" style="display:none;"></div>

      <button class="btn-view-achievements" id="modal-view-beaten-ach-btn"><span class="arrow">▸</span> Beaten Achievements</button>
      <div class="achievements-list" id="modal-beaten-achievements" style="display:none;"></div>

      <button class="btn-view-achievements" id="modal-guide-btn"><span class="arrow">▸</span> Game Guide</button>
      <div class="guide-panel" id="modal-guide-panel" style="display:none;"></div>

      <button class="btn-view-achievements" id="modal-cheats-btn"><span class="arrow">↗</span> Need Cheats?</button>

      ${isCartridgeConsole(console_) ? `
      <button class="btn-view-achievements" id="modal-patch-btn"><span class="arrow">▸</span> ROM Hacks</button>
      <div class="guide-panel" id="modal-patch-panel" style="display:none;"></div>
      ` : ''}

      <div class="modal-links">
        <a href="${raUrl}" target="_blank" rel="noopener">RetroAchievements page ↗</a>
        <a href="${hltbUrl}" target="_blank" rel="noopener">Search HowLongToBeat ↗</a>
      </div>

      <p class="modal-note">Ratings via <a href="https://rawg.io" target="_blank" rel="noopener" style="color:var(--teal)">RAWG</a>.</p>
    `;

    attachRawgLookup(gameId, title, card);
    setupGameGuideUI(gameId, title, card, ext.ConsoleID || (local && local.ConsoleID));
    setupCheatsUI(gameId, title, card, console_);
    if(isCartridgeConsole(console_)) setupRomPatchUI(gameId, title, card, console_);

    const achBtn = card.querySelector('#modal-view-ach-btn');
    const achWrap = card.querySelector('#modal-achievements');
    let achLoaded = false;
    achBtn.addEventListener('click', async () => {
      const nowOpen = achWrap.style.display === 'none';
      achWrap.style.display = nowOpen ? 'flex' : 'none';
      achWrap.style.flexDirection = 'column';
      achBtn.classList.toggle('open', nowOpen);
      if(nowOpen && !achLoaded){
        achLoaded = true;
        achWrap.innerHTML = '<div class="achievements-list-loading">Loading achievements…</div>';
        try{
          const list = await getAchievementsList(gameId);
          if(card.dataset.gameId !== String(gameId)) return; // user moved on
          achWrap.innerHTML = renderAchievementsList(list, statsMode === 'hardcore');
          openAchievementsGameId = gameId;
        }catch(e){
          if(card.dataset.gameId !== String(gameId)) return;
          achWrap.innerHTML = `<div class="achievements-list-loading">Could not load achievements: ${e.message}</div>`;
          achLoaded = false; // allow retry on next click
        }
      }
    });

    const beatenAchBtn = card.querySelector('#modal-view-beaten-ach-btn');
    const beatenAchWrap = card.querySelector('#modal-beaten-achievements');
    let beatenAchLoaded = false;
    beatenAchBtn.addEventListener('click', async () => {
      const nowOpen = beatenAchWrap.style.display === 'none';
      beatenAchWrap.style.display = nowOpen ? 'flex' : 'none';
      beatenAchWrap.style.flexDirection = 'column';
      beatenAchBtn.classList.toggle('open', nowOpen);
      if(nowOpen && !beatenAchLoaded){
        beatenAchLoaded = true;
        beatenAchWrap.innerHTML = '<div class="achievements-list-loading">Loading achievements…</div>';
        try{
          const list = await getAchievementsList(gameId);
          if(card.dataset.gameId !== String(gameId)) return; // user moved on
          beatenAchWrap.innerHTML = renderBeatenAchievementsList(list, statsMode === 'hardcore');
          openBeatenAchievementsGameId = gameId;
        }catch(e){
          if(card.dataset.gameId !== String(gameId)) return;
          beatenAchWrap.innerHTML = `<div class="achievements-list-loading">Could not load achievements: ${e.message}</div>`;
          beatenAchLoaded = false; // allow retry on next click
        }
      }
    });
  }

  function closeGameModal(){
    $('#modal-backdrop').classList.remove('open');
    openAchievementsGameId = null;
    openBeatenAchievementsGameId = null;
    closeGuideReader();
  }

  // --- Box art pinch-to-zoom viewer ---
  // Installed/fullscreen PWAs generally block native page pinch-zoom, so this
  // gives the box art its own dedicated zoom/pan using Pointer Events (works
  // for touch and mouse alike). Tap/click the box art to open it.
  (function(){
    const overlay = $('#img-zoom-overlay');
    const img = $('#img-zoom-target');
    const closeBtn = $('#img-zoom-close');
    const hint = $('#img-zoom-hint');
    if(!overlay || !img || !closeBtn) return;

    const MIN_SCALE = 1, MAX_SCALE = 5;
    let scale = 1, panX = 0, panY = 0;
    const pointers = new Map();
    let lastDist = null, lastMid = null, dragStart = null, lastTapTime = 0;

    function applyTransform(){
      img.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    }
    function resetTransform(){
      scale = 1; panX = 0; panY = 0; applyTransform();
    }
    function openZoom(src){
      if(!src) return;
      img.src = src;
      resetTransform();
      overlay.classList.add('open');
      if(hint) hint.classList.remove('hidden');
    }
    function closeZoom(){
      overlay.classList.remove('open');
      pointers.clear();
      lastDist = null; lastMid = null; dragStart = null;
    }

    // Any box art image in the game profile opens the zoom viewer.
    document.addEventListener('click', (e) => {
      const art = e.target.closest('.modal-art');
      if(art && art.src) openZoom(art.src);
    });

    closeBtn.addEventListener('click', closeZoom);
    overlay.addEventListener('click', (e) => { if(e.target === overlay) closeZoom(); });

    function dist(a, b){ return Math.hypot(a.x - b.x, a.y - b.y); }
    function mid(a, b){ return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

    img.addEventListener('pointerdown', (e) => {
      img.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if(pointers.size === 1){
        const now = Date.now();
        if(now - lastTapTime < 320){ // double-tap: toggle zoom
          if(scale > MIN_SCALE){ resetTransform(); }
          else { scale = 2.5; applyTransform(); }
          lastTapTime = 0;
        } else {
          lastTapTime = now;
        }
        dragStart = { x: e.clientX - panX, y: e.clientY - panY };
      } else if(pointers.size === 2){
        if(hint) hint.classList.add('hidden');
        const pts = [...pointers.values()];
        lastDist = dist(pts[0], pts[1]);
        lastMid = mid(pts[0], pts[1]);
        dragStart = null;
      }
    });

    img.addEventListener('pointermove', (e) => {
      if(!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if(pointers.size === 2){
        const pts = [...pointers.values()];
        const newDist = dist(pts[0], pts[1]);
        const newMid = mid(pts[0], pts[1]);
        if(lastDist){
          const factor = newDist / lastDist;
          scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
          panX += newMid.x - lastMid.x;
          panY += newMid.y - lastMid.y;
          applyTransform();
        }
        lastDist = newDist; lastMid = newMid;
      } else if(pointers.size === 1 && dragStart && scale > MIN_SCALE){
        panX = e.clientX - dragStart.x;
        panY = e.clientY - dragStart.y;
        applyTransform();
      }
    });

    function endPointer(e){
      pointers.delete(e.pointerId);
      if(pointers.size < 2){ lastDist = null; lastMid = null; }
      if(pointers.size === 1){
        const [p] = pointers.values();
        dragStart = { x: p.x - panX, y: p.y - panY };
      } else if(pointers.size === 0){
        dragStart = null;
        if(scale <= MIN_SCALE + 0.02) resetTransform();
      }
    }
    img.addEventListener('pointerup', endPointer);
    img.addEventListener('pointercancel', endPointer);

    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape' && overlay.classList.contains('open')) closeZoom();
    });
  })();

  $('#modal-backdrop').addEventListener('click', (e) => {
    if(e.target.id === 'modal-backdrop') closeGameModal();
  });
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){ closeGameModal(); closeAddGameModal(); closeRawgModal(); closeRaConnectModal(); closeDataModal(); closeDropdownMenu(); }
  });

  // ============================================================================
  // SECTION — Add game (manual + RAWG search)
  // ============================================================================
  // --- Add game manually ---
  function rankGames(games, query){
    const q = query.trim().toLowerCase();
    if(!q || !games) return [];
    return games
      .map(g => {
        const title = String(g.Title ?? g.title ?? '').toLowerCase();
        let score = -1;
        if(title === q) score = 3;
        else if(title.startsWith(q)) score = 2;
        else if(title.includes(q)) score = 1;
        return { g, score, len: title.length };
      })
      .filter(x => x.score >= 0)
      .sort((a, b) => (b.score - a.score) || (a.len - b.len))
      .slice(0, 20)
      .map(x => x.g);
  }

  async function openAddGameModal(){
    $('#addgame-backdrop').classList.add('open');
    $('#addgame-title').value = '';
    $('#addgame-custom-console').value = '';
    $('#addgame-custom-console-field').style.display = 'none';
    $('#addgame-results').innerHTML = '';
    const sel = $('#addgame-system');
    sel.innerHTML = '<option>Loading systems…</option>';
    try{
      const consoles = await getConsoleList();
      const sorted = (consoles || [])
        .map(c => ({ id: c.ID ?? c.id, name: c.Name ?? c.name }))
        .filter(c => c.id != null && c.name)
        .sort((a, b) => a.name.localeCompare(b.name));
      sel.innerHTML = sorted.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
        + `<option value="__custom__">Other system (not on RetroAchievements)…</option>`;
    }catch(e){
      sel.innerHTML = '<option value="">Could not load systems</option><option value="__custom__">Other system (not on RetroAchievements)…</option>';
    }
  }

  $('#addgame-system').addEventListener('change', () => {
    const isCustom = $('#addgame-system').value === '__custom__';
    $('#addgame-custom-console-field').style.display = isCustom ? 'block' : 'none';
  });

  function closeAddGameModal(){
    $('#addgame-backdrop').classList.remove('open');
  }

  async function searchAddGame(){
    const sel = $('#addgame-system');
    const consoleId = sel.value;
    const query = $('#addgame-title').value.trim();
    const resultsEl = $('#addgame-results');

    if(consoleId === '__custom__'){
      const customConsole = $('#addgame-custom-console').value.trim();
      if(!query || !customConsole){
        resultsEl.innerHTML = '<div class="ag-empty">Enter a console name and a title.</div>';
        return;
      }
      resultsEl.innerHTML = '<div class="loading">Searching RAWG</div>';
      try{
        const results = await searchRawgForAddGame(query);
        if(results.length === 0){
          resultsEl.innerHTML = '<div class="ag-empty">No matching games found on RAWG.</div>';
          return;
        }
        resultsEl.innerHTML = results.map(g => `
          <div class="ag-result" data-rawg-id="${g.id}">
            <img src="${g.background_image || ''}" alt="">
            <span class="t">${g.name}</span>
            <span class="n">${g.released ? g.released.slice(0,4) : ''}</span>
          </div>
        `).join('');
        resultsEl.querySelectorAll('.ag-result').forEach(el => {
          el.addEventListener('click', () => {
            const id = Number(el.getAttribute('data-rawg-id'));
            const match = results.find(g => g.id === id);
            if(match) addManualGameFromRawg(match, customConsole);
          });
        });
      }catch(e){
        resultsEl.innerHTML = `<div class="error-box">Search failed: ${e.message}</div>`;
      }
      return;
    }

    if(!query || !consoleId){
      resultsEl.innerHTML = '<div class="ag-empty">Pick a system and enter a title.</div>';
      return;
    }
    resultsEl.innerHTML = '<div class="loading">Searching</div>';
    try{
      const list = await getGameListForConsole(consoleId);
      const matches = rankGames(list, query);
      if(matches.length === 0){
        resultsEl.innerHTML = '<div class="ag-empty">No matching games found on this system.</div>';
        return;
      }
      const consoleName = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : '';
      resultsEl.innerHTML = matches.map(g => {
        const id = g.ID ?? g.id;
        const title = g.Title ?? g.title;
        const icon = g.ImageIcon ?? g.imageIcon;
        const numAch = g.NumAchievements ?? g.numAchievements ?? 0;
        return `
          <div class="ag-result" data-game-id="${id}">
            <img src="${imgUrl(icon)}" alt="">
            <span class="t">${title}</span>
            <span class="n">${numAch} ach.</span>
          </div>
        `;
      }).join('');
      resultsEl.querySelectorAll('.ag-result').forEach(el => {
        el.addEventListener('click', () => {
          const id = Number(el.getAttribute('data-game-id'));
          const match = matches.find(g => Number(g.ID ?? g.id) === id);
          if(match) addManualGame(match, consoleId, consoleName);
        });
      });
    }catch(e){
      resultsEl.innerHTML = `<div class="error-box">Search failed: ${e.message}</div>`;
    }
  }

  async function searchRawgForAddGame(title){
    if(!rawgCreds) rawgCreds = await loadRawgCreds();
    if(!rawgCreds || !rawgCreds.apiKey) throw new Error('RAWG isn\'t set up — add a key under RAWG Ratings in the menu first.');
    const url = `https://api.rawg.io/api/games?key=${encodeURIComponent(rawgCreds.apiKey)}&search=${encodeURIComponent(title)}&page_size=10`;
    const json = await rawgGet(url);
    return (json && json.results) || [];
  }

  async function addManualGame(g, consoleId, consoleName){
    return enqueueTask(async () => {
      const gameId = Number(g.ID ?? g.id);
      if(libraryData.some(x => x.GameID === gameId)){
        closeAddGameModal();
        return; // already tracked for real
      }
      const entry = {
        GameID: gameId,
        Title: g.Title ?? g.title,
        ConsoleID: Number(consoleId),
        ConsoleName: g.ConsoleName ?? g.consoleName ?? consoleName,
        ImageIcon: g.ImageIcon ?? g.imageIcon,
        MaxPossible: g.NumAchievements ?? g.numAchievements ?? 0,
        NumAwarded: 0,
        NumAwardedHardcore: 0,
        HighestAwardKind: null,
        HighestAwardDate: null,
        MostRecentAwardedDate: null,
        pct: 0,
        lastPlayed: null,
        manual: true,
      };
      libraryData = [...libraryData, entry];
      const manual = await loadManualGames();
      await saveManualGames([...manual, entry]);
      renderSystemChips();
      renderLibrary();
      renderByYear();
      closeAddGameModal();
    });
  }

  async function addManualGameFromRawg(rawgGame, customConsole){
    return enqueueTask(async () => {
      const gameId = -Date.now(); // synthetic, always negative — never collides with a real RA GameID
      if(libraryData.some(x => x.GameID === gameId)){
        closeAddGameModal();
        return;
      }
      const genre = (rawgGame.genres && rawgGame.genres.length) ? rawgGame.genres.map(g => g.name).join(', ') : null;
      const entry = {
        GameID: gameId,
        Title: rawgGame.name,
        ConsoleID: null,
        ConsoleName: customConsole,
        ImageIcon: rawgGame.background_image || null,
        ImageBoxArt: rawgGame.background_image || null,
        MaxPossible: 0,
        NumAwarded: 0,
        NumAwardedHardcore: 0,
        HighestAwardKind: null,
        HighestAwardDate: null,
        MostRecentAwardedDate: null,
        pct: 0,
        lastPlayed: null,
        manual: true,
        customConsole: true, // not on RA at all — no achievement data will ever exist for this entry
        genre: genre,
        released: rawgGame.released || null,
        manualBeaten: false,
        manualBeatenDate: null,
      };
      libraryData = [...libraryData, entry];
      const manual = await loadManualGames();
      await saveManualGames([...manual, entry]);
      renderSystemChips();
      renderLibrary();
      renderByYear();
      closeAddGameModal();
    });
  }

  $('#btn-add-game').addEventListener('click', openAddGameModal);
  $('#addgame-close-btn').addEventListener('click', closeAddGameModal);
  $('#addgame-backdrop').addEventListener('click', (e) => {
    if(e.target.id === 'addgame-backdrop') closeAddGameModal();
  });
  $('#addgame-search-btn').addEventListener('click', searchAddGame);
  $('#addgame-title').addEventListener('keydown', (e) => {
    if(e.key === 'Enter') searchAddGame();
  });

  // ============================================================================
  // SECTION — Settings modals & data export/import
  // ============================================================================
  // --- RAWG settings modal ---
  async function openRawgModal(){
    $('#rawg-backdrop').classList.add('open');
    $('#rawg-status').innerHTML = '';
    const existing = await loadRawgCreds();
    $('#rawg-api-key').value = existing ? existing.apiKey : '';
  }

  function closeRawgModal(){
    $('#rawg-backdrop').classList.remove('open');
  }

  // --- Data export/import ---
  function openDataModal(){
    $('#data-backdrop').classList.add('open');
    $('#data-status').innerHTML = '';
  }
  function closeDataModal(){
    $('#data-backdrop').classList.remove('open');
  }

  async function exportLocalData(){
    const entries = await window.storage._getAllRaw(); // [{key, value}, ...] — includes RA creds, RAWG key, manual games, caches
    const payload = {
      app: 'Game Log Tracker',
      exportedAt: new Date().toISOString(),
      version: 1,
      entries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game-log-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function importLocalData(file){
    const text = await file.text();
    let payload;
    try{ payload = JSON.parse(text); }
    catch(e){ throw new Error('That file isn\'t valid JSON.'); }
    if(!payload || !Array.isArray(payload.entries)){
      throw new Error('This doesn\'t look like a Game Log Tracker backup file.');
    }
    await window.storage._putAllRaw(payload.entries);
  }

  $('#btn-rawg-settings').addEventListener('click', openRawgModal);
  $('#rawg-close-btn').addEventListener('click', closeRawgModal);
  $('#rawg-backdrop').addEventListener('click', (e) => {
    if(e.target.id === 'rawg-backdrop') closeRawgModal();
  });

  $('#btn-data-settings-open').addEventListener('click', openDataModal);
  $('#data-close-btn').addEventListener('click', closeDataModal);
  $('#data-backdrop').addEventListener('click', (e) => {
    if(e.target.id === 'data-backdrop') closeDataModal();
  });
  $('#data-export-btn').addEventListener('click', async () => {
    const btn = $('#data-export-btn');
    const statusEl = $('#data-status');
    statusEl.innerHTML = '';
    btn.disabled = true; btn.textContent = 'Preparing download…';
    try{
      await exportLocalData();
      statusEl.innerHTML = '<p style="color:var(--teal);font-size:0.7812rem;margin-top:10px;">Backup downloaded.</p>';
    }catch(e){
      statusEl.innerHTML = `<div class="error-box">Export failed: ${e.message}</div>`;
    }finally{
      btn.disabled = false; btn.textContent = 'Download backup (.json)';
    }
  });
  $('#data-import-btn').addEventListener('click', () => {
    $('#data-import-file').click();
  });
  $('#data-import-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const statusEl = $('#data-status');
    statusEl.innerHTML = '<p style="color:var(--muted);font-size:0.7812rem;margin-top:10px;">Importing…</p>';
    try{
      await importLocalData(file);
      statusEl.innerHTML = '<p style="color:var(--teal);font-size:0.7812rem;margin-top:10px;">Import complete — reloading…</p>';
      setTimeout(() => window.location.reload(), 900);
    }catch(err){
      statusEl.innerHTML = `<div class="error-box">Import failed: ${err.message}</div>`;
    }finally{
      e.target.value = '';
    }
  });

  $('#rawg-save-btn').addEventListener('click', async () => {
    const apiKey = $('#rawg-api-key').value.trim();
    const statusEl = $('#rawg-status');
    if(!apiKey){
      statusEl.innerHTML = '<div class="error-box">Enter an API key.</div>';
      return;
    }

    const btn = $('#rawg-save-btn');
    btn.disabled = true; btn.textContent = 'Verifying…';
    statusEl.innerHTML = '';

    rawgCreds = { apiKey };
    await saveRawgCreds(apiKey);

    try{
      // No token exchange to verify against — run a real lookup instead.
      const result = await fetchRawgRatingLive('Super Mario Bros');
      if(!result) throw new Error('Key saved, but a test lookup came back empty — double-check the key is correct');
      statusEl.innerHTML = '<p style="color:var(--teal);font-size:0.7812rem;margin-top:10px;">Connected — ratings will show on game details from now on.</p>';
    }catch(e){
      statusEl.innerHTML = `<div class="error-box">Couldn't verify: ${e.message}</div>`;
    }finally{
      btn.disabled = false; btn.textContent = 'Save';
    }
  });

  $('#rawg-remove-btn').addEventListener('click', async () => {
    await removeRawgCreds();
    $('#rawg-api-key').value = '';
    $('#rawg-status').innerHTML = '<p style="color:var(--muted);font-size:0.7812rem;margin-top:10px;">RAWG key removed — ratings will stop showing until a new key is saved.</p>';
  });

  async function loadAll(opts){
    const forcePlaytimeRefresh = !!(opts && opts.forceRecentPlaytime);
    await enqueueTask(async () => {
    $('#recent-games').innerHTML = '<div class="loading">Loading</div>';
    $('#recent-unlocks').innerHTML = '<div class="loading">Loading</div>';
    $('#lib-table-wrap').innerHTML = '<div class="loading">Loading</div>';

    try{
      const profile = await raFetch('API_GetUserProfile.php', {});
      renderProfile(profile);
    }catch(e){
      $('#profile-hero').innerHTML = `<div class="error-box">Could not load profile: ${e.message}</div>`;
    }

    try{
      const points = await raFetch('API_GetUserPoints.php', {});
      userPoints = points; // { Points (hardcore-only), SoftcorePoints }
      if(lastProfile) renderProfile(lastProfile); // refresh now that real points are in
    }catch(e){
      console.error('Failed to load user points:', e);
    }

    try{
      const recent = await raFetch('API_GetUserRecentlyPlayedGames.php', { c: 12 });
      recentGamesData = recent || [];
      renderRecentGames(recentGamesData);
    }catch(e){
      $('#recent-games').innerHTML = `<div class="error-box">Could not load recently played games: ${e.message}</div>`;
    }

    try{
      const unlocks = await raFetch('API_GetUserRecentAchievements.php', { m: 4320 });
      renderUnlocks(unlocks);
    }catch(e){
      $('#recent-unlocks').innerHTML = `<div class="error-box">Could not load recent unlocks: ${e.message}</div>`;
    }

    try{
      const progress = await raFetch('API_GetUserCompletionProgress.php', { c: 500 });
      const results = (progress && progress.Results) || [];
      libraryData = results.map(g => ({
        ...g,
        pct: Number(g.MaxPossible) ? Math.round((Number(g.NumAwarded)/Number(g.MaxPossible))*100) : 0,
        lastPlayed: g.LastPlayed || g.MostRecentAwardedDate || null,
      }));

      // Merge in manually-added games not yet actually played; drop any that
      // now show up for real (the user has since earned progress on them).
      const realIds = new Set(libraryData.map(g => g.GameID));
      const manual = await loadManualGames();
      const stillManual = manual.filter(g => !realIds.has(g.GameID));
      if(stillManual.length !== manual.length) await saveManualGames(stillManual);
      libraryData = [...libraryData, ...stillManual];
      if(lastProfile) renderProfile(lastProfile);
    }catch(e){
      console.error('Failed to load live library data:', e);
      // Still show whatever's manually tracked — a proxy hiccup shouldn't
      // make the wishlist disappear for this session. (renderLibrary() runs
      // right after this block regardless, so no need to touch the DOM here.)
      try{
        libraryData = await loadManualGames();
      }catch(e2){
        libraryData = [];
      }
      if(libraryData.length === 0){
        $('#lib-table-wrap').innerHTML = `<div class="error-box">Could not load your library: ${e.message}</div>`;
        $('#year-wrap').innerHTML = `<div class="error-box">Could not load completions: ${e.message}</div>`;
        return;
      }
      if(lastProfile) renderProfile(lastProfile);
    }

    try{ renderSystemChips(); }
    catch(e){ console.error('renderSystemChips failed:', e); }

    try{ renderLibrary(); }
    catch(e){
      console.error('renderLibrary failed:', e);
      $('#lib-table-wrap').innerHTML = `<div class="error-box">Couldn't display your library: ${e.message}</div>`;
    }

    try{ renderByYear(); }
    catch(e){
      console.error('renderByYear failed:', e);
      $('#year-wrap').innerHTML = `<div class="error-box">Couldn't display beaten by year: ${e.message}</div>`;
    }
    }); // end of queued task — everything above this point is fully serialized

    // On an explicit refresh, force-refetch playtime for anything played in
    // the last 24h, bypassing the normal 12h cache — a play session started
    // right after that cache was last written could otherwise sit stale for
    // up to ~12h, and 24h gives full coverage of that gap with room to
    // spare. Cheap either way: this only ever touches the recently-played
    // list (≤12 games), never the whole library.
    let forceIds;
    if(forcePlaytimeRefresh){
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      forceIds = new Set(
        recentGamesData
          .filter(g => { const d = parseRADate(g.LastPlayed); return d && d.getTime() >= cutoff; })
          .map(g => g.GameID)
      );
    }

    loadEstimatedHoursFor([...recentGamesData, ...libraryData], () => {
      renderRecentGames(recentGamesData);
      try{ renderLibrary(); }catch(e){ console.error('renderLibrary failed:', e); }
    }, forceIds);
  }

  function updateRaConnectionView(){
    const hasRa = !!creds;
    $('#ra-placeholder').style.display = hasRa ? 'none' : 'block';
    $('#ra-content').style.display = hasRa ? 'block' : 'none';
  }
  function showDashboard(){
    $('#dashboard').style.display = 'block';
    $('#menu-wrap').style.display = 'block';
    updateRaConnectionView();
  }

  async function connectToRa(username, apiKey){
    creds = { username, apiKey };
    try{
      const profile = await raFetch('API_GetUserProfile.php', {});
      if(!profile || !profile.User){ throw new Error('Unexpected response — check your username and key.'); }
      await saveCreds(username, apiKey);
      showDashboard();
      loadAll();
      return true;
    }catch(e){
      creds = null;
      throw e;
    }
  }

  function openRaConnectModal(){
    $('#connect-error').innerHTML = '';
    $('#ra-connect-backdrop').classList.add('open');
  }
  function closeRaConnectModal(){
    $('#ra-connect-backdrop').classList.remove('open');
  }
  $('#btn-ra-connect-open').addEventListener('click', openRaConnectModal);
  $('#ra-connect-close-btn').addEventListener('click', closeRaConnectModal);
  $('#ra-connect-backdrop').addEventListener('click', (e) => {
    if(e.target.id === 'ra-connect-backdrop') closeRaConnectModal();
  });

  $('#btn-connect').addEventListener('click', async () => {
    const username = $('#in-user').value.trim();
    const apiKey = $('#in-key').value.replace(/\s+/g, '');
    $('#connect-error').innerHTML = '';
    if(!username || !apiKey){ showError('Enter both a username and an API key.'); return; }

    const btn = $('#btn-connect');
    btn.disabled = true; btn.textContent = 'Connecting…';
    try{
      await connectToRa(username, apiKey);
      closeRaConnectModal();
    }catch(e){
      showError(`Connection failed: ${e.message}. Double-check your username and Web API key.`);
    }finally{
      btn.disabled = false; btn.textContent = 'Connect';
    }
  });

  $('#btn-disconnect').addEventListener('click', async () => {
    creds = null;
    await clearCreds();
    updateRaConnectionView(); // stay on the dashboard shell — just drops back to the "connect RA" placeholder
  });
  $('#btn-hardcore-toggle').addEventListener('click', () => {
    statsMode = statsMode === 'hardcore' ? 'casual' : 'hardcore';
    $('#btn-hardcore-toggle').textContent = statsMode === 'hardcore' ? 'Switch to Casual Mode' : 'Switch to Hardcore Mode';
    if(lastProfile) renderProfile(lastProfile);
    renderRecentGames(recentGamesData);
    renderSystemChips();
    renderLibrary();
    renderByYear();
    if(openAchievementsGameId != null){
      const list = achievementsListCache[openAchievementsGameId];
      const achWrap = document.getElementById('modal-achievements');
      if(achWrap && list) achWrap.innerHTML = renderAchievementsList(list, statsMode === 'hardcore');
    }
    if(openBeatenAchievementsGameId != null){
      const list = achievementsListCache[openBeatenAchievementsGameId];
      const beatenAchWrap = document.getElementById('modal-beaten-achievements');
      if(beatenAchWrap && list) beatenAchWrap.innerHTML = renderBeatenAchievementsList(list, statsMode === 'hardcore');
    }
  });
  $('#lib-search').addEventListener('input', renderLibrary);

  // Custom pull-to-refresh: refreshes app data instead of the browser doing
  // a full native page reload (which was resetting in-memory state and
  // looking like it signed you out of RetroAchievements).
  (function(){
    let touchStartY = 0;
    let pulling = false;
    let currentPull = 0;
    const PULL_THRESHOLD = 70;
    const MAX_PULL = 100;

    const indicator = document.createElement('div');
    indicator.className = 'pull-refresh-indicator';
    indicator.textContent = 'Pull to refresh';
    document.body.insertBefore(indicator, document.body.firstChild);

    document.addEventListener('touchstart', (e) => {
      pulling = window.scrollY === 0 && !!creds && $('#dashboard').style.display === 'block';
      if(pulling) touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if(!pulling) return;
      const delta = e.touches[0].clientY - touchStartY;
      if(delta > 0 && window.scrollY === 0){
        currentPull = Math.min(delta, MAX_PULL);
        indicator.style.height = currentPull + 'px';
        indicator.textContent = currentPull > PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh';
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if(!pulling) return;
      pulling = false;
      if(currentPull > PULL_THRESHOLD){
        indicator.textContent = 'Refreshing…';
        Promise.resolve(loadAll({ forceRecentPlaytime: true })).finally(() => { indicator.style.height = '0px'; });
      } else {
        indicator.style.height = '0px';
      }
      currentPull = 0;
    }, { passive: true });
  })();

  function closeDropdownMenu(){
    $('#dropdown-menu').classList.remove('open');
  }
  $('#btn-menu').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#dropdown-menu').classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    const wrap = $('#menu-wrap');
    if(wrap && !wrap.contains(e.target)) closeDropdownMenu();
  });
  document.querySelectorAll('.dropdown-item:not(.dropdown-heading)').forEach(item => {
    item.addEventListener('click', closeDropdownMenu);
  });
  $('#btn-ra-heading').addEventListener('click', (e) => {
    e.stopPropagation();
    const submenu = $('#ra-submenu');
    const isOpen = submenu.style.display === 'block';
    submenu.style.display = isOpen ? 'none' : 'block';
    $('#ra-heading-arrow').textContent = isOpen ? '▸' : '▾';
  });

  // ============================================================================
  // SECTION — Hamburger menu: text size, tabs, and app startup
  // ============================================================================
  // --- App-wide text size ---
  // Every font-size in the stylesheet is in rem, relative to <html>'s font-size
  // (16px by default) — so scaling that one value scales all text in the app
  // together. Box art (and everything else sized in px/%/aspect-ratio rather
  // than rem) is completely unaffected.
  const TEXTSIZE_MIN = 80, TEXTSIZE_MAX = 160, TEXTSIZE_STEP = 10, TEXTSIZE_DEFAULT = 100, TEXTSIZE_BASE_PX = 16;
  const TEXTSIZE_KEY = 'app-text-size-pct';
  let textSizePct = TEXTSIZE_DEFAULT;

  function applyTextSize(){
    document.documentElement.style.fontSize = (TEXTSIZE_BASE_PX * textSizePct / 100) + 'px';
    $('#textsize-label').textContent = textSizePct + '%';
    $('#textsize-dec').disabled = textSizePct <= TEXTSIZE_MIN;
    $('#textsize-inc').disabled = textSizePct >= TEXTSIZE_MAX;
  }
  async function saveTextSize(){
    try{ await window.storage.set(TEXTSIZE_KEY, String(textSizePct), false); }catch(e){ /* non-fatal */ }
  }
  async function initTextSize(){
    try{
      const saved = await window.storage.get(TEXTSIZE_KEY, false);
      const n = saved ? parseInt(saved.value, 10) : NaN;
      if(!isNaN(n) && n >= TEXTSIZE_MIN && n <= TEXTSIZE_MAX) textSizePct = n;
    }catch(e){ /* non-fatal — falls back to 100% */ }
    applyTextSize();
  }
  initTextSize();

  $('#btn-textsize-heading').addEventListener('click', (e) => {
    e.stopPropagation();
    const submenu = $('#textsize-submenu');
    const isOpen = submenu.style.display === 'block';
    submenu.style.display = isOpen ? 'none' : 'block';
    $('#textsize-heading-arrow').textContent = isOpen ? '▸' : '▾';
  });
  $('#textsize-dec').addEventListener('click', (e) => {
    e.stopPropagation();
    textSizePct = Math.max(TEXTSIZE_MIN, textSizePct - TEXTSIZE_STEP);
    applyTextSize(); saveTextSize();
  });
  $('#textsize-inc').addEventListener('click', (e) => {
    e.stopPropagation();
    textSizePct = Math.min(TEXTSIZE_MAX, textSizePct + TEXTSIZE_STEP);
    applyTextSize(); saveTextSize();
  });
  $('#textsize-reset').addEventListener('click', (e) => {
    e.stopPropagation();
    textSizePct = TEXTSIZE_DEFAULT;
    applyTextSize(); saveTextSize();
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      const panel = $('#tab-' + tabName);
      if(!panel) return; // shouldn't happen, but never leave the UI in a half-switched state

      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      panel.classList.add('active');
      activeTab = tabName;
      $('#system-chips').classList.toggle('visible', tabName === 'library' || tabName === 'year');

      try{ renderSystemChips(); }
      catch(e){ console.error('renderSystemChips failed:', e); }
    });
  });

  // Restore RA credentials into memory if previously connected, and show
  // the dashboard right away — there's no login gate in front of it anymore.
  (async () => {
    showDashboard();
    const saved = await loadCreds();
    if(saved && saved.username && saved.apiKey){
      creds = saved;
      $('#in-user').value = saved.username;
      loadAll();
    }
    updateRaConnectionView();
  })();
