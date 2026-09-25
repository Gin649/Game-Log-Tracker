// ==============================================================================
// GAME LOG TRACKER — BOOTSTRAP
// Runs immediately in <head>, before the rest of the page loads: service
// worker registration and the "request fullscreen on first tap" handling
// for the installed/fullscreen PWA experience.
// ==============================================================================

  // --- Service worker + update detection ---
  // Lives here (not in app.js) because it needs no page elements and should start as early as
  // possible. It reports to the UI through two things app.js reads:
  //   window.gltUpdateReady          true once a newer version has downloaded and is waiting
  //   'glt-update-ready' event        fired on window at that moment
  // and exposes window.gltApplyUpdate() for the "Update app" menu item.
  if ('serviceWorker' in navigator) {
    let reg = null;
    let userRequestedUpdate = false;
    let reloading = false;
    let lastCheck = 0;

    function announceUpdate() {
      window.gltUpdateReady = true;
      window.dispatchEvent(new Event('glt-update-ready'));
    }

    // Ask the server whether sw.js changed. Runs whenever the app is opened or resumed, not on a timer.
    function checkForUpdate() {
      if (!reg) return;
      const now = Date.now();
      if (now - lastCheck < 15000) return; // resume events can fire in quick bursts
      lastCheck = now;
      reg.update().catch(() => { /* offline or server hiccup: try again next resume */ });
    }

    // When the new version takes over, reload onto its files. Only if the user asked for the update:
    // the very first install also fires this event (the worker claims the page) and must not reload.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!userRequestedUpdate || reloading) return;
      reloading = true;
      window.location.reload();
    });

    // Called by the "Update app" menu item.
    window.gltApplyUpdate = function () {
      userRequestedUpdate = true;
      const waiting = reg && reg.waiting;
      if (waiting) {
        waiting.postMessage({ type: 'SKIP_WAITING' });
        // Safety net in case the takeover event never arrives.
        setTimeout(() => { if (!reloading) { reloading = true; window.location.reload(); } }, 4000);
      } else {
        window.location.reload();
      }
    };

    // Watches one installing worker and announces once it's fully downloaded. Only matters when
    // there's already a controller (an older version running this page) — a bare first-ever install
    // has no earlier version to update FROM, so there's nothing to announce.
    function watchInstalling(worker) {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) announceUpdate();
      });
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
        .then((registration) => {
          reg = registration;

          // A newer version may already be waiting from an earlier visit (downloaded, never applied).
          if (reg.waiting && navigator.serviceWorker.controller) announceUpdate();
          // A newer version may already be mid-download — this happens on the very first page load
          // after deploying an update, since the browser can start installing it as soon as register()
          // notices sw.js changed, before this .then() callback runs. Without this check, the
          // 'updatefound' event below fires and is missed, and the update is never announced.
          else watchInstalling(reg.installing);

          // A newer version starts downloading later, while this page stays open: catch it as it happens.
          reg.addEventListener('updatefound', () => watchInstalling(reg.installing));

          // Check whenever the app comes back to the foreground / is reopened / regains connection.
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') checkForUpdate();
          });
          window.addEventListener('pageshow', (e) => { if (e.persisted) checkForUpdate(); });
          window.addEventListener('online', checkForUpdate);
        })
        .catch((err) => console.log('Service worker registration failed: ', err));
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
