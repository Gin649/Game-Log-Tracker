// Game Details section in a game's profile: other players' typical playtime from
// RetroAchievements (for the mode you're in), a write-up from IGDB and the game's manual (manuals.js).

const PLAYTIME_TTL = 7 * 24 * 60 * 60 * 1000; // medians barely move
const PLAYTIME_MISS_TTL = 10 * 60 * 1000;
const DESCRIPTION_TTL = 30 * 24 * 60 * 60 * 1000;
const DESCRIPTION_MISS_TTL = 24 * 60 * 60 * 1000;

// Median times in seconds, for casual and hardcore players. RA calls the casual 100% a
// completion and the hardcore one a mastery; the profile labels both "time to master".
async function getPlaytimeStats(gameId){
  const cacheKey = `ra-playtime-stats:${gameId}`;
  try{
    const r = await window.storage.get(cacheKey, false);
    if(r && r.value){
      const parsed = JSON.parse(r.value);
      const has = parsed.stats && [parsed.stats.casual, parsed.stats.hardcore].some(m => m.beat || m.master);
      if(Date.now() - parsed.ts < (has ? PLAYTIME_TTL : PLAYTIME_MISS_TTL)) return parsed.stats;
    }
  }catch(e){ /* not cached yet */ }

  const data = await raFetch('API_GetGameProgression.php', { i: gameId });
  const secs = n => (Number(n) > 0 ? Number(n) : null);
  const count = n => (Number(n) > 0 ? Number(n) : 0);
  const stats = {
    casual: {
      beat: secs(data && data.MedianTimeToBeat), beatN: count(data && data.TimesUsedInBeatMedian),
      master: secs(data && data.MedianTimeToComplete), masterN: count(data && data.TimesUsedInCompletionMedian),
    },
    hardcore: {
      beat: secs(data && data.MedianTimeToBeatHardcore), beatN: count(data && data.TimesUsedInHardcoreBeatMedian),
      master: secs(data && data.MedianTimeToMaster), masterN: count(data && data.TimesUsedInMasteryMedian),
    },
  };
  try{ await window.storage.set(cacheKey, JSON.stringify({ stats, ts: Date.now() }), false); }catch(e){ /* non-fatal */ }
  return stats;
}

function cleanDescription(raw){
  let text = String(raw || '').replace(/\r/g, '').trim();
  // Text sources often add a Spanish copy after the English text, started by a line that just says "Español".
  const es = text.search(/\n\s*espa[ñn]ol\s*:?\s*(\n|$)/i);
  if(es > 0) text = text.slice(0, es).trim();
  text = tidyDescription(text);
  return text.length >= 40 ? text : null;
}

// Write-ups often have hard line breaks in the middle of sentences ("It's panic or" / "perish..."),
// which show up as stray short lines. A line break only stays when the line before it ends a
// sentence and the next one starts a new one; every other break becomes a space.
function tidyDescription(text){
  return String(text || '').replace(/\r/g, '').split(/\n{2,}/).map(para => {
    const lines = para.split('\n').map(l => l.trim()).filter(Boolean);
    let out = '';
    lines.forEach((line, i) => {
      if(i === 0){ out = line; return; }
      const endsSentence = /[.!?:)"'”’…]$/.test(out);
      const startsNew = /^[A-Z0-9"“'‘(\[¡¿]/.test(line);
      out += (endsSentence && startsNew ? '\n\n' : ' ') + line;
    });
    return out;
  }).filter(Boolean).join('\n\n');
}

function achievementType(a){
  return String((a && (a.Type || a.type)) || '').toLowerCase();
}

// RA's API doesn't report your own time to beat or master, so both come from your unlock
// dates. The beat time ends at the unlock that met the beaten requirements (every
// progression achievement plus a win condition). The master time uses your tracked
// playtime when RA has it, and an estimate otherwise.
async function getMyTimes(gameId){
  const list = await getAchievementsList(gameId);
  if(!list || !list.length) return null;
  try{ attachAchievementTypes(list, await getGameExtended(gameId)); }
  catch(e){ /* without the tags there is no beat time */ }
  const cached = estHoursCache[gameId];
  const real = cached && cached.real ? cached.hours : null;
  const snap = await readSnap(gameId);

  // Unlock dates in either mode. The share of unlocks made by the beat moment, scaled to
  // RA's real total playtime, gives a better estimate than the raw unlock gaps alone.
  const anyStamps = list
    .map(a => { const d = parseRADate(a.DateEarned || a.DateEarnedHardcore); return d ? d.getTime() : null; })
    .filter(t => t != null);
  const estTotal = estimateHoursFromTimestamps(anyStamps);

  const timesFor = (hard) => {
    const earned = list.map(a => {
      const d = parseRADate(hard ? a.DateEarnedHardcore : (a.DateEarned || a.DateEarnedHardcore));
      return d ? d.getTime() : null;
    });
    const out = { beat: null, master: null };

    const progression = [];
    const wins = [];
    list.forEach((a, i) => {
      const t = achievementType(a);
      if(t === 'progression') progression.push(earned[i]);
      else if(t === 'win_condition') wins.push(earned[i]);
    });
    const winTimes = wins.filter(t => t != null);
    const beaten = progression.length + wins.length > 0
      && !progression.includes(null)
      && (wins.length === 0 || winTimes.length > 0);
    const saved = snap && snap[hard ? 'beatHardcore' : 'beatCasual'];
    if(saved > 0){
      out.beat = { hours: saved, est: false };
    }else if(beaten){
      const beatAt = Math.max(...progression, wins.length ? Math.min(...winTimes) : -Infinity);
      const hours = estimateHoursFromTimestamps(anyStamps.filter(t => t <= beatAt));
      if(hours != null){
        out.beat = { hours: (real != null && estTotal) ? (hours / estTotal) * real : hours, est: true };
      }
    }

    const savedMaster = snap && snap[hard ? 'masterHardcore' : 'masterCasual'];
    if(savedMaster > 0){
      out.master = { hours: savedMaster, est: false };
    }else if(earned.every(t => t != null)){
      if(real != null){
        out.master = { hours: real, est: false };
      }else{
        const hours = estimateHoursFromTimestamps(earned);
        if(hours != null) out.master = { hours, est: true };
      }
    }
    return out;
  };

  return { casual: timesFor(false), hardcore: timesFor(true) };
}

function playtimeBox(label, seconds, players, mine){
  const value = seconds ? formatDuration({ hours: seconds / 3600 }, true) : '—';
  const n = players ? `${players} player${players === 1 ? '' : 's'}` : '';
  const you = mine
    ? `<div class="gd-you"><div class="gd-k">YOUR TIME</div><div class="gd-v">${mine.est ? '~' : ''}${formatDuration({ hours: mine.hours }, true)}</div></div>`
    : '';
  return `<div class="gd-box"><div class="gd-main"><div class="gd-k">${label}</div><div class="gd-v">${value}</div><div class="gd-n">${n}</div></div>${you}</div>`;
}

// The See more button: opens the rest of a long write-up and shows a ScreenScraper screenshot under the text. The
// screenshot is looked up only the first time it is opened, never when the profile opens.
function wireSeeMore(wrap, anchor, clampable, manualCtx){
  const more = wrap.querySelector('.gd-more');
  if(!more) return;
  if(clampable) anchor.classList.add('clamp');
  let shotEl = null, shotAsked = false;
  let open = false;
  more.addEventListener('click', () => {
    open = !open;
    if(clampable) anchor.classList.toggle('clamp', !open);
    more.textContent = open ? 'See less' : 'See more';
    if(shotEl) shotEl.style.display = open ? '' : 'none';
    if(open && !shotAsked && manualCtx && manualCtx.consoleName && !/^\s*~hack~/i.test(String(manualCtx.title || ''))){
      shotAsked = true;
      getScreenScraperInfo(manualCtx.title, manualCtx.consoleName, true).then(d => {
        if(!d || !d.shot || !more.isConnected) return;
        const img = new Image();
        img.className = 'gd-shot';
        img.alt = 'Screenshot';
        img.onload = () => {
          if(!more.isConnected) return;
          shotEl = img;
          if(!open) img.style.display = 'none'; // closed again while it loaded
          more.insertAdjacentElement('beforebegin', img);
        };
        img.src = d.shot;
      }).catch(() => {});
    }
  });
}

// aboutOnly: games tracked by hand (not on RA) have no playtime data, so only the write-up shows.
function renderGameDetails(wrap, stats, description, aboutOnly, manualCtx, mine, igdb){
  if(description) description = tidyDescription(description); // also fixes write-ups saved before this was added
  const hard = statsMode === 'hardcore';
  const m = (!aboutOnly && stats) ? (hard ? stats.hardcore : stats.casual) : null;
  const my = (!aboutOnly && mine) ? (hard ? mine.hardcore : mine.casual) : null;
  // Games RetroAchievements has no playtime for borrow IGDB's: a normal playthrough, and everything done.
  const ib = (aboutOnly && igdb && igdb.beat && (igdb.beat.normally || igdb.beat.completely)) ? igdb.beat : null;
  const hasTimes = !!(m && (m.beat || m.master)) || !!(my && (my.beat || my.master));

  if(!hasTimes && !ib && !description){
    wrap.innerHTML = `<div class="gd-empty">${aboutOnly ? 'No write-up available for this game yet.' : 'No details available for this game yet.'}</div><button class="gd-more">See more</button>`;
    wireSeeMore(wrap, wrap.querySelector('.gd-empty'), false, manualCtx);
    addManualSection(wrap, manualCtx);
    return;
  }

  let html = '';
  if(ib){
    html += `<div class="gd-head"><span class="gd-label">AVERAGE PLAYTIME</span><span class="gd-mode">IGDB</span></div>`;
    html += `<div class="gd-boxes">${playtimeBox('TIME TO BEAT', ib.normally, ib.count, null)}${playtimeBox('TIME TO 100%', ib.completely, ib.count, null)}</div>`;
  }
  if(!aboutOnly){
    html += `<div class="gd-head"><span class="gd-label">AVERAGE PLAYTIME</span><span class="gd-mode">${hard ? 'Hardcore' : 'Casual'}</span></div>`;
    html += hasTimes
      ? `<div class="gd-boxes">${playtimeBox('TIME TO BEAT', m && m.beat, m && m.beatN, my && my.beat)}${playtimeBox('TIME TO MASTER', m && m.master, m && m.masterN, my && my.master)}</div>`
      : '<div class="gd-empty">No playtime data yet.</div>';
  }

  if(description){
    html += `<div class="gd-label${aboutOnly && !ib ? '' : ' gd-about-label'}">ABOUT</div><div class="gd-about"></div>`;
  }
  html += '<button class="gd-more">See more</button>';
  wrap.innerHTML = html;

  const aboutEl = wrap.querySelector('.gd-about');
  if(aboutEl) aboutEl.textContent = description; // plain text, never parsed as HTML
  // long write-ups are cut short until See more; short ones (or none) only gain the screenshot
  wireSeeMore(wrap, aboutEl || wrap.querySelector('.gd-boxes:last-of-type') || null, !!(aboutEl && description.length > 280), manualCtx);
  addManualSection(wrap, manualCtx);
}

// ScreenScraper, asked through the app's Worker (which holds the ScreenScraper login). The answer for a game is kept in
// storage, a month when it was found and a day when it wasn't, so each game is only looked up once.
const SS_WORKER = 'https://ra-proxy.gin649.workers.dev';
const ssInfoPending = new Map(); // one lookup at a time per game, however many places ask
function getScreenScraperInfo(title, consoleName, needShot){
  if(!consoleName) return Promise.resolve(null);
  const clean = String(title).replace(/^(?:~[^~]*~\s*)+/, '').trim();
  const key = `ss3-info:${String(consoleName).toLowerCase()}:${clean.toLowerCase()}`;
  const pkey = needShot ? key + '|shot' : key;
  if(ssInfoPending.has(pkey)) return ssInfoPending.get(pkey);
  const p = (async () => {
    try{
      const r = await window.storage.get(key, false);
      if(r && r.value){
        const c = JSON.parse(r.value);
        // answers kept before screenshots were added are asked again, but only when a screenshot is wanted
        const stale = needShot && c.data && !('shot' in c.data);
        if(!stale && Date.now() - c.ts < (c.data ? 30 : 1) * 24 * 60 * 60 * 1000) return c.data;
      }
    }catch(e){}
    try{
      const res = await fetchWithTimeout(`${SS_WORKER}/ss/info?title=${encodeURIComponent(clean)}&system=${encodeURIComponent(consoleName)}`, 15000);
      if(!res.ok) return null; // busy or not set up: nothing is kept, so it is tried again next time
      const j = await res.json();
      const data = j && j.found ? { synopsis: j.synopsis || '', box: j.box || null, shot: j.screenshot || null } : null;
      try{ await window.storage.set(key, JSON.stringify({ data, ts: Date.now() }), false); }catch(e){}
      return data;
    }catch(e){ return null; }
  })();
  ssInfoPending.set(pkey, p);
  p.finally(() => ssInfoPending.delete(pkey));
  return p;
}

function getScreenScraperDescription(title, consoleName){
  return getScreenScraperInfo(title, consoleName).then(d => {
    const t = tidyDescription((d && d.synopsis) || '');
    return t.length >= 40 ? t : null;
  }).catch(() => null);
}

// Box art from ScreenScraper goes in place of the one the profile opened with, once it has loaded. Games that have none
// keep their own picture. A hack's art would be the original game's, so hacks keep theirs too.
function upgradeBoxArt(card, gameId, title, consoleName){
  const artEl = card.querySelector('.modal-art');
  if(artEl){ // what the picker needs when the cover is tapped
    card.dataset.boxTitle = title || '';
    card.dataset.boxConsole = consoleName || '';
    card.dataset.boxOriginal = artEl.getAttribute('src') || '';
  }
  // a cover you chose yourself always wins
  getBoxPick(gameId).then(url => {
    if(!url) return null;
    const art = card.querySelector('.modal-art');
    if(art && card.dataset.gameId === String(gameId)) art.src = url;
    return url;
  }).catch(() => null).then(picked => {
    if(picked) return;
    autoBoxArt(card, gameId, title, consoleName);
  });
}
function autoBoxArt(card, gameId, title, consoleName){
  if(/^\s*~hack~/i.test(String(title || ''))) return;
  getScreenScraperInfo(title, consoleName).then(d => {
    if(!d || !d.box) return;
    const img = new Image();
    img.onload = () => {
      if(card.dataset.gameId !== String(gameId)) return; // the profile moved on to another game
      const art = card.querySelector('.modal-art');
      if(art) art.src = d.box;
    };
    img.src = d.box;
  }).catch(() => {});
}

function setupGameDetailsUI(gameId, title, card, opts){
  const aboutOnly = !!(opts && opts.aboutOnly); // manual games: no RA playtime to fetch
  const manualCtx = { gameId, title, consoleName: opts && opts.consoleName };
  const btn = card.querySelector('#modal-details-btn');
  const wrap = card.querySelector('#modal-details');
  if(!btn || !wrap) return;

  // Start loading in the background shortly after the profile opens, so the data is usually
  // there by the time the section is tapped. Everything is cached, so this only costs
  // requests the first time a game is opened.
  let pending = null;
  let igdbPromise = null;
  const igdbInfo = () => igdbPromise || (igdbPromise = getIgdbInfo(title).catch(() => null));
  // The write-up comes from ScreenScraper first, then IGDB's summary.
  const igdbText = () => igdbInfo().then(i => {
    const t = i && i.summary ? tidyDescription(i.summary) : '';
    return t.length >= 40 ? t : null;
  }).catch(() => null);
  const descP = () => getScreenScraperDescription(title, opts && opts.consoleName)
    .then(d => d || igdbText())
    .catch(() => null);
  let descPromise = null;
  const load = () => pending || (pending = (descPromise = descP(), Promise.allSettled([
    aboutOnly ? Promise.resolve(null) : getPlaytimeStats(gameId),
    Promise.resolve(null),
    aboutOnly ? Promise.resolve(null) : getMyTimes(gameId),
    aboutOnly ? igdbInfo() : Promise.resolve(null),
  ])));
  setTimeout(load, 400);

  let loaded = false;
  btn.addEventListener('click', async () => {
    const nowOpen = wrap.style.display === 'none';
    wrap.style.display = nowOpen ? 'block' : 'none';
    btn.classList.toggle('open', nowOpen);
    if(!nowOpen || loaded) return;

    loaded = true;
    wrap.innerHTML = '<div class="achievements-list-loading">Loading details…</div>';
    const [statsRes, , mineRes, igdbRes] = await load();
    // The write-up can come late: wait a moment for it, then show the rest and fill it in when it arrives.
    const early = await Promise.race([descPromise, new Promise(r => setTimeout(() => r(undefined), 2500))]);
    if(card.dataset.gameId !== String(gameId)) return; // user moved on to another game
    if(statsRes.status === 'rejected') console.error('Playtime stats failed:', statsRes.reason && statsRes.reason.message);

    const stats = statsRes.status === 'fulfilled' ? statsRes.value : null;
    if(mineRes.status === 'rejected') console.error('Your times failed:', mineRes.reason && mineRes.reason.message);
    const mine = mineRes.status === 'fulfilled' ? mineRes.value : null;
    const igdb = igdbRes && igdbRes.status === 'fulfilled' ? igdbRes.value : null;
    const draw = (description) => renderGameDetails(wrap, stats, description, aboutOnly, manualCtx, mine, igdb);
    draw(early || null);
    if(early === undefined){
      descPromise.then(text => {
        if(text && card.dataset.gameId === String(gameId)) draw(text);
        else if(!stats && !igdb){ loaded = false; pending = null; }
      });
    }else if(!stats && !early && !igdb){ loaded = false; pending = null; } // all failed: try again next time it's opened
  });
}
