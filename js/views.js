// Dashboard, library, backlog, and beaten-by-year rendering.

// Dashboard, library table & year-view rendering
// Rendering
function renderProfile(p){
  lastProfile = p;

  // Both computed stats below are derived from the library data this app
  // already pulls (RA's public API has no direct field for either), so
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
        if(g.HighestAwardKind === 'completed' || g.HighestAwardKind === 'beaten-softcore') beatenCasual++;
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

  // Real hardcore/softcore points from API_GetUserPoints.php, these are
  // disjoint totals RA tracks directly (not TotalPoints minus softcore;
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

// The two modes are kept apart: hardcore shows only hardcore awards, casual only casual ones.
function awardCountsInMode(kind){
  if(statsMode === 'hardcore') return kind === 'mastered' || kind === 'beaten-hardcore';
  return kind === 'completed' || kind === 'beaten-softcore';
}

// Label and color class for a game's award in the current mode, or null when it has none.
function awardInfo(kind){
  if(!awardCountsInMode(kind)) return null;
  if(statsMode === 'hardcore'){
    return kind === 'mastered'
      ? { label: 'Mastered', cls: 'pill-gold' }
      : { label: 'Beaten', cls: 'pill-gold' };
  }
  return kind === 'completed'
    ? { label: 'Mastered', cls: 'pill-teal' }
    : { label: 'Beaten', cls: 'pill-teal' };
}

function awardPill(kind){
  const info = awardInfo(kind);
  if(!info) return '<span class="pill pill-muted">In progress</span>';
  return `<span class="pill ${info.cls}">${info.label}</span>`;
}

function renderRecentGames(games){
  const el = $('#recent-games');
  const shown = (games || []).filter(g => !isSubsetGame(g)); // subsets live in their base game's profile
  if(shown.length === 0){ el.innerHTML = '<div class="empty">No recently played games found.</div>'; return; }
  const libById = new Map(libraryData.map(x => [x.GameID, x]));
  el.innerHTML = shown.slice(0, 12).map(g => {
    const total = Number(g.NumPossibleAchievements || g.AchievementsTotal || 0);
    const earned = statsMode === 'hardcore' ? Number(g.NumAchievedHardcore || 0) : Number(g.NumAchieved || 0);
    const pct = total ? Math.round((earned/total)*100) : 0;
    const est = estHoursCache[g.GameID];
    const hoursHtml = est
      ? `<span class="val" style="color:var(--gold)">${est.real ? '' : '≈ '}${formatDuration(est)}</span>`
      : '<span class="pt-pending" title="Loading playtime…"></span>';
    // Beaten / Mastered label on the corner of the box art
    const lib = libById.get(g.GameID);
    const award = lib && isGameAwarded(lib) ? awardInfo(lib.HighestAwardKind) : null;
    const badge = award ? `<span class="pill pill-corner ${award.cls}">${award.label}</span>` : '';
    return `
        <div class="cart" data-game-id="${g.GameID}">
          <div class="art-wrap"><img class="art" src="${imgUrl(g.ImageIcon)}" alt="${g.Title}">${badge}</div>
          <div class="body">
            <p class="title">${g.Title}</p>
            <p class="console">${g.ConsoleName}</p>
            <div class="cart-progress-group">
              <div class="progress-track"><div class="progress-fill ${pct>=100?'complete':''} ${statsMode==='hardcore'?'hardcore':''}" style="width:${pct}%"></div></div>
              <div class="prog-lbl"><span>${earned}/${total}</span><span>${pct}%</span></div>
              <div class="hours">${hoursHtml}</div>
            </div>
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

// Console tabs can be put in your own order and renamed. Both are saved, and Library and Backlog share them.
let consoleOrder = [];       // ConsoleNames in the order you chose
let consoleNames = {};       // ConsoleName -> the name shown on its tab
let consolePrefsState = 0;   // 0 not loaded, 1 loading, 2 loaded
let chipEdit = false;        // reorder / rename mode
let chipEditTab = '';

async function loadConsolePrefs(){
  if(consolePrefsState) return;
  consolePrefsState = 1;
  try{
    const o = await window.storage.get('console-order', false);
    if(o && o.value) consoleOrder = JSON.parse(o.value) || [];
  }catch(e){ /* nothing saved yet */ }
  try{
    const n = await window.storage.get('console-names', false);
    if(n && n.value) consoleNames = JSON.parse(n.value) || {};
  }catch(e){ /* nothing saved yet */ }
  consolePrefsState = 2;
  try{ renderSystemChips(); }catch(e){ /* the next redraw will pick the saved order up */ }
}
function saveConsolePrefs(){
  try{ window.storage.set('console-order', JSON.stringify(consoleOrder), false); }catch(e){ /* non-fatal */ }
  try{ window.storage.set('console-names', JSON.stringify(consoleNames), false); }catch(e){ /* non-fatal */ }
}
const consoleLabel = sys => (consoleNames[sys] || sys);
const chipEsc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Your order first, then any console you haven't placed yet by number of games.
function orderedSystems(counts){
  const names = Object.keys(counts);
  const rank = n => { const i = consoleOrder.indexOf(n); return i === -1 ? Infinity : i; };
  return names.sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if(ra !== rb) return ra === Infinity ? 1 : rb === Infinity ? -1 : ra - rb;
    return counts[b] - counts[a];
  });
}

// Puts the visible consoles in the order given. They take the places those consoles already had in the saved
// order, so consoles that aren't on this tab keep theirs and Library and Backlog stay in step.
function applyConsoleOrder(arrangement){
  const full = consoleOrder.slice();
  arrangement.forEach(n => { if(!full.includes(n)) full.push(n); });
  const slots = [];
  full.forEach((n, i) => { if(arrangement.includes(n)) slots.push(i); });
  slots.forEach((slot, k) => { full[slot] = arrangement[k]; });
  consoleOrder = full;
  saveConsolePrefs();
}

// Drag a tab to a new place: hold it for a moment to pick it up (moving sooner scrolls the row), slide it, let go.
// A quick tap renames it instead.
let chipClickBlockedUntil = 0;
function wireChipDrag(chipRow, systems){
  const chips = Array.from(chipRow.querySelectorAll('.chip.edit'));
  let drag = null;
  chipRow.addEventListener('touchmove', (e) => { if(drag && drag.lifted) e.preventDefault(); }, { passive: false });
  chips.forEach((chip, idx) => {
    const place = () => {
      if(!drag || !drag.lifted) return;
      drag.chip.style.transform = `translateX(${(drag.x - drag.x0) + (chipRow.scrollLeft - drag.s0)}px)`;
    };
    chip.addEventListener('pointerdown', (e) => {
      if(drag) return;
      drag = { chip, idx, x0: e.clientX, y0: e.clientY, s0: chipRow.scrollLeft, lifted: false, id: e.pointerId, x: e.clientX, timer: null, scroller: null };
      drag.timer = setTimeout(() => {
        if(!drag) return;
        drag.lifted = true;
        chip.classList.add('lifted');
        try{ chip.setPointerCapture(drag.id); }catch(err){ /* non-fatal */ }
        drag.scroller = setInterval(() => { // slide the row when the finger is near either edge
          const r = chipRow.getBoundingClientRect();
          if(drag.x < r.left + 48) chipRow.scrollLeft -= 8;
          else if(drag.x > r.right - 48) chipRow.scrollLeft += 8;
          place();
        }, 16);
      }, 250);
    });
    chip.addEventListener('pointermove', (e) => {
      if(!drag || drag.chip !== chip) return;
      drag.x = e.clientX;
      if(!drag.lifted){
        if(Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 10){ clearTimeout(drag.timer); drag = null; }
        return;
      }
      place();
    });
    const end = (e) => {
      if(!drag || drag.chip !== chip) return;
      clearTimeout(drag.timer); clearInterval(drag.scroller);
      const d = drag; drag = null;
      if(!d.lifted) return; // a tap: the click that follows renames it
      chipClickBlockedUntil = Date.now() + 500; // letting go after a drag isn't a tap
      // where the picked-up tab ended up, compared with the middle of each of the others
      const shift = (d.x - d.x0) + (chipRow.scrollLeft - d.s0);
      const mid = c => c.offsetLeft + c.offsetWidth / 2;
      const target = mid(d.chip) + shift;
      const rest = chips.filter(c => c !== d.chip);
      const at = rest.filter(c => mid(c) < target).length;
      const next = systems.slice();
      const moved = next.splice(d.idx, 1)[0];
      next.splice(at, 0, moved);
      if(e.type === 'pointerup') applyConsoleOrder(next);
      renderSystemChips();
    };
    chip.addEventListener('pointerup', end);
    chip.addEventListener('pointercancel', end);
    chip.addEventListener('contextmenu', (e) => e.preventDefault());
    chip.addEventListener('click', () => { if(Date.now() >= chipClickBlockedUntil) renameConsoleTab(systems[idx]); }); // a tap, or the controller's confirm button
  });
}

function renameConsoleTab(sys){
  const old = document.getElementById('chip-rename'); if(old) old.remove();
  const pop = document.createElement('div');
  pop.id = 'chip-rename';
  pop.className = 'app-pop';
  pop.innerHTML = `<div class="app-pop-card">
    <div class="app-pop-title">Rename tab</div>
    <div class="app-pop-sub">${chipEsc(sys)}</div>
    <input type="text" id="chip-rename-input" value="${chipEsc(consoleLabel(sys))}" maxlength="40" style="width:100%;">
    <button class="btn-primary" id="chip-rename-save">Save</button>
    <button class="btn-ghost" id="chip-rename-reset">Use original name</button>
    <button class="btn-ghost" id="chip-rename-cancel">Cancel</button>
  </div>`;
  document.body.appendChild(pop);
  const done = () => { pop.remove(); renderSystemChips(); };
  pop.querySelector('#chip-rename-save').addEventListener('click', () => {
    const v = pop.querySelector('#chip-rename-input').value.trim();
    if(v && v !== sys) consoleNames[sys] = v; else delete consoleNames[sys];
    saveConsolePrefs(); done();
  });
  pop.querySelector('#chip-rename-reset').addEventListener('click', () => { delete consoleNames[sys]; saveConsolePrefs(); done(); });
  pop.querySelector('#chip-rename-cancel').addEventListener('click', () => pop.remove());
  pop.addEventListener('click', (e) => { if(e.target === pop) pop.remove(); });
}

function renderSystemChips(){
  const chipRow = $('#system-chips');
  if(!consolePrefsState) loadConsolePrefs();
  if(chipEdit && chipEditTab !== activeTab) chipEdit = false;
  const counts = {};
  const source = activeTab === 'year'
    ? libraryData.filter(g => {
        if(g.customConsole) return g.manualBeaten && g.manualBeatenDate;
        if(!g.HighestAwardKind || !g.HighestAwardDate) return false;
        return awardCountsInMode(g.HighestAwardKind);
      })
    : activeTab === 'backlog'
    ? libraryData.filter(isBacklogGame)
    : libraryData.filter(g => !isBacklogGame(g) && !(activeTab === 'library' && libraryHideDone && isGameAwarded(g)));
  source.forEach(g => { counts[g.ConsoleName] = (counts[g.ConsoleName] || 0) + 1; });
  // Beaten keeps its game counts and its order by number of games; it still shows your tab names.
  const yearTab = activeTab === 'year';
  const systems = yearTab ? Object.keys(counts).sort((a, b) => counts[b] - counts[a]) : orderedSystems(counts);

  if(systems.length === 0){ chipRow.innerHTML = ''; chipRow.classList.remove('editing'); return; }

  if(chipEdit){
    // Reorder / rename mode: drag a tab to move it, tap its name to rename it, OK finishes.
    chipRow.classList.add('editing');
    chipRow.innerHTML = `<button class="chip chip-ok" id="chip-ok">OK</button>
      <span class="chip chip-all-off">All</span>` + systems.map(sys => `
      <button class="chip edit" data-sys="${chipEsc(sys)}">${chipEsc(consoleLabel(sys))}</button>`).join('');
    chipRow.querySelector('#chip-ok').addEventListener('click', () => { chipEdit = false; renderSystemChips(); });
    wireChipDrag(chipRow, systems.slice());
    return;
  }
  chipRow.classList.remove('editing');

  const chips = ['All', ...systems];
  chipRow.innerHTML = chips.map(sys => `
      <button class="chip ${sys === systemFilter ? 'active' : ''}" data-sys="${chipEsc(sys)}">
        ${sys === 'All' ? 'All' : chipEsc(consoleLabel(sys))}${sys === 'All' || !yearTab ? '' : ` (${counts[sys]})`}
      </button>
    `).join('');

  chipRow.querySelectorAll('.chip').forEach(chip => {
    // Holding a console tab (Library and Backlog) opens reorder / rename mode.
    let timer = null, startX = 0, startY = 0, held = false;
    const cancel = () => { clearTimeout(timer); timer = null; };
    chip.addEventListener('pointerdown', (e) => {
      held = false;
      if(chip.getAttribute('data-sys') === 'All' || yearTab) return;
      startX = e.clientX; startY = e.clientY;
      timer = setTimeout(() => { held = true; chipEdit = true; chipEditTab = activeTab; renderSystemChips(); }, 600);
    });
    chip.addEventListener('pointermove', (e) => { if(timer && Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancel(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => chip.addEventListener(ev, cancel));
    chip.addEventListener('contextmenu', (e) => e.preventDefault());
    chip.addEventListener('click', () => {
      if(held){ held = false; return; } // the press that opened reorder mode isn't a tap
      systemFilter = chip.getAttribute('data-sys');
      renderSystemChips();
      renderBacklog();
      renderLibrary();
      renderByYear();
    });
  });
}

// App-wide title-comparison rule: ignore case AND accents, so "Pokémon" and "Pokemon" are the same
// (é = e, ñ = n, etc.). Use this on both sides whenever titles are searched or compared.
function foldText(s){
  return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// RA titles often carry a leading tag like "~Hack~" or "~Homebrew~", still
// shown in the UI, but ignored for sorting so these games fall alphabetically
// under the real title instead of clumping together under "~".
function sortableTitle(title){
  return foldText(String(title || '').replace(/^(?:~[^~]*~\s*)+/, ''));
}

// Whether a game currently shows as "done" rather than "in progress", the
// same rule awardPill() uses to choose a pill, kept in sync with it so the
// Award column sorts into exactly the two groups it visibly displays,
// including how the casual/hardcore toggle changes what counts as done.
function isGameAwarded(g){
  if(g.customConsole) return !!g.manualBeaten;
  return awardCountsInMode(g.HighestAwardKind);
}

// Backlog vs Library: a manual RA game (not customConsole) stays in the Backlog until
// RA reports progress, then loadAll() drops it from the manual list. A customConsole
// game stays until "Now Playing" is checked. manualBeaten with no manualStarted counts
// as started (older saves).
function isBacklogGame(g){
  if(g.manual !== true) return false;
  if(!g.customConsole) return true;
  const started = g.manualStarted === true || g.manualBeaten === true;
  return !started;
}

function renderLibrary(){
  const wrap = $('#lib-table-wrap');
  libraryData.forEach(g => { g.estHours = (estHoursCache[g.GameID] && estHoursCache[g.GameID].hours) ?? -1; });
  const searchVal = foldText($('#lib-search').value || '');
  let rows = libraryData.filter(g =>
    !isBacklogGame(g) &&
    !isSubsetGame(g) &&
    !(libraryHideDone && isGameAwarded(g)) &&
    foldText(g.Title).includes(searchVal) &&
    (systemFilter === 'All' || g.ConsoleName === systemFilter)
  );

  const { key, dir } = librarySort;
  rows = rows.slice().sort((a,b) => {
    if(key === 'HighestAwardKind'){
      const aRank = isGameAwarded(a) ? 0 : 1;
      const bRank = isGameAwarded(b) ? 0 : 1;
      const rankDiff = dir === 'desc' ? (aRank - bRank) : (bRank - aRank);
      if(rankDiff !== 0) return rankDiff;
      return sortableTitle(a.Title).localeCompare(sortableTitle(b.Title)); // beaten-then-in-progress, alphabetical within each group either way
    }
    let av = a[key], bv = b[key];
    if(key === 'Title'){ av = sortableTitle(av); bv = sortableTitle(bv); }
    else if(typeof av === 'string'){ av = av.toLowerCase(); bv = bv.toLowerCase(); }
    if(av < bv) return dir === 'asc' ? -1 : 1;
    if(av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });

  // Default order (A to Z, no search): the three most recently played (on the picked console, if any) come
  // first under their own heading, then everything else by name.
  let recentSet = null; // the games shown first, with a label over them
  if(key === 'Title' && dir === 'asc' && !searchVal){
    const recent = rows
      .filter(g => parseRADate(g.lastPlayed))
      .sort((a, b) => parseRADate(b.lastPlayed) - parseRADate(a.lastPlayed))
      .slice(0, 3);
    if(recent.length){
      const picked = new Set(recent);
      rows = [...recent, ...rows.filter(g => !picked.has(g))];
      recentSet = picked;
    }
  }

  $('#lib-count').textContent = rows.length ? `(${rows.length} ${rows.length === 1 ? 'game' : 'games'})` : '';

  if(rows.length === 0){
    wrap.innerHTML = `<div class="empty">${libraryHideDone && !searchVal && systemFilter === 'All' ? 'No games in progress.' : 'No games match.'}</div>`;
    return;
  }

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
          ${rows.map((g, i) => {
          const label = recentSet
            ? (i === 0 ? '<tr class="lib-sec"><td colspan="5">RECENTLY PLAYED</td></tr>'
              : (i === recentSet.size ? '<tr class="lib-sec alt"><td colspan="5">ALL GAMES A\u2013Z</td></tr>' : ''))
            : '';
          const isCustom = g.customConsole === true;
          const est = estHoursCache[g.GameID];
          const earned = Number(g.NumAwarded || 0);
          const hoursLabel = isCustom ? '—' : (est ? formatDuration(est, true) : '<span class="pt-pending" title="Loading playtime…"></span>');
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
          return label + `
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
  wireGameRows(wrap);
}

// Opens a game from a table row (not the section label rows); the ✕ removes a manually added game.
function wireGameRows(wrap){
  wrap.querySelectorAll('tbody tr:not(.lib-sec)').forEach(row => {
    row.addEventListener('click', () => openGameModal(Number(row.getAttribute('data-game-id'))));
  });
  wrap.querySelectorAll('.manual-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeManualGame(Number(btn.getAttribute('data-remove-id')));
    });
  });
}

// Games that have been added but never actually played: manually-added RA
// games RA hasn't seen progress on yet, and customConsole games the user
// hasn't checked "Now Playing" on. No award/progress/playtime columns here
// since none of that exists yet for any of these.
function renderBacklog(){
  const wrap = $('#backlog-table-wrap');
  if(!wrap) return;
  const searchInput = $('#backlog-search');
  const searchVal = foldText(searchInput ? searchInput.value : '');
  let rows = libraryData.filter(g =>
    isBacklogGame(g) &&
    foldText(g.Title).includes(searchVal) &&
    (systemFilter === 'All' || g.ConsoleName === systemFilter)
  );
  rows = rows.slice().sort((a, b) => sortableTitle(a.Title).localeCompare(sortableTitle(b.Title)));

  const countEl = $('#backlog-count');
  if(countEl) countEl.textContent = rows.length ? `(${rows.length} ${rows.length === 1 ? 'game' : 'games'})` : '';

  if(rows.length === 0){
    wrap.innerHTML = '<div class="empty">Nothing in your backlog — add a game to start tracking it.</div>';
    return;
  }

  wrap.innerHTML = `
      <table class="lib-table">
        <thead><tr>
          <th>Game</th>
          <th>System</th>
          <th>Achievements</th>
        </tr></thead>
        <tbody>
          ${rows.map(g => `
            <tr data-game-id="${g.GameID}">
              <td><div class="g-title"><img src="${imgUrl(g.ImageIcon)}" alt=""><span>${g.Title}</span>${g.manual ? `<button class="manual-remove" data-remove-id="${g.GameID}" title="Remove">✕</button>` : ''}</div></td>
              <td style="color:var(--muted);font-size:0.75rem;">${g.ConsoleName || '—'}</td>
              <td style="font-family:'Space Mono',monospace;font-size:0.75rem;color:var(--muted)">${g.customConsole ? 'Not on RA' : (Number(g.MaxPossible) || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

  wireGameRows(wrap);
}

// Small floating label with a game's title, used when a Beaten by Year tile is held.
let yearTipEl = null, yearTipTimer = null;
function showYearTip(item){
  if(!yearTipEl){
    yearTipEl = document.createElement('div');
    yearTipEl.className = 'year-tip';
    document.body.appendChild(yearTipEl);
  }
  yearTipEl.textContent = item.getAttribute('title') || '';
  yearTipEl.classList.add('show');
  const r = item.getBoundingClientRect();
  const w = yearTipEl.offsetWidth, h = yearTipEl.offsetHeight;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  const top = r.top - h - 8 >= 8 ? r.top - h - 8 : r.bottom + 8;
  yearTipEl.style.left = left + 'px';
  yearTipEl.style.top = top + 'px';
  clearTimeout(yearTipTimer);
  yearTipTimer = setTimeout(hideYearTip, 2500);
}
function hideYearTip(){
  if(yearTipEl) yearTipEl.classList.remove('show');
}
window.addEventListener('scroll', hideYearTip, { passive: true });

function renderByYear(){
  const el = $('#year-wrap');
  const raBeaten = libraryData.filter(g => {
    if(g.customConsole || !g.HighestAwardKind || !g.HighestAwardDate) return false;
    if(systemFilter !== 'All' && g.ConsoleName !== systemFilter) return false;
    return awardCountsInMode(g.HighestAwardKind);
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
            ${games.map(g => {
              // Only Mastered gets a pill here (drawn on the icon), a plain beat is already the default for this tab.
              const award = g.customConsole ? null : awardInfo(g.HighestAwardKind);
              const pill = award && award.label === 'Mastered'
                ? `<span class="pill pill-year ${award.cls}">Mastered</span>` : '';
              return `
              <div class="year-item" data-game-id="${g.GameID}" title="${g.Title}">
                <img src="${imgUrl(g.ImageIcon)}" alt="${g.Title}">
                ${pill}
              </div>
            `;
            }).join('')}
          </div>
        </div>
      `;
  }).join('');
  let lastLongPress = 0;
  el.querySelectorAll('.year-item').forEach(item => {
    item.addEventListener('click', () => {
      if(Date.now() - lastLongPress < 600) return; // the release of a long-press isn't a tap
      openGameModal(Number(item.getAttribute('data-game-id')));
    });
    // Touch screens have no hover, so holding a tile shows the game's title instead.
    let holdTimer = null, startX = 0, startY = 0, held = false;
    const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; };
    item.addEventListener('touchstart', (e) => {
      held = false;
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
      cancelHold();
      holdTimer = setTimeout(() => { held = true; showYearTip(item); }, 450);
    }, { passive: true });
    item.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if(Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) cancelHold();
    }, { passive: true });
    item.addEventListener('touchend', (e) => {
      cancelHold();
      if(held){ lastLongPress = Date.now(); if(e.cancelable) e.preventDefault(); }
    });
    item.addEventListener('touchcancel', cancelHold);
    item.addEventListener('contextmenu', (e) => e.preventDefault()); // no image menu on long-press
  });
}
