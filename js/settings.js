// Settings modals: Data export/import, About.

// Settings modals & data export/import
// Data export/import
function openDataModal(){
  $('#data-backdrop').classList.add('open');
  $('#data-status').innerHTML = '';
}
function closeDataModal(){
  $('#data-backdrop').classList.remove('open');
}

// About
// Bump this every release, together with CACHE_NAME in sw.js.
const APP_VERSION = '2.1.3.6';
function openAboutModal(){
  $('#about-version').textContent = APP_VERSION;
  $('#about-backdrop').classList.add('open');
}
function closeAboutModal(){
  $('#about-backdrop').classList.remove('open');
}

// Cached RA data is refetched on demand, so it would only make backup files bigger.
// (ra-snap: is not one of them: the playtime at the moment a game was beaten can't be fetched again.)
const REBUILDABLE_CACHE_PREFIXES = ['ra-hours:', 'ra-gameinfo:', 'ra-ach:', 'ra-dash:', 'boxcand:',
  'ra-gamelist:', 'ss3-info:', 'igdb-info2:', 'rating-igdb:', 'guide-archive-index:', 'rapatches-tree-cache-v3',
  'social-cache:', 'backlog-points'];
// A base ROM remembered for the ROM patcher is raw bytes, which a JSON file can't hold. It is left out of backups and
// picked again when needed.
const isRememberedRom = (rawKey) => /^(priv|shared):rom:/.test(rawKey);
function isRebuildableCache(rawKey){
  return REBUILDABLE_CACHE_PREFIXES.some(p => rawKey.startsWith('priv:' + p) || rawKey.startsWith('shared:' + p));
}

async function exportLocalData(){
  const all = await window.storage._getAllRaw(); // [{key, value}, ...]
  const entries = all.filter(e => !isRebuildableCache(String(e.key)) && !isRememberedRom(String(e.key)));
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
  a.download = `game-log-tracker-backup-${playLogToday()}.json`;
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
  // older backups wrote remembered ROMs out in a form that can't be read back; never put those over a working one
  await window.storage._putAllRaw(payload.entries.filter(e => e && !isRememberedRom(String(e.key))));
}

$('#btn-social-open').addEventListener('click', openSocialModal);
$('#social-close-btn').addEventListener('click', closeSocialModal);
$('#social-backdrop').addEventListener('click', (e) => {
  if(e.target.id === 'social-backdrop') closeSocialModal();
});
$('#btn-about-open').addEventListener('click', openAboutModal);
$('#about-close-btn').addEventListener('click', closeAboutModal);
$('#about-backdrop').addEventListener('click', (e) => {
  if(e.target.id === 'about-backdrop') closeAboutModal();
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
