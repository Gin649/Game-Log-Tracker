// Runs in <head>: service worker registration with update detection, and request-fullscreen-on-first-tap.

  // Service worker registration and update detection. Lives here instead of in the app scripts
  // so it starts early. Reports to them through window.gltUpdateReady, a 'glt-update-ready'
  // event on window, and window.gltApplyUpdate() for the "Update app" menu item.
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

    // Announces once an installing worker has finished downloading, but only if an older
    // version is already controlling the page. A first-ever install has nothing to update from.
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
          // Or it may already be mid-download: on the first load after a deploy the browser can
          // start installing it before this callback runs, and 'updatefound' below would be missed.
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

  // Fullscreen needs a real user gesture, so grab the first tap on a non-interactive part
  // of the page and request it then. Taps on buttons, links and inputs are skipped: requesting
  // fullscreen consumes that tap's user activation, which can break gesture-gated APIs like
  // the install prompt. The manifest is "standalone", so this is what decides whether the
  // system bars are hidden. Display > 3-Button Navigation (display-mode.js) sets window.gltStandalone
  // to keep them visible, and uses gltEnterFullscreen / gltExitFullscreen when it's switched.
  (function () {
    const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
    window.gltStandalone = false;

    function enterFullscreen() {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen ||
                  el.mozRequestFullScreen || el.msRequestFullscreen;
      if (req && !fsElement()) {
        try { const p = req.call(el); if (p && p.catch) p.catch(() => {}); } catch (err) { /* non-fatal */ }
      }
    }

    function disarm() {
      window.removeEventListener('click', onTap, true);
      window.removeEventListener('touchend', onTap, true);
    }

    function onTap(e) {
      if (e.target.closest('button, a, input, select, textarea, label')) return;
      if (window.gltStandalone) return; // stay armed: 3-Button Navigation may be switched off later
      enterFullscreen();
      disarm();
    }

    // For the Display menu: switching Standalone off is itself the tap that enters fullscreen.
    window.gltEnterFullscreen = function () { disarm(); enterFullscreen(); };
    window.gltExitFullscreen = function () {
      const exit = document.exitFullscreen || document.webkitExitFullscreen ||
                   document.mozCancelFullScreen || document.msExitFullscreen;
      if (exit && fsElement()) {
        try { const p = exit.call(document); if (p && p.catch) p.catch(() => {}); } catch (err) { /* non-fatal */ }
      }
    };

    window.addEventListener('click', onTap, { capture: true });
    window.addEventListener('touchend', onTap, { capture: true });
  })();
