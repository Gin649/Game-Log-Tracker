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
