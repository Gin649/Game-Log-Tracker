// Display > 3-Button Navigation (standalone mode): keeps the phone's system bars (and the bottom navigation bar)
// visible instead of letting the app go fullscreen. bootstrap.js owns the fullscreen request;
// this just tells it what to do and remembers the choice. Off by default, so the app opens
// fullscreen on the first tap like before.

const STANDALONE_KEY = 'display-standalone-on';
// iPhone Safari has no fullscreen API at all, so there is nothing to switch there.
const FULLSCREEN_API = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
let standaloneOn = false;

function applyStandalone(on){
  standaloneOn = on && FULLSCREEN_API;
  window.gltStandalone = standaloneOn;
  const toggle = $('#display-standalone-switch');
  toggle.classList.toggle('on', standaloneOn);
  toggle.setAttribute('aria-checked', String(standaloneOn));
  if(standaloneOn && window.gltExitFullscreen) window.gltExitFullscreen();
}

async function initStandalone(){
  if(!FULLSCREEN_API){
    $('#display-standalone-switch').disabled = true;
    $('#display-standalone-note').textContent = 'Not needed on this device';
    return;
  }
  try{
    const saved = await window.storage.get(STANDALONE_KEY, false);
    if(saved && saved.value === '1') applyStandalone(true);
  }catch(e){ /* nothing saved yet */ }
}
initStandalone();

$('#display-standalone-switch').addEventListener('click', async (e) => {
  e.stopPropagation();
  const next = !standaloneOn;
  applyStandalone(next);
  if(!next && window.gltEnterFullscreen) window.gltEnterFullscreen(); // this tap is the user gesture it needs
  try{ await window.storage.set(STANDALONE_KEY, next ? '1' : '0', false); }catch(err){ /* non-fatal */ }
});
