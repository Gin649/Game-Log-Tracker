// Shared state and small helpers (the $ selector, date formatting) used by every other script.

const MEDIA = 'https://media.retroachievements.org';
let creds = null; // { username, apiKey }
let libraryData = [];
let recentGamesData = [];
let lastProfile = null; // re-used to recompute profile stats once library data loads
let userPoints = null; // { Points (hardcore), SoftcorePoints } from API_GetUserPoints.php, these are disjoint, not overlapping subsets
let statsMode = 'casual'; // 'casual' | 'hardcore', toggled from the menu
let libraryIndex = {}; // GameID -> library entry, for looking up beaten status
let librarySort = { key: '', dir: 'asc' }; // no key: the usual order, recently played first and then A to Z
let backlogSort = { key: 'Title', dir: 'asc' };
const estHoursCache = {}; // in-memory, keyed by GameID, for this session, { hours, beaten }
const achievementsListCache = {}; // in-memory, keyed by GameID, full per-achievement list with earn dates, opportunistically filled by getEstimatedHours()
let systemFilter = 'All';
let gameView = 'list'; // Game Library and Backlog: 'list' or 'tile' (Display Options)
let consoleBar = 'logos'; // the console bar shows console 'logos' (default) or 'names' (Display Options)
let tileCols = 4;       // tiles per row in tile view, 2 to 6
let libraryHideDone = false; // Game Library: hide beaten/mastered games so only ones in progress show

// Games checked in the Add Game modal's RA-system search but not yet
// committed, keyed by GameID, carries what's needed to add it later so
// selections survive typing a new search query. Cleared on modal open/close.
let addGameSelections = new Map();

// Serializes loadAll() against manual add/remove so they can't interleave. Without
// this, a game added during the initial load could be overwritten by that load's
// stale data. Queued tasks wait for the running one to settle.
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

function esc(v){
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function parseRADate(dateStr){
  if(!dateStr) return null;
  let s = String(dateStr).trim();
  if(s.indexOf('T') === -1) s = s.replace(' ', 'T');
  if(!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z'; // RA API times are UTC with no offset marker
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// "Sep 02, 2026": 3-letter month, 2-digit day, 4-digit year (locale-independent).
const BEATEN_DATE_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatBeatenDate(d){
  if(!d || isNaN(d.getTime())) return '';
  return `${BEATEN_DATE_MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
}
// Manual games store a plain "YYYY-MM-DD"; read it field-by-field so the
// timezone can't shift it to the day before.
function formatManualBeatenDate(str){
  const m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return '';
  return formatBeatenDate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}
// A saved day ("YYYY-MM-DD", or a longer date that starts that way) as that day here, not the day it is in UTC.
function parseLocalDay(str){
  if(!str) return null;
  const m =String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(str);
  return isNaN(d.getTime()) ? null : d;
}
function beatenDateHtml(text){
  return text ? `<span class="beaten-date">${text}</span>` : '';
}
function manualStatusHtml(local){
  if(local.manualBeaten){
    return '<span class="pill pill-teal">Beaten</span>' + beatenDateHtml(formatManualBeatenDate(local.manualBeatenDate));
  }
  return local.manualStarted ? '<span class="pill pill-muted">In progress</span>' : '<span class="pill pill-muted">Not started</span>';
}

// A day as short as it goes, for table columns: "Nov 7/26".
function shortDay(d){
  return d.toLocaleDateString(undefined, { month: 'short' }) + ' ' + d.getDate() + '/' + String(d.getFullYear()).slice(-2);
}
// timeAgo for a narrow column: the same for today, a short day after that.
function timeAgoShort(dateStr){
  const d = parseRADate(dateStr);
  if(!d) return '—';
  return (Date.now() - d.getTime()) / 1000 < 86400 ? timeAgo(dateStr) : shortDay(d);
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
