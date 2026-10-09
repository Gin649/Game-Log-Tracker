// Click-and-drag scrolling on desktop, and pull-to-refresh.

// Click-and-drag horizontal scrolling (desktop mouse only)
// Touch already pans these regions natively via the browser, so this only
// listens for real mouse input, mousedown/mousemove/mouseup never fire
// for touch interaction in modern browsers, so it can't conflict with or
// double-handle touch scrolling.
function enableDragToScroll(el){
  if(!el) return;
  let isDown = false;
  let moved = false;
  let startX = 0;
  let startScrollLeft = 0;

  el.addEventListener('mousedown', (e) => {
    if(e.button !== 0) return; // left button only
    isDown = true;
    moved = false;
    startX = e.pageX;
    startScrollLeft = el.scrollLeft;
    el.classList.add('dragging');
  });

  window.addEventListener('mousemove', (e) => {
    if(!isDown) return;
    const dx = e.pageX - startX;
    if(!moved && Math.abs(dx) > 3) moved = true; // small threshold so plain clicks still work
    if(moved){
      el.scrollLeft = startScrollLeft - dx;
      e.preventDefault();
    }
  });

  window.addEventListener('mouseup', () => {
    if(!isDown) return;
    isDown = false;
    el.classList.remove('dragging');
    if(moved){
      // A drag ending over a row/header would otherwise also fire a
      // native click right after (opening the game modal, sorting the
      // column, etc.), swallow just that one click.
      const suppressClick = (e) => { e.stopPropagation(); e.preventDefault(); };
      el.addEventListener('click', suppressClick, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', suppressClick, { capture: true }), 0);
    }
  });
}
enableDragToScroll($('#system-chips')); // the console-name chips above the library / beaten-by-year lists

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

  // dataset.gameId is always text ("123") but the app's own game data keys on the real value
  // (123), so find the game's real id first or the profile can't match it to its progress and awards.
  const resolveGameId = (idText) => {
    const hit = libraryData.find(g => String(g.GameID) === idText)
      || recentGamesData.find(g => String(g.GameID) === idText);
    if(hit) return hit.GameID;
    return /^\d+$/.test(idText) ? Number(idText) : idText;
  };
  async function refreshOpenGameProfile(idText){
    const gameId = resolveGameId(idText);
    let fresh;
    try{
      // One call for just this game: current progress, award status, achievement list and playtime.
      fresh = await raFetch('API_GetGameInfoAndUserProgress.php', { g: gameId, a: 1 });
    }catch(e){
      console.error('Game refresh failed:', e);
      return; // offline / proxy trouble: leave the profile exactly as it was
    }
    if(!fresh || fresh.ID === undefined && fresh.Title === undefined) return;

    // Update this game's entry in place (same fields the full library load fills in).
    const maxPossible = Number(fresh.NumAchievements ?? 0);
    const numAwarded = Number(fresh.NumAwardedToUser ?? 0);
    const numAwardedHC = Number(fresh.NumAwardedToUserHardcore ?? 0);
    const idx = libraryData.findIndex(g => g.GameID === gameId);
    if(idx !== -1){
      const old = libraryData[idx];
      libraryData[idx] = {
        ...old,
        MaxPossible: maxPossible || old.MaxPossible,
        NumAwarded: numAwarded,
        NumAwardedHardcore: numAwardedHC,
        HighestAwardKind: fresh.HighestAwardKind ?? null,
        HighestAwardDate: fresh.HighestAwardDate ?? null,
        pct: maxPossible ? Math.round((numAwarded / maxPossible) * 100) : 0,
      };
    }
    const rIdx = recentGamesData.findIndex(g => g.GameID === gameId);
    if(rIdx !== -1){
      recentGamesData[rIdx] = {
        ...recentGamesData[rIdx],
        NumPossibleAchievements: maxPossible || recentGamesData[rIdx].NumPossibleAchievements,
        NumAchieved: numAwarded,
        NumAchievedHardcore: numAwardedHC,
      };
    }

    // Drop what's cached for this game so the profile draws fresh details, achievements and playtime.
    delete gameExtendedCache[gameId];
    try{ await window.storage.delete(`ra-gameinfo:${gameId}`, false); }catch(e){ /* nothing cached */ }
    if(fresh.Achievements){
      achievementsListCache[gameId] = Object.values(fresh.Achievements)
        .sort((a, b) => (a.DisplayOrder ?? 0) - (b.DisplayOrder ?? 0));
    }else{
      delete achievementsListCache[gameId];
    }
    try{ await getEstimatedHours(gameId, true); }catch(e){ console.error('Playtime refresh failed:', e); }

    // Keep the screens behind the profile in step with the new numbers.
    try{ renderRecentGames(recentGamesData); }catch(e){ console.error(e); }
    try{ renderLibrary(); }catch(e){ console.error(e); }
    try{ renderBacklog(); }catch(e){ console.error(e); }
    try{ renderByYear(); }catch(e){ console.error(e); }

    const card = $('#modal-card');
    if(!profileOpen() || card.dataset.gameId !== String(gameId)) return; // closed or moved to another game meanwhile
    stopWalkthroughPlayers(); // saves the watch position before the profile is redrawn
    await openGameModal(gameId);
  }

  // The game profile is a full-screen overlay that scrolls itself (#modal-backdrop),
  // so pulling down there is measured against its own scrollTop instead of the window's.
  let profileMode = false;
  const profileEl = () => $('#modal-backdrop');
  const profileOpen = () => profileEl().classList.contains('open');
  // True if the touch began inside something that is itself scrolled down (a nested list), so
  // pulling down should scroll that list rather than refresh.
  const insideScrolledChild = (node) => {
    for(let el = node; el && el !== profileEl(); el = el.parentElement){
      if(el.scrollTop > 1) return true;
    }
    return false;
  };

  document.addEventListener('touchstart', (e) => {
    profileMode = false;
    if(profileOpen()){
      const card = $('#modal-card');
      pulling = !!creds && !!card.dataset.gameId
        && e.touches.length === 1
        && profileEl().contains(e.target)
        && profileEl().scrollTop <= 1 // <=1: scroll offsets can be fractional on scaled screens
        && !insideScrolledChild(e.target);
      profileMode = pulling;
    }else{
      pulling = window.scrollY === 0 && !!creds && $('#dashboard').style.display === 'block';
    }
    if(pulling) touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if(!pulling) return;
    // An achievement being dragged to a new position (reorder) has already claimed this gesture.
    if(e.defaultPrevented){ pulling = false; currentPull = 0; indicator.style.height = '0px'; return; }
    const atTop = profileMode ? profileEl().scrollTop <= 1 : window.scrollY === 0;
    const delta = e.touches[0].clientY - touchStartY;
    if(delta > 0 && atTop){
      currentPull = Math.min(delta, MAX_PULL);
      indicator.classList.toggle('over-profile', profileMode);
      indicator.style.height = currentPull + 'px';
      indicator.textContent = currentPull > PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh';
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if(!pulling) return;
    pulling = false;
    const wasProfile = profileMode;
    profileMode = false;
    if(currentPull > PULL_THRESHOLD){
      indicator.textContent = 'Refreshing…';
      let job;
      if(wasProfile && profileOpen()){
        // Refresh just this game (one API call, not the whole library) and redraw its profile.
        job = refreshOpenGameProfile($('#modal-card').dataset.gameId);
      }else{
        job = loadAll({ forceRecentPlaytime: true });
      }
      Promise.resolve(job).catch(() => {}).finally(() => {
        indicator.style.height = '0px';
        indicator.classList.remove('over-profile');
      });
    } else {
      indicator.style.height = '0px';
      indicator.classList.remove('over-profile');
    }
    currentPull = 0;
  }, { passive: true });
})();
