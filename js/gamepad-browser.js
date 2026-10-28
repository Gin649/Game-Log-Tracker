// Connects the device's own controls to gamepad.js, for handhelds and anything else running the
// PWA in a browser.
//
// gamepad.js decides what every button does (move the highlight, confirm, back, switch tabs and
// consoles, scroll). This file only reads the controls and passes presses to window.GLTPad, the same
// calls the Android launcher app makes from PadRouter.java, so gamepad.js stays identical in both.
//
// Two kinds of input are read:
//   - The browser's Gamepad API: external pads and handhelds whose controls show up as a gamepad.
//     Browsers hide a pad until a button is pressed on it.
//   - Keyboard keys: some handhelds (Android ones especially) send their D-pad and buttons to the
//     page as arrow keys, Enter and Escape instead. Turn this off under Controller in the menu if a
//     real keyboard gets in the way.
// "Test controller" in the menu shows what the device is actually sending.
(function(){
  if(!window.GLTPad) return;

  // Same thresholds as PadRouter.java.
  const STICK_ON = 0.55, STICK_OFF = 0.35;   // left stick counts as a direction, with a little hysteresis
  const RIGHT_DEAD = 0.15;                   // right stick dead zone
  const TRIGGER_ON = 0.6, TRIGGER_OFF = 0.3; // analog triggers
  const KEYS_SETTING = 'pad-keys';

  // Button numbers in the standard layout. Pads that don't report it get the same numbers as a guess.
  const BUTTONS = [
    [0, 'a'], [1, 'b'], [2, 'x'], [3, 'y'],
    [4, 'l1'], [5, 'r1'], [6, 'l2'], [7, 'r2'],
    [8, 'select'], [9, 'start'],
  ];
  const DPAD = { up: 12, down: 13, left: 14, right: 15 };
  const ANALOG = new Set(['l2', 'r2']);
  const NAMES = ['up', 'down', 'left', 'right'].concat(BUTTONS.map(b => b[1]));

  // Keyboard keys, for controls that arrive as keys.
  const KEY_MAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Enter: 'a', Escape: 'b', Backspace: 'b',
    PageUp: 'l1', PageDown: 'r1',
    x: 'x', X: 'x',
  };

  const fromPad = {};   // what the gamepad says is held
  const fromKeys = {};  // what the keyboard says is held
  const sent = {};      // what gamepad.js has been told is held
  let stickDir = null;  // direction the left stick is currently pushed toward
  let sentRight = 0;
  let raf = 0;
  let paused = false;   // true while the window is in the background
  let keysOn = /Android/i.test(navigator.userAgent); // overwritten by the saved setting
  let lastKey = '';
  let lastConnected = '';

  const $dbg = () => document.getElementById('pad-debug');
  const debugOpen = () => { const d = $dbg(); return !!d && d.style.display === 'block'; };

  function update(name){
    const down = !!(fromPad[name] || fromKeys[name]);
    if(!!sent[name] === down) return;
    sent[name] = down;
    window.GLTPad.b(name, down ? 1 : 0);
  }

  // Lets go of everything, for when the controller goes away or the page loses focus mid-press.
  function releaseAll(){
    const holding = stickDir || sentRight || NAMES.some(n => sent[n]);
    NAMES.forEach(n => { fromPad[n] = false; fromKeys[n] = false; sent[n] = false; });
    stickDir = null;
    sentRight = 0;
    if(holding) window.GLTPad.reset();
  }

  function connectedPads(){
    return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(p => p && p.connected);
  }

  // Direction the left stick is pushed, from whichever controller has it pushed furthest.
  function leftStick(pads){
    let x = 0, y = 0;
    for(const p of pads){
      const px = p.axes[0] || 0, py = p.axes[1] || 0;
      if(Math.max(Math.abs(px), Math.abs(py)) > Math.max(Math.abs(x), Math.abs(y))){ x = px; y = py; }
    }
    const ax = Math.abs(x), ay = Math.abs(y);
    if(Math.max(ax, ay) < (stickDir ? STICK_OFF : STICK_ON)) return null;
    if(ax > ay) return x < 0 ? 'left' : 'right';
    return y < 0 ? 'up' : 'down';
  }

  // Vertical right stick, -1 (up) to 1 (down), with the dead zone taken out.
  function rightStick(pads){
    let v = 0;
    for(const p of pads){
      const pv = p.axes[3] || 0;
      if(Math.abs(pv) > Math.abs(v)) v = pv;
    }
    const mag = Math.abs(v);
    return mag < RIGHT_DEAD ? 0 : Math.sign(v) * (mag - RIGHT_DEAD) / (1 - RIGHT_DEAD);
  }

  // D-pad on one pad. Most report it as buttons 12-15; some report it as two axes (6 and 7).
  function dpadPressed(p, dir){
    const btn = p.buttons[DPAD[dir]];
    if(btn && btn.pressed) return true;
    if(p.mapping === 'standard') return false;
    const ax = p.axes[6] || 0, ay = p.axes[7] || 0;
    if(dir === 'left') return ax < -0.5;
    if(dir === 'right') return ax > 0.5;
    if(dir === 'up') return ay < -0.5;
    return ay > 0.5;
  }

  function readPads(pads){
    stickDir = leftStick(pads);
    for(const dir of Object.keys(DPAD)){
      fromPad[dir] = stickDir === dir || pads.some(p => dpadPressed(p, dir));
    }
    for(const [index, name] of BUTTONS){
      fromPad[name] = pads.some(p => {
        const btn = p.buttons[index];
        if(!btn) return false;
        if(!ANALOG.has(name)) return btn.pressed;
        return btn.value > (sent[name] ? TRIGGER_OFF : TRIGGER_ON);
      });
    }
    NAMES.forEach(update);

    const v = rightStick(pads);
    if(Math.abs(v - sentRight) > 0.03 || (v === 0 && sentRight !== 0)){
      sentRight = v;
      window.GLTPad.rs(v);
    }
  }

  function poll(){
    raf = 0;
    const pads = paused ? [] : connectedPads();
    if(pads.length) readPads(pads);
    else{ // no controller right now: let go of whatever it was holding, but not a held key
      NAMES.forEach(n => { fromPad[n] = false; update(n); });
      if(sentRight){ sentRight = 0; window.GLTPad.rs(0); }
      stickDir = null;
    }
    if(debugOpen()) renderDebug();
    // Keep watching while a controller is connected (the page may just be in the background) or the
    // test panel is open; otherwise sleep until gamepadconnected wakes this up.
    if(pads.length || connectedPads().length || debugOpen()) raf = requestAnimationFrame(poll);
  }

  function start(){
    if(!raf) raf = requestAnimationFrame(poll);
  }

  // ---- keyboard ------------------------------------------------------------------------------

  function typing(el){
    if(!el) return false;
    if(el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
    return el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|file|range|color)$/.test(el.type);
  }

  function describeKey(e, verb){
    lastKey = verb + ' key=' + e.key + ' code=' + e.code + ' keyCode=' + e.keyCode;
    if(debugOpen()) renderDebug();
  }

  document.addEventListener('keydown', (e) => {
    describeKey(e, 'down');
    const name = KEY_MAP[e.key];
    if(!keysOn || !name || typing(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;
    e.preventDefault(); // stops the arrow keys scrolling the page underneath the highlight
    fromKeys[name] = true;
    update(name);
  }, true);

  document.addEventListener('keyup', (e) => {
    describeKey(e, 'up');
    const name = KEY_MAP[e.key];
    if(!name || !fromKeys[name]) return;
    fromKeys[name] = false;
    update(name);
  }, true);

  // ---- test panel and settings in the menu ----------------------------------------------------

  function renderDebug(){
    const pads = connectedPads();
    const lines = [
      'page focused: ' + (document.hasFocus() ? 'yes' : 'no') + (paused ? ' (paused)' : ''),
      'gamepad API: ' + (navigator.getGamepads ? 'yes' : 'not available'),
      'controllers: ' + pads.length + (pads.length ? '' : ' (press a button on the controller)'),
    ];
    pads.forEach((p, i) => {
      const held = [];
      p.buttons.forEach((b, n) => { if(b.pressed || b.value > 0.3) held.push(n); });
      lines.push('[' + i + '] ' + p.id.slice(0, 60));
      lines.push('    layout: ' + (p.mapping || 'not standard') + ', ' + p.buttons.length + ' buttons, ' + p.axes.length + ' axes');
      lines.push('    buttons held: ' + (held.join(' ') || 'none'));
      lines.push('    axes: ' + p.axes.map(a => a.toFixed(2)).join(' '));
    });
    if(lastConnected) lines.push('last connected: ' + lastConnected.slice(0, 60));
    lines.push('keys: ' + (keysOn ? 'on' : 'off') + ', last ' + (lastKey || 'none yet'));
    $dbg().textContent = lines.join('\n');
  }

  function syncKeysUi(){
    const sw = document.getElementById('pad-keys-switch');
    if(!sw) return;
    sw.classList.toggle('on', keysOn);
    sw.setAttribute('aria-checked', keysOn ? 'true' : 'false');
  }

  const testBtn = document.getElementById('pad-test-btn');
  if(testBtn) testBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const d = $dbg();
    const open = d.style.display !== 'block';
    d.style.display = open ? 'block' : 'none';
    document.getElementById('pad-test-arrow').textContent = open ? '▾' : '▸';
    if(open){ renderDebug(); start(); }
  });

  const keysSwitch = document.getElementById('pad-keys-switch');
  if(keysSwitch) keysSwitch.addEventListener('click', async (e) => {
    e.stopPropagation();
    keysOn = !keysOn;
    if(!keysOn){ NAMES.forEach(n => { fromKeys[n] = false; update(n); }); }
    syncKeysUi();
    try{ await window.storage.set(KEYS_SETTING, keysOn ? '1' : '0', false); }catch(err){ /* non-fatal */ }
  });

  (async () => {
    try{
      const saved = await window.storage.get(KEYS_SETTING, false);
      keysOn = !!saved && saved.value === '1';
    }catch(e){ /* nothing saved yet, keep the default for this device */ }
    syncKeysUi();
  })();

  // ---- wiring --------------------------------------------------------------------------------

  window.addEventListener('gamepadconnected', (e) => { lastConnected = e.gamepad ? e.gamepad.id : ''; start(); });
  // The browser stops updating pads in the background, so ignore them until the page is back.
  window.addEventListener('blur', () => { paused = true; releaseAll(); });
  window.addEventListener('focus', () => { paused = false; });
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){ paused = true; releaseAll(); } else paused = false;
  });
  start(); // a controller that was already connected before the page loaded
})();
