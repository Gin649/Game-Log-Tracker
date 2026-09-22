// ==============================================================================
// GAME LOG TRACKER — BOOTSTRAP
// Runs immediately in <head>, before the rest of the page loads: service
// worker registration and the "request fullscreen on first tap" handling
// for the installed/fullscreen PWA experience.
// ==============================================================================

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('RA Tracker Service Worker registered!'))
        .catch(err => console.log('Registration failed: ', err));
    });
  }

  // --- Fullscreen handling ---
  // The Fullscreen API can only be triggered by a real user gesture, so we
  // can't force it silently on load — instead we grab the first tap/click
  // on non-interactive parts of the page and use it to request fullscreen.
  // IMPORTANT: we deliberately skip clicks on buttons/links/inputs (like the
  // "Install" button) — calling requestFullscreen() consumes that same
  // click's user-activation, which can silently break other gesture-gated
  // APIs (e.g. the PWA install prompt) if both fire off one tap.
  (function () {
    function requestFS(e) {
      if (e.target.closest('button, a, input, select, textarea, label')) return;
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen ||
                  el.mozRequestFullScreen || el.msRequestFullscreen;
      if (req && !document.fullscreenElement && !document.webkitFullscreenElement) {
        try { req.call(el).catch(() => {}); } catch (err) { /* non-fatal */ }
      }
      window.removeEventListener('click', requestFS, true);
      window.removeEventListener('touchend', requestFS, true);
    }
    window.addEventListener('click', requestFS, { capture: true });
    window.addEventListener('touchend', requestFS, { capture: true });
  })();
