// Loading the library from RA, connect/disconnect, and the casual/hardcore toggle.

async function loadAll(opts){
  const forcePlaytimeRefresh = !!(opts && opts.forceRecentPlaytime);
  await enqueueTask(async () => {
  $('#recent-games').innerHTML = '<div class="loading">Loading</div>';
  $('#recent-unlocks').innerHTML = '<div class="loading">Loading</div>';
  $('#backlog-table-wrap').innerHTML = '<div class="loading">Loading</div>';
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

    // Also bring back anything promoteManualGameToReal() confirmed earlier
    // (via the faster per-game endpoint) that this bulk fetch still hasn't
    // caught up to, otherwise it'd vanish from both Backlog and Library
    // for however much longer RA takes to reflect it here. Once the bulk
    // fetch does agree, drop it from here, it's now included for real.
    const pendingReal = await loadPendingRealGames();
    const stillPending = pendingReal.filter(g => !realIds.has(g.GameID));
    if(stillPending.length !== pendingReal.length) await savePendingRealGames(stillPending);
    libraryData = [...libraryData, ...stillPending];

    if(lastProfile) renderProfile(lastProfile);
  }catch(e){
    console.error('Failed to load live library data:', e);
    // Still show whatever's manually tracked, a proxy hiccup shouldn't
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

  try{ renderBacklog(); }
  catch(e){
    console.error('renderBacklog failed:', e);
    $('#backlog-table-wrap').innerHTML = `<div class="error-box">Couldn't display your backlog: ${e.message}</div>`;
  }

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
  }); // end of queued task, everything above this point is fully serialized

  // On an explicit refresh, refetch playtime for anything played in the last 24h and skip
  // the 12h cache, so a session that started right after the last write does not sit
  // stale. Only touches the recent list (12 games or fewer).
  let forceIds;
  if(forcePlaytimeRefresh){
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    forceIds = new Set(
      recentGamesData
        .filter(g => { const d = parseRADate(g.LastPlayed); return d && d.getTime() >= cutoff; })
        .map(g => g.GameID)
    );
  }

  // Fetch playtime in order of recency: the "recently played" list first
  // (it's already recency-sorted by RA), then everything else in the
  // library sorted by its own last-played date, so the games you're
  // actually looking at fill in first instead of racing through the
  // library in whatever order the API happened to return it.
  const recentIds = new Set(recentGamesData.map(g => g.GameID));
  const remainingByRecency = libraryData
    .filter(g => !recentIds.has(g.GameID))
    .slice()
    .sort((a, b) => {
      const ta = a.lastPlayed ? (parseRADate(a.lastPlayed) || 0).getTime?.() || 0 : 0;
      const tb = b.lastPlayed ? (parseRADate(b.lastPlayed) || 0).getTime?.() || 0 : 0;
      return tb - ta; // most recently played first, never-played last
    });

  loadEstimatedHoursFor([...recentGamesData, ...remainingByRecency], () => {
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
  updateRaConnectionView(); // stay on the dashboard shell, just drops back to the "connect RA" placeholder
});
$('#btn-hardcore-toggle').addEventListener('click', () => {
  statsMode = statsMode === 'hardcore' ? 'casual' : 'hardcore';
  $('#btn-hardcore-toggle').textContent = statsMode === 'hardcore' ? 'Switch to Casual Mode' : 'Switch to Hardcore Mode';
  if(lastProfile) renderProfile(lastProfile);
  renderRecentGames(recentGamesData);
  renderSystemChips();
  renderBacklog();
  renderLibrary();
  renderByYear();
  if(openAchievementsGameId != null){
    const achWrap = document.getElementById('modal-achievements');
    renderAchWrapContent(achWrap, openAchievementsGameId);
  }
  if(openBeatenAchievementsGameId != null){
    const list = achievementsListCache[openBeatenAchievementsGameId];
    const beatenAchWrap = document.getElementById('modal-beaten-achievements');
    if(beatenAchWrap && list) beatenAchWrap.innerHTML = renderBeatenAchievementsList(list, statsMode === 'hardcore');
  }
});
$('#lib-search').addEventListener('input', renderLibrary);
$('#backlog-search').addEventListener('input', renderBacklog);
