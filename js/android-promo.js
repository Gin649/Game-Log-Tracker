// Tells Android users about the Android app (Game Log Tracker DS Launcher).
// The pop-up shows once, on Android browsers only. Whatever the user picks is remembered.
// The About link shows everywhere except inside the Android app itself.
//
// The Android app bundles these same files, so it has to be spotted and skipped:
// it adds "GLTThor" to its user agent and exposes window.ThorBridge. A plain Android
// WebView also has "; wv)" in its user agent.
(function(){
  const ua = navigator.userAgent || '';
  const inAndroidApp = !!window.ThorBridge || /GLTThor/i.test(ua) || /; wv\)/.test(ua);

  const aboutLink = document.getElementById('about-android-link');
  if(inAndroidApp){
    if(aboutLink) aboutLink.remove();
    return;
  }

  const isAndroid = (navigator.userAgentData && navigator.userAgentData.platform === 'Android')
    || /Android/i.test(ua);
  if(!isAndroid) return;

  const backdrop = document.getElementById('android-promo-backdrop');
  if(!backdrop) return;
  const KEY = 'android-app-promo-seen';

  async function alreadySeen(){
    try{
      const r = await window.storage.get(KEY, false);
      return !!(r && r.value);
    }catch(e){ return false; } // nothing stored yet
  }
  function remember(){
    try{ window.storage.set(KEY, 'true', false); }catch(e){}
  }
  function close(){
    backdrop.classList.remove('open');
    remember();
  }

  document.getElementById('android-promo-close').addEventListener('click', close);
  document.getElementById('android-promo-later').addEventListener('click', close);
  // The link opens the releases page in a new tab; this just closes the pop-up behind it.
  document.getElementById('android-promo-get').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if(e.target === backdrop) close(); });

  alreadySeen().then(seen => {
    if(seen) return;
    // A short wait so it doesn't land on top of the first paint of the dashboard.
    setTimeout(() => backdrop.classList.add('open'), 1200);
  });
})();
