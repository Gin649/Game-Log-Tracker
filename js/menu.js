// Hamburger menu, the update item, and text size.

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

// App update indicator
// bootstrap.js registers the service worker and reports when a newer version has downloaded and is
// waiting (window.gltUpdateReady + the 'glt-update-ready' event). Show the gold dot on the menu
// button and an "Update available" item; tapping it swaps in the new version and reloads.
function showUpdateAvailable(){
  $('#btn-menu').classList.add('has-update');
  $('#btn-update-app').style.display = 'block';
  colorMenuItems(); // the new item joins the gold / white pattern
}
if(window.gltUpdateReady) showUpdateAvailable(); // it may have been announced before this script ran
window.addEventListener('glt-update-ready', showUpdateAvailable);
$('#btn-update-app').addEventListener('click', () => {
  const item = $('#btn-update-app');
  item.textContent = 'Updating…';
  item.disabled = true;
  if(window.gltApplyUpdate) window.gltApplyUpdate(); else location.reload();
});

// Only one menu section is open at a time. Called with the section that is opening (or none) to close the rest.
const MENU_SECTIONS = ['ra', 'display', 'pad'];
function collapseMenuSections(except){
  MENU_SECTIONS.forEach(n => {
    if(n === except) return;
    const sub = $('#' + n + '-submenu'), arrow = $('#' + n + '-heading-arrow');
    if(sub) sub.style.display = 'none';
    if(arrow) arrow.textContent = '▸';
  });
}
// Brings an opened section's heading to the top of the menu list, so the whole section shows without scrolling.
function scrollMenuTo(name){
  requestAnimationFrame(() => {
    const menu = $('#dropdown-menu'), head = $('#btn-' + name + '-heading');
    if(menu && head) menu.scrollTop = head.offsetTop - menu.offsetTop;
  });
}
// A menu heading that opens and closes its submenu.
function wireSubmenu(name){
  $('#btn-' + name + '-heading').addEventListener('click', (e) => {
    e.stopPropagation();
    const submenu = $('#' + name + '-submenu');
    const isOpen = submenu.style.display === 'block';
    if(!isOpen) collapseMenuSections(name);
    submenu.style.display = isOpen ? 'none' : 'block';
    $('#' + name + '-heading-arrow').textContent = isOpen ? '▸' : '▾';
    if(!isOpen) scrollMenuTo(name);
  });
}
['ra', 'display'].forEach(wireSubmenu); // Gamepad Config is wired in gamepad.js

// App-wide text size
// All font sizes are in rem, so changing the font-size on <html> scales them together.
// Box art and anything sized in px/%/aspect-ratio is unaffected.
const TEXTSIZE_MIN = 80, TEXTSIZE_MAX = 160, TEXTSIZE_STEP = 10, TEXTSIZE_DEFAULT = 100, TEXTSIZE_BASE_PX = 16;
const TEXTSIZE_KEY = 'app-text-size-pct';
let textSizePct = TEXTSIZE_DEFAULT;

function applyTextSize(){
  // The Nintendo pixel font is very wide, so its text is scaled down to sit like the others.
  const themeScale = document.documentElement.getAttribute('data-theme') === 'nintendo' ? 0.7 : 1;
  document.documentElement.style.fontSize = (TEXTSIZE_BASE_PX * textSizePct / 100 * themeScale) + 'px';
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
  }catch(e){ /* non-fatal, falls back to 100% */ }
  applyTextSize();
}
initTextSize();

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

// The main menu entries alternate gold and white. Items that are hidden don't count, so the pattern stays unbroken.
function colorMenuItems(){
  const menu = $('#dropdown-menu');
  if(!menu) return;
  let n = 0;
  Array.from(menu.children).forEach(el => {
    if(!el.classList.contains('dropdown-item')) return;
    if(getComputedStyle(el).display === 'none') return;
    el.classList.toggle('menu-gold', n % 2 === 0);
    el.classList.toggle('menu-white', n % 2 === 1);
    n++;
  });
}
$('#btn-menu').addEventListener('click', colorMenuItems);
setTimeout(colorMenuItems, 300);


// Game view: Game Library and Backlog as a list (default) or as tiles, with 3 to 5 tiles per row.
const GAMEVIEW_KEY = 'app-game-view', TILECOLS_KEY = 'app-tile-cols';
function applyGameViewButtons(){
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('on', b.dataset.view === gameView));
  document.querySelectorAll('.cols-btn').forEach(b => b.classList.toggle('on', Number(b.dataset.cols) === tileCols));
  const row = $('#tile-cols-row');
  if(row) row.style.display = gameView === 'tile' ? 'flex' : 'none';
}
function redrawGameViews(){
  try{ if(libraryData && libraryData.length){ renderLibrary(); renderBacklog(); } }catch(e){}
}
async function initGameView(){
  try{
    const v = await window.storage.get(GAMEVIEW_KEY, false);
    if(v && (v.value === 'tile' || v.value === 'list')) gameView = v.value;
    const c = await window.storage.get(TILECOLS_KEY, false);
    const n = c ? parseInt(c.value, 10) : NaN;
    if(n >= 3 && n <= 5) tileCols = n;
  }catch(e){}
  applyGameViewButtons();
  redrawGameViews();
}
initGameView();
document.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', (e) => {
  e.stopPropagation();
  gameView = b.dataset.view === 'tile' ? 'tile' : 'list';
  applyGameViewButtons(); redrawGameViews();
  try{ window.storage.set(GAMEVIEW_KEY, gameView, false); }catch(err){}
}));
document.querySelectorAll('.cols-btn').forEach(b => b.addEventListener('click', (e) => {
  e.stopPropagation();
  tileCols = Math.min(5, Math.max(3, Number(b.dataset.cols)));
  applyGameViewButtons(); redrawGameViews();
  try{ window.storage.set(TILECOLS_KEY, String(tileCols), false); }catch(err){}
}));

// Theme picker (Display Options). RETRO is the original look; the rest set CSS variables on <html>.
(function(){
  const buttons = document.querySelectorAll('.theme-btn');
  function mark(id){ buttons.forEach(b => b.classList.toggle('on', b.dataset.themeId === id)); }
  function apply(id){
    if(id === 'retro') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', id);
    try{ localStorage.setItem('glt-theme', id); }catch(e){}
    mark(id);
    applyTextSize();
  }
  let cur = 'retro';
  try{ cur = localStorage.getItem('glt-theme') || 'retro'; }catch(e){}
  cur = ({ nes: 'nintendo', psx: 'playstation', snes: 'retro' })[cur] || cur; // renamed or removed themes
  mark(cur);
  buttons.forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); apply(b.dataset.themeId); }));
})();
