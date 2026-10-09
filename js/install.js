// Add-to-home-screen banner.

// Install prompt. Chrome/Edge/Android only show install UI if the page catches
// beforeinstallprompt and offers its own button. iOS Safari never fires it, so
// there we show a "Share > Add to Home Screen" hint instead.
(function(){
  const banner = document.getElementById('install-banner');
  const msgEl = document.getElementById('install-banner-msg');
  const installBtn = document.getElementById('btn-install-app');
  const dismissBtn = document.getElementById('install-banner-dismiss');
  if(!banner) return;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true; // iOS Safari's own installed-flag
  if(isStandalone) return; // already installed, never show this

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  let deferredPrompt = null;

  async function wasDismissed(){
    try{
      const r = await window.storage.get('pwa-install-dismissed', false);
      return !!(r && r.value);
    }catch(e){ return false; } // nothing stored yet, not dismissed
  }
  async function setDismissed(){
    try{ await window.storage.set('pwa-install-dismissed', 'true', false); }catch(e){}
  }

  (async () => {
    if(await wasDismissed()) return;
    if(isIOS){
      msgEl.textContent = 'Install this app: tap the Share icon, then "Add to Home Screen".';
      installBtn.style.display = 'none';
      banner.style.display = 'flex';
    }
    // Non-iOS: stays hidden until (and unless) beforeinstallprompt fires below.
  })();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    wasDismissed().then(dismissed => {
      if(dismissed) return;
      msgEl.textContent = 'Install Game Log Tracker on your device for quick, offline access.';
      installBtn.style.display = 'inline-block';
      banner.style.display = 'flex';
    });
  });

  installBtn.addEventListener('click', async () => {
    if(!deferredPrompt) return;
    installBtn.disabled = true;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    banner.style.display = 'none';
    installBtn.disabled = false;
  });

  window.addEventListener('appinstalled', () => {
    banner.style.display = 'none';
    setDismissed();
  });

  dismissBtn.addEventListener('click', () => {
    banner.style.display = 'none';
    setDismissed();
  });
})();
