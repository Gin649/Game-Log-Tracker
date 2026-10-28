// Reads a controller through the browser's Gamepad API and reports it to gamepad.js.
//
// gamepad.js decides what every button does (move the highlight, confirm, back, switch tabs and
// consoles, scroll). This file only watches the controller and passes presses to window.GLTPad, the
// same calls the Android launcher app makes from PadRouter.java, so gamepad.js stays identical in
// both projects.
//
// Browsers hide a controller until a button is pressed on it, and stop reporting it while the page
// is in the background. Only controllers with the browser's "standard" layout are used, because
// that is the one layout where the button numbers mean the same thing on every controller.
(function(){
  if(!navigator.getGamepads || !window.GLTPad) return;

  // Same thresholds as PadRouter.java.
  const STICK_ON = 0.55, STICK_OFF = 0.35;   // left stick counts as a direction, with a little hysteresis
  const RIGHT_DEAD = 0.15;                   // right stick dead zone
  const TRIGGER_ON = 0.6, TRIGGER_OFF = 0.3; // analog triggers

  // Button numbers in the standard layout.
  const BUTTONS = [
    [0, 'a'], [1, 'b'], [2, 'x'], [3, 'y'],
    [4, 'l1'], [5, 'r1'], [6, 'l2'], [7, 'r2'],
    [8, 'select'], [9, 'start'],
  ];
  const DPAD = { up: 12, down: 13, left: 14, right: 15 };
  const ANALOG = new Set(['l2', 'r2']);

  const sent = {};      // what gamepad.js has been told is held right now
  let stickDir = null;  // direction the left stick is currently pushed toward
  let sentRight = 0;
  let raf = 0;

  function standardPads(){
    return Array.from(navigator.getGamepads()).filter(p => p && p.connected && p.mapping === 'standard');
  }

  function send(name, down){
    if(!!sent[name] === down) return;
    sent[name] = down;
    window.GLTPad.b(name, down ? 1 : 0);
  }

  // Lets go of everything, for when the controller goes away or the page loses focus mid-press.
  function releaseAll(){
    const holding = stickDir || sentRight || Object.keys(sent).some(k => sent[k]);
    Object.keys(sent).forEach(k => { sent[k] = false; });
    stickDir = null;
    sentRight = 0;
    if(holding) window.GLTPad.reset();
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

  function poll(){
    raf = 0;
    const pads = document.hasFocus() ? standardPads() : [];
    if(!pads.length){
      releaseAll();
      // Keep watching only if a controller is connected (the page may just be unfocused);
      // otherwise stop until gamepadconnected starts the loop again.
      if(Array.from(navigator.getGamepads()).some(p => p && p.connected)) raf = requestAnimationFrame(poll);
      return;
    }

    stickDir = leftStick(pads);
    for(const dir of Object.keys(DPAD)){
      const pressed = pads.some(p => p.buttons[DPAD[dir]] && p.buttons[DPAD[dir]].pressed);
      send(dir, pressed || stickDir === dir);
    }

    for(const [index, name] of BUTTONS){
      const down = pads.some(p => {
        const btn = p.buttons[index];
        if(!btn) return false;
        if(!ANALOG.has(name)) return btn.pressed;
        return btn.value > (sent[name] ? TRIGGER_OFF : TRIGGER_ON);
      });
      send(name, down);
    }

    const v = rightStick(pads);
    if(Math.abs(v - sentRight) > 0.03 || (v === 0 && sentRight !== 0)){
      sentRight = v;
      window.GLTPad.rs(v);
    }

    raf = requestAnimationFrame(poll);
  }

  function start(){
    if(!raf) raf = requestAnimationFrame(poll);
  }

  window.addEventListener('gamepadconnected', start);
  window.addEventListener('blur', () => { if(raf) releaseAll(); });
  document.addEventListener('visibilitychange', () => { if(document.hidden && raf) releaseAll(); });
  start(); // a controller that was already connected before the page loaded
})();
