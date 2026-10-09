// People you follow on RetroAchievements.

// Social: people you follow on RetroAchievements
// "Following" list from API_GetUsersIFollow.php, then one API_GetUserSummary.php
// call per person (rich presence + last game). Tapping a person shows their
// recent unlocks and a link to their RA profile. Nothing here is saved to disk.
const SOCIAL_MAX_FRIENDS = 100;          // RA's default page size for the Following list
const SOCIAL_PLAYING_MS = 10 * 60 * 1000; // presence newer than this counts as "Playing now"
const SOCIAL_CACHE_MS = 2 * 60 * 1000;    // reopening within this window reuses what's loaded
const SOCIAL_UNLOCK_DAYS = 14;
const SOCIAL_FRIENDS_URL = 'https://retroachievements.org/friends.php';
let socialFriends = [];   // [{ name, points, summary, failed }]
let socialTotal = 0;
let socialLoadedAt = 0;
let socialToken = 0;      // bumped on every load so a stale load can't overwrite a newer one
let socialLoading = false;
let socialError = '';
let socialView = { mode: 'list', name: null };
const socialUnlocksCache = {}; // lowercased name -> { at, list }

function socialEsc(v){
  return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function socialInitials(name){
  const s = String(name || '?').replace(/[^A-Za-z0-9]/g, '');
  return (s.slice(0, 2) || '?').toUpperCase();
}
function socialAgo(d){
  if(!d) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if(diff < 60) return 'just now';
  if(diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if(diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if(diff < 86400 * 30) return Math.floor(diff / 86400) + 'd ago';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function socialInfo(f){
  const s = f.summary;
  if(!s) return { game: '', presence: '', date: null, playing: false };
  const lastGame = s.LastGame || {};
  const recent = Array.isArray(s.RecentlyPlayed) && s.RecentlyPlayed[0] ? s.RecentlyPlayed[0] : null;
  const presenceDate = parseRADate(s.RichPresenceMsgDate);
  const date = presenceDate
    || (recent && parseRADate(recent.LastPlayed))
    || (s.LastActivity && parseRADate(s.LastActivity.lastupdate))
    || null;
  return {
    game: lastGame.Title || (recent && recent.Title) || '',
    presence: s.RichPresenceMsg || '',
    date,
    playing: !!(presenceDate && (Date.now() - presenceDate.getTime()) < SOCIAL_PLAYING_MS)
  };
}
function socialStatusHtml(info){
  if(info.playing) return '<span class="soc-status playing"><span class="soc-dot" style="background:var(--teal)"></span>Playing now</span>';
  if(!info.date) return '<span class="soc-status"><span class="soc-dot" style="background:var(--muted)"></span>—</span>';
  const recent = (Date.now() - info.date.getTime()) < 86400 * 1000;
  return `<span class="soc-status"><span class="soc-dot" style="background:${recent ? 'var(--gold)' : 'var(--muted)'}"></span>${socialEsc(socialAgo(info.date))}</span>`;
}
function socialAvatarHtml(name, cls){
  return `<span class="soc-av-wrap ${cls || ''}"><img class="soc-av" src="${MEDIA}/UserPic/${encodeURIComponent(name)}.png" alt=""><span class="soc-av-fallback">${socialEsc(socialInitials(name))}</span></span>`;
}
function socialWireAvatars(root){
  root.querySelectorAll('img.soc-av').forEach(img => {
    img.addEventListener('error', () => { img.style.display = 'none'; img.nextElementSibling.style.display = 'flex'; });
  });
}
function socialSorted(){
  return socialFriends.slice().sort((a, b) => {
    const ia = socialInfo(a), ib = socialInfo(b);
    if(ia.playing !== ib.playing) return ia.playing ? -1 : 1;
    const ta = ia.date ? ia.date.getTime() : 0, tb = ib.date ? ib.date.getTime() : 0;
    if(tb !== ta) return tb - ta;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}
const SOCIAL_FIND_HTML = `Want more people here? <a href="${SOCIAL_FRIENDS_URL}" target="_blank" rel="noopener">Find and follow friends on RetroAchievements ↗</a>`;

function renderSocialList(){
  socialView = { mode: 'list', name: null };
  const body = $('#social-body');
  let html = `<h2 style="margin-bottom:4px;">Social</h2>
      <p class="sub" style="margin-bottom:12px;">People you follow on RetroAchievements</p>`;
  if(socialError){
    html += `<div class="error-box">Could not load your following list: ${socialEsc(socialError)}</div>`;
  }else if(socialLoading && socialFriends.length === 0){
    html += '<div class="loading">Loading</div>';
  }else if(socialFriends.length === 0){
    html += '<div class="empty">You\u2019re not following anyone on RetroAchievements yet.</div>';
  }else{
    html += '<div class="soc-list">' + socialSorted().map(f => {
      const info = socialInfo(f);
      const sub = f.failed ? '<p class="soc-rp">Couldn\u2019t load activity</p>'
        : !f.summary ? '<p class="soc-rp">Loading…</p>'
        : `<p class="soc-game">${socialEsc(info.game || 'No recent games')}</p>${info.presence ? `<p class="soc-rp">${socialEsc(info.presence)}</p>` : ''}`;
      return `<button class="soc-row" type="button" data-name="${socialEsc(f.name)}">
          ${socialAvatarHtml(f.name)}
          <span class="soc-main"><span class="soc-name">${socialEsc(f.name)}</span>${sub}</span>
          ${f.summary ? socialStatusHtml(info) : ''}
        </button>`;
    }).join('') + '</div>';
    if(socialTotal > socialFriends.length){
      html += `<p class="soc-note">Showing ${socialFriends.length} of ${socialTotal} people you follow.</p>`;
    }
  }
  html += `<button class="btn-ghost soc-refresh" id="social-refresh-btn" type="button" ${socialLoading ? 'disabled' : ''}>${socialLoading ? 'Loading…' : 'Refresh'}</button>
      <p class="soc-find">${SOCIAL_FIND_HTML}</p>`;
  body.innerHTML = html;
  socialWireAvatars(body);
  body.querySelectorAll('.soc-row').forEach(row => {
    row.addEventListener('click', () => openSocialDetail(row.dataset.name));
  });
  const rb = $('#social-refresh-btn');
  if(rb) rb.addEventListener('click', () => loadSocial(true));
}

async function loadSocial(force){
  if(!creds || !creds.username || !creds.apiKey){
    $('#social-body').innerHTML = '<h2 style="margin-bottom:4px;">Social</h2><div class="empty">Connect RetroAchievements first (Menu → RetroAchievements) to see the people you follow.</div>';
    return;
  }
  if(!force && socialFriends.length && (Date.now() - socialLoadedAt) < SOCIAL_CACHE_MS){
    renderSocialList();
    return;
  }
  const token = ++socialToken;
  socialLoading = true;
  socialError = '';
  if(force || !socialFriends.length) socialFriends = [];
  renderSocialList();
  try{
    const data = await raFetch('API_GetUsersIFollow.php', { c: SOCIAL_MAX_FRIENDS });
    if(token !== socialToken) return;
    const results = (data && (data.Results || data.results)) || [];
    socialTotal = Number((data && (data.Total ?? data.total)) || results.length);
    const prev = {};
    socialFriends.forEach(f => { prev[f.name.toLowerCase()] = f; });
    socialFriends = results.map(r => {
      const name = r.User || r.user;
      return { name, points: r.Points ?? r.points ?? 0, summary: null, failed: false };
    }).filter(f => f.name);
    renderSocialList();
    // Presence needs one summary call per person; run a few at a time.
    let next = 0;
    const worker = async () => {
      while(token === socialToken){
        const i = next++;
        if(i >= socialFriends.length) return;
        const f = socialFriends[i];
        try{
          f.summary = await raFetch('API_GetUserSummary.php', { u: f.name, g: 1, a: 0 });
        }catch(e){ f.failed = true; }
        if(token === socialToken && socialView.mode === 'list' && $('#social-backdrop').classList.contains('open')){
          if(i % 4 === 3 || i === socialFriends.length - 1) renderSocialList();
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    if(token !== socialToken) return;
    socialLoadedAt = Date.now();
  }catch(e){
    if(token !== socialToken) return;
    socialError = e && e.message ? e.message : String(e);
  }
  if(token === socialToken){
    socialLoading = false;
    if(socialView.mode === 'list') renderSocialList();
  }
}

function renderSocialDetail(f, unlocks, unlocksError){
  const body = $('#social-body');
  const info = socialInfo(f);
  const profileUrl = 'https://retroachievements.org/user/' + encodeURIComponent(f.name);
  let html = `<button class="soc-back" id="social-back-btn" type="button">‹ Back</button>
      <div class="soc-head">
        ${socialAvatarHtml(f.name, 'lg')}
        <div style="min-width:0;flex:1;">
          <h2 style="margin:0 0 3px;">${socialEsc(f.name)}</h2>
          <div>${f.summary ? socialStatusHtml(info) : ''}</div>
        </div>
      </div>`;
  if(f.summary){
    html += `<div class="soc-now">
        ${info.game ? `<p class="soc-game">${socialEsc(info.game)}${f.summary.LastGame && f.summary.LastGame.ConsoleName ? ` <span class="soc-console">· ${socialEsc(f.summary.LastGame.ConsoleName)}</span>` : ''}</p>` : ''}
        ${info.presence ? `<p class="soc-rp">${socialEsc(info.presence)}</p>` : ''}
        <p class="soc-rp">${socialEsc(Number(f.points || f.summary.TotalPoints || 0).toLocaleString())} hardcore points</p>
      </div>`;
  }
  html += `<a class="btn-primary soc-profile-link" href="${profileUrl}" target="_blank" rel="noopener">View profile on RetroAchievements ↗</a>
      <div class="section-title" style="margin-top:18px;">Recent unlocks</div>`;
  if(unlocksError){
    html += `<div class="error-box">Could not load unlocks: ${socialEsc(unlocksError)}</div>`;
  }else if(!unlocks){
    html += '<div class="loading">Loading</div>';
  }else if(unlocks.length === 0){
    html += `<div class="empty">No unlocks in the last ${SOCIAL_UNLOCK_DAYS} days.</div>`;
  }else{
    html += '<div class="unlock-list">' + unlocks.map(a => {
      const hc = Number(a.HardcoreMode) === 1;
      return `<div class="unlock">
          <div class="unlock-row">
            <img src="${socialEsc(imgUrl('/Badge/' + a.BadgeName + '.png'))}" alt="">
            <div class="info"><p class="t">${socialEsc(a.Title)}</p><p class="g">${socialEsc(a.GameTitle)}</p></div>
            ${hc ? '<span class="pill pill-muted">HC</span>' : ''}
            <div class="pts" style="color:${hc ? 'var(--muted)' : 'var(--teal)'}">${socialEsc(a.Points)}</div>
            <div class="when">${socialEsc(timeAgo(a.Date))}</div>
          </div>
          <p class="unlock-desc">${socialEsc(a.Description || 'No description available.')}</p>
        </div>`;
    }).join('') + '</div>';
  }
  body.innerHTML = html;
  socialWireAvatars(body);
  $('#social-back-btn').addEventListener('click', renderSocialList);
  body.querySelectorAll('.unlock').forEach(row => {
    row.addEventListener('click', () => row.classList.toggle('expanded'));
  });
  $('#social-backdrop').scrollTop = 0;
}

async function openSocialDetail(name){
  const f = socialFriends.find(x => x.name === name);
  if(!f) return;
  socialView = { mode: 'detail', name };
  const key = name.toLowerCase();
  const cached = socialUnlocksCache[key];
  if(cached && (Date.now() - cached.at) < SOCIAL_CACHE_MS){
    renderSocialDetail(f, cached.list, '');
    return;
  }
  renderSocialDetail(f, null, '');
  try{
    const data = await raFetch('API_GetUserRecentAchievements.php', { u: name, m: SOCIAL_UNLOCK_DAYS * 1440 });
    const list = (Array.isArray(data) ? data : []).slice().sort((a, b) => {
      const da = parseRADate(a.Date), db = parseRADate(b.Date);
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    }).slice(0, 15);
    socialUnlocksCache[key] = { at: Date.now(), list };
    if(socialView.mode === 'detail' && socialView.name === name) renderSocialDetail(f, list, '');
  }catch(e){
    if(socialView.mode === 'detail' && socialView.name === name) renderSocialDetail(f, [], e && e.message ? e.message : String(e));
  }
}

function openSocialModal(){
  $('#social-backdrop').classList.add('open');
  loadSocial(false);
}
function closeSocialModal(){
  $('#social-backdrop').classList.remove('open');
}
