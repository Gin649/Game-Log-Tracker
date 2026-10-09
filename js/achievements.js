// Achievement lists, custom ordering, the missable filter, and beaten achievements.

// Almost always already populated by getEstimatedHours() (it fetches
// this exact endpoint for every game in the library on load), this only
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

// GetGameInfoAndUserProgress (used for earn-dates/progress) doesn't reliably
// include each achievement's Missable/Progression/WinCondition type, but
// GetGameExtended (already fetched for the modal) does, so borrow it from
// there instead of a second network round-trip.
function attachAchievementTypes(list, ext){
  const extAch = ext && ext.Achievements;
  if(!extAch) return list;
  (list || []).forEach(a => {
    const id = a.ID ?? a.id;
    const match = extAch[id] ?? extAch[String(id)];
    const t = match && (match.type || match.Type);
    if(t) a.type = t;
  });
  return list;
}

function isMissable(a){
  return String((a && (a.Type || a.type)) || '').toLowerCase() === 'missable';
}

function achRowHtml(a, isLocked, isHardcoreMode, reorderMode){
  const badge = imgUrl('/Badge/' + a.BadgeName + (isLocked ? '_lock' : '') + '.png');
  const earnedDate = isHardcoreMode ? a.DateEarnedHardcore : a.DateEarned;
  const reorderControls = reorderMode
    ? `<div class="ach-reorder-controls">
           <button class="ach-move-btn" data-dir="up" type="button" aria-label="Move up">▲</button>
           <button class="ach-move-btn" data-dir="down" type="button" aria-label="Move down">▼</button>
         </div>`
    : '';
  return `
      <div class="ach-row ${isLocked ? 'locked' : ''}" data-id="${a.ID ?? a.id}">
        ${reorderControls}
        <img src="${badge}" alt="">
        <div class="info">
          <p class="t">${a.Title || 'Untitled'}</p>
          <p class="d">${a.Description || ''}</p>
          ${!isLocked ? `<p class="when">Unlocked ${timeAgo(earnedDate)}</p>` : ''}
        </div>
        ${isMissable(a) ? '<span class="ach-missable-badge" title="Missable — can be permanently missed during a playthrough">!</span>' : ''}
        ${(!reorderMode && (a.ID ?? a.id)) ? `<a class="ach-ra-link" href="https://retroachievements.org/achievement/${encodeURIComponent(a.ID ?? a.id)}" target="_blank" rel="noopener" title="Open this achievement on RetroAchievements (comments &amp; discussion)" aria-label="Open ${String(a.Title || 'achievement').replace(/"/g,'&quot;')} on RetroAchievements">RA</a>` : ''}
        <div class="pts">${a.Points ?? ''}</div>
      </div>
    `;
}

// Custom achievement order (per game, saved on-device)
// Stored as an array of achievement IDs under its own key, so it rides along
// in the Data export/import backup automatically. Achievements added to the
// set later (not in the saved array) are appended at the end; IDs that no
// longer exist are ignored.
const achOrderCache = {}; // gameId -> array of IDs, or null when no custom order
let achReorderMode = false;
function achOrderKey(gameId){
  return `ach-order:${creds.username.trim().toLowerCase()}:${gameId}`;
}
async function loadAchOrder(gameId){
  try{
    const r = await window.storage.get(achOrderKey(gameId), false);
    if(r && r.value){
      const arr = JSON.parse(r.value);
      if(Array.isArray(arr)){ achOrderCache[gameId] = arr; return arr; }
    }
  }catch(e){ /* no custom order saved */ }
  achOrderCache[gameId] = null;
  return null;
}
async function saveAchOrder(gameId, ids){
  achOrderCache[gameId] = ids;
  try{ await window.storage.set(achOrderKey(gameId), JSON.stringify(ids), false); }
  catch(e){ /* non-fatal */ }
}
async function clearAchOrder(gameId){
  achOrderCache[gameId] = null;
  try{ await window.storage.delete(achOrderKey(gameId), false); }catch(e){}
}
// Export/import a custom order as a .json file. Stores full IDs rather than indices
// so it still works if the achievement set has changed. Uses a throwaway file input,
// like the Data export/import.
function downloadAchOrderFile(gameId, gameTitle, ids){
  const payload = { type: 'glt-achievement-order', version: 1, gameId, gameTitle: gameTitle || '', order: ids };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = String(gameTitle || 'achievement').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '').slice(0, 60);
  a.download = `${safeName || 'achievement'}-order.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
async function readAchOrderFile(file){
  const text = await file.text();
  let payload;
  try{ payload = JSON.parse(text); }
  catch(e){ throw new Error("That file isn't valid JSON."); }
  if(!payload || payload.type !== 'glt-achievement-order' || !Array.isArray(payload.order)){
    throw new Error("This doesn't look like an achievement-order file.");
  }
  return { gameId: Number(payload.gameId), ids: payload.order.map(String) };
}
function pickAchOrderFile(onFile){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    document.body.removeChild(input);
    if(file) onFile(file);
  });
  document.body.appendChild(input);
  input.click();
}

function applyAchOrder(list, order){
  if(!order) return list;
  const pos = new Map(order.map((id, i) => [String(id), i]));
  const idOf = (a) => String(a.ID ?? a.id);
  const known = list.filter(a => pos.has(idOf(a))).sort((a, b) => pos.get(idOf(a)) - pos.get(idOf(b)));
  const fresh = list.filter(a => !pos.has(idOf(a)));
  return known.concat(fresh);
}

function renderAchievementsList(list, isHardcoreMode, order, reorderMode){
  if(!list || list.length === 0) return '<div class="achievements-list-loading">No achievement data available.</div>';
  // Match the rest of the app's hardcore/casual convention: hardcore mode
  // only counts an achievement as earned if it was unlocked in hardcore
  // (DateEarnedHardcore); casual mode counts any unlock at all
  // (DateEarned is set on every unlock, hardcore or not).
  const isEarned = (a) => isHardcoreMode ? a.DateEarnedHardcore : a.DateEarned;
  // Custom order wins over the default earned-first grouping.
  if(order){
    return applyAchOrder(list, order).map(a => achRowHtml(a, !isEarned(a), isHardcoreMode, reorderMode)).join('');
  }
  const earned = list.filter(a => isEarned(a));
  const locked = list.filter(a => !isEarned(a));
  return earned.map(a => achRowHtml(a, false, isHardcoreMode, reorderMode)).join('') + locked.map(a => achRowHtml(a, true, isHardcoreMode, reorderMode)).join('');
}

// Wraps renderAchievementsList with the "Missable Only" filter bar RA's own
// site shows, only rendered when the set actually has any missable
// achievements, since most sets on RA haven't been typed at all yet.
let achMissableOnly = false;
let achImportError = '';
function renderAchievementsPanel(list, isHardcoreMode, missableOnly, order, reorderMode, gameId, gameTitle){
  if(!list || list.length === 0) return '<div class="achievements-list-loading">No achievement data available.</div>';
  const missableCount = list.filter(isMissable).length;
  const showMissable = missableCount > 0 && !reorderMode;
  const leftBtns = reorderMode
    ? `<button class="ach-filter-btn active" id="ach-reorder-toggle" type="button">✓ Done</button>`
    : `<button class="ach-filter-btn" id="ach-reorder-toggle" type="button">⇅ Reorder</button>`
      + (order ? `<button class="ach-filter-btn" id="ach-reorder-reset" type="button">Reset order</button>` : '');
  const filterBar = `<div class="ach-filter-row">
        <div class="ach-filter-left">${leftBtns}</div>
        ${showMissable ? `<button class="ach-filter-btn ${missableOnly ? 'active' : ''}" id="ach-missable-toggle" type="button">
             <span class="ach-missable-badge" aria-hidden="true">!</span> Missable Only (<span class="ach-filter-count">${missableCount}</span>)
           </button>` : ''}
      </div>
      ${reorderMode ? '<div class="ach-reorder-hint">Press and hold a row, then drag it. Or use ▲▼. Your order saves automatically.</div>' : ''}`;
  const rows = (missableOnly && !reorderMode) ? list.filter(isMissable) : list;
  const body = rows.length === 0
    ? '<div class="achievements-list-loading">No missable achievements in this set.</div>'
    : `<div class="ach-rows${reorderMode ? ' reordering' : ''}" id="ach-rows">${renderAchievementsList(rows, isHardcoreMode, order, reorderMode)}</div>`;

  // Share/import buttons go below the list: sharing a custom order is a niche
  // feature and shouldn't compete with Reorder / Missable Only up top.
  const shareFooterBtns = (order ? `<button class="ach-share-footer-btn" id="ach-share-download" type="button">⇪ Export order (file)</button>` : '')
    + `<button class="ach-share-footer-btn" id="ach-import-file-btn" type="button">⇩ Import order (file)</button>`;
  const shareFooter = `<div class="ach-share-footer-row">${shareFooterBtns}</div>
      ${achImportError ? `<div class="ach-share-footer-error">${achImportError}</div>` : ''}`;

  return filterBar + body + shareFooter;
}

// Shared by the initial "View Achievements" open and the casual/hardcore
// toggle's refresh, so the missable filter and reorder state survive a mode
// switch instead of resetting back to the full list.
function renderAchWrapContent(achWrap, gameId){
  const list = achievementsListCache[gameId];
  if(!achWrap || !list) return;
  const order = achOrderCache[gameId] || null;
  const local = findGameLocal(gameId);
  const gameTitle = local ? local.Title : '';
  achWrap.innerHTML = renderAchievementsPanel(list, statsMode === 'hardcore', achMissableOnly, order, achReorderMode, gameId, gameTitle);
  const toggleBtn = achWrap.querySelector('#ach-missable-toggle');
  if(toggleBtn){
    toggleBtn.addEventListener('click', () => {
      achMissableOnly = !achMissableOnly;
      renderAchWrapContent(achWrap, gameId);
    });
  }
  const reorderBtn = achWrap.querySelector('#ach-reorder-toggle');
  if(reorderBtn){
    reorderBtn.addEventListener('click', () => {
      achReorderMode = !achReorderMode;
      if(achReorderMode) achMissableOnly = false; // can't reorder a filtered subset
      renderAchWrapContent(achWrap, gameId);
    });
  }
  const resetBtn = achWrap.querySelector('#ach-reorder-reset');
  if(resetBtn){
    resetBtn.addEventListener('click', async () => {
      await clearAchOrder(gameId);
      renderAchWrapContent(achWrap, gameId);
    });
  }
  const shareDownloadBtn = achWrap.querySelector('#ach-share-download');
  if(shareDownloadBtn){
    shareDownloadBtn.addEventListener('click', () => {
      const order = achOrderCache[gameId];
      if(!order) return;
      const local = findGameLocal(gameId);
      downloadAchOrderFile(gameId, local ? local.Title : '', order);
    });
  }
  const importFileBtn = achWrap.querySelector('#ach-import-file-btn');
  if(importFileBtn){
    importFileBtn.addEventListener('click', () => {
      pickAchOrderFile(async (file) => {
        try{
          const parsed = await readAchOrderFile(file);
          if(parsed.gameId !== Number(gameId)){
            achImportError = 'This order file is for a different game.';
          }else{
            await saveAchOrder(gameId, parsed.ids);
            achImportError = '';
            achReorderMode = false; // show the imported order applied, not mid-edit
          }
        }catch(e){
          achImportError = e.message;
        }
        renderAchWrapContent(achWrap, gameId);
      });
    });
  }
  if(achReorderMode) wireAchReorder(achWrap, gameId);
}

// Drag (pointer events, touch + mouse) and ▲▼ buttons. Every change writes
// the full ID order straight to storage.
function wireAchReorder(achWrap, gameId){
  const container = achWrap.querySelector('#ach-rows');
  if(!container) return;
  const scroller = document.getElementById('modal-backdrop'); // the profile view is the scrolling element
  const rowsEl = () => Array.from(container.querySelectorAll('.ach-row'));
  const persist = () => saveAchOrder(gameId, rowsEl().map(r => r.dataset.id));

  container.querySelectorAll('.ach-move-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.ach-row');
      if(btn.dataset.dir === 'up'){
        const prev = row.previousElementSibling;
        if(prev) container.insertBefore(row, prev);
      }else{
        const next = row.nextElementSibling;
        if(next) container.insertBefore(next, row);
      }
      persist();
    });
  });

  // Press-and-hold anywhere on a row to pick it up, then drag. A quick swipe
  // (finger moves before the hold completes) is left alone so the page still scrolls.
  // The held row follows the finger via a CSS transform and the rows it passes
  // slide out of the way; the DOM is only reordered once, on release (moving the
  // held element mid-drag makes browsers drop the pointer).
  const HOLD_MS = 350;
  const HOLD_SLOP = 10; // px of movement that means "this is a scroll, not a hold"
  let dragActive = false;
  // Once a drag is live, stop the browser from also scrolling the page under the finger.
  container.addEventListener('touchmove', (ev) => { if(dragActive) ev.preventDefault(); }, { passive: false });
  container.addEventListener('contextmenu', (ev) => ev.preventDefault()); // no long-press menu on badge images

  container.querySelectorAll('.ach-row').forEach(row => {
    row.addEventListener('pointerdown', (e) => {
      if(dragActive) return;
      if(e.target.closest('.ach-move-btn')) return; // arrows do their own thing
      if(e.pointerType === 'mouse' && e.button !== 0) return;
      const pointerId = e.pointerId;
      let pointerY = e.clientY;
      const downX = e.clientX, downY = e.clientY;
      let timer = 0;

      const cancelPending = () => {
        clearTimeout(timer);
        row.removeEventListener('pointermove', pendingMove);
        row.removeEventListener('pointerup', cancelPending);
        row.removeEventListener('pointercancel', cancelPending);
      };
      const pendingMove = (ev) => {
        pointerY = ev.clientY;
        if(Math.abs(ev.clientX - downX) > HOLD_SLOP || Math.abs(ev.clientY - downY) > HOLD_SLOP) cancelPending();
      };
      row.addEventListener('pointermove', pendingMove);
      row.addEventListener('pointerup', cancelPending);
      row.addEventListener('pointercancel', cancelPending);

      // Mouse picks up instantly; touch needs the hold.
      timer = setTimeout(() => { cancelPending(); startDrag(row, pointerId, pointerY); }, e.pointerType === 'mouse' ? 0 : HOLD_MS);
    });
  });

  function startDrag(row, pointerId, initialY){
    const rows = rowsEl();
    const startIdx = rows.indexOf(row);
    // Layout snapshot (offsetTop is relative to the container, scroll-independent).
    const tops = rows.map(r => r.offsetTop);
    const heights = rows.map(r => r.offsetHeight);
    const dragH = heights[startIdx] + 1; // +1 for the 1px gap between rows
    const contentY = (clientY) => clientY - container.getBoundingClientRect().top;
    const startContentY = contentY(initialY);
    let pointerY = initialY;
    let newIdx = startIdx;
    let raf = 0;

    dragActive = true;
    if(navigator.vibrate){ try{ navigator.vibrate(15); }catch(err){} }
    row.classList.add('dragging');
    rows.forEach(r => { if(r !== row) r.classList.add('ach-shifting'); });
    try{ row.setPointerCapture(pointerId); }catch(err){}

    const tick = () => {
      // Auto-scroll near the screen edges (faster the closer you get).
      const edge = 90;
      if(pointerY < edge) scroller.scrollTop -= Math.ceil((edge - pointerY) / 5);
      else if(pointerY > window.innerHeight - edge) scroller.scrollTop += Math.ceil((pointerY - (window.innerHeight - edge)) / 5);

      // Held row tracks the finger (contentY is recomputed, so scrolling counts too).
      let dy = contentY(pointerY) - startContentY;
      const minDy = tops[0] - tops[startIdx];
      const maxDy = tops[rows.length - 1] + heights[rows.length - 1] - tops[startIdx] - heights[startIdx];
      dy = Math.max(minDy, Math.min(maxDy, dy));
      row.style.transform = `translateY(${dy}px)`;

      // Where would it land? Count the other rows whose midpoint is above its centre.
      const centre = tops[startIdx] + heights[startIdx] / 2 + dy;
      let idx = 0;
      rows.forEach((r, i) => { if(i !== startIdx && tops[i] + heights[i] / 2 < centre) idx++; });
      newIdx = idx;

      // Slide the passed rows out of the way.
      rows.forEach((r, i) => {
        if(i === startIdx) return;
        let shift = 0;
        if(startIdx < newIdx && i > startIdx && i <= newIdx) shift = -dragH;
        else if(startIdx > newIdx && i >= newIdx && i < startIdx) shift = dragH;
        r.style.transform = shift ? `translateY(${shift}px)` : '';
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onMove = (ev) => { pointerY = ev.clientY; };
    const onEnd = () => {
      cancelAnimationFrame(raf);
      row.removeEventListener('pointermove', onMove);
      row.removeEventListener('pointerup', onEnd);
      row.removeEventListener('pointercancel', onEnd);
      dragActive = false;
      // Commit once: clear transforms, then move the row to its final slot.
      rows.forEach(r => { r.style.transform = ''; r.classList.remove('ach-shifting'); });
      row.classList.remove('dragging');
      if(newIdx !== startIdx){
        const others = rows.filter(r => r !== row);
        if(newIdx >= others.length) container.appendChild(row);
        else container.insertBefore(row, others[newIdx]);
        persist();
      }
    };
    row.addEventListener('pointermove', onMove);
    row.addEventListener('pointerup', onEnd);
    row.addEventListener('pointercancel', onEnd);
  }
}

// RA counts a game as Beaten once every "progression" achievement is earned plus at
// least one "win_condition" (if any exist). Plenty of sets are not typed yet, so an
// empty result does not mean the game cannot be beaten.
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
