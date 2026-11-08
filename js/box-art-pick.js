// Box art picker: tap the cover in a game's profile to see it full screen, then swipe left/right (or use the arrows) to
// browse other covers for the game and press "Use this one" to keep it. The choice is saved on this device.
// The list of covers is only fetched when you first move away from the current picture, never when a profile opens.
//   boxpick:<gameId>  the cover you chose (a picture address). Part of the backup, so it follows you.
//   boxcand:<gameId>  the covers found for the game, kept 30 days (rebuilt on demand, not part of the backup).
const BOXPICK_PREFIX = 'boxpick:';
const BOXCAND_TTL = 30 * 24 * 60 * 60 * 1000;
const boxPickMem = new Map(); // gameId -> url | null, so the profile doesn't wait on storage twice

async function getBoxPick(gameId){
  const id = String(gameId);
  if(boxPickMem.has(id)) return boxPickMem.get(id);
  let url = null;
  try{
    const r = await window.storage.get(BOXPICK_PREFIX + id, false);
    if(r && r.value) url = String(r.value);
  }catch(e){}
  boxPickMem.set(id, url);
  return url;
}
async function setBoxPick(gameId, url){
  const id = String(gameId);
  boxPickMem.set(id, url || null);
  try{
    if(url) await window.storage.set(BOXPICK_PREFIX + id, url, false);
    else await window.storage.delete(BOXPICK_PREFIX + id, false);
  }catch(e){}
}

// Every cover we can find for a game: [{ label, url }]. The first entry is always the picture the profile shows now.
// ScreenScraper's regional covers and IGDB's cover come from the Worker; the game's own picture (RetroAchievements or
// what you added) is kept as "Original". No SteamGridDB.
async function loadBoxCandidates(ctx){
  const id = String(ctx.gameId);
  const ckey = 'boxcand:' + id;
  try{
    const r = await window.storage.get(ckey, false);
    if(r && r.value){
      const c = JSON.parse(r.value);
      if(Date.now() - c.ts < BOXCAND_TTL && Array.isArray(c.list) && c.list.length) return c.list;
    }
  }catch(e){}
  const clean = String(ctx.title || '').replace(/^(?:~[^~]*~\s*)+/, '').trim();
  const hack = /^\s*~hack~/i.test(String(ctx.title || ''));
  const list = [];
  const seen = new Set();
  const add = (label, url) => { if(url && !seen.has(url)){ seen.add(url); list.push({ label, url }); } };
  if(ctx.original) add('Original', ctx.original);
  if(clean && !hack){
    const ss = ctx.consoleName
      ? fetchWithTimeout(`${SS_WORKER}/ss/info?title=${encodeURIComponent(clean)}&system=${encodeURIComponent(ctx.consoleName)}`, 15000)
          .then(r => r.ok ? r.json() : null).catch(() => null)
      : Promise.resolve(null);
    const ig = fetchWithTimeout(`${SS_WORKER}/igdb/info?name=${encodeURIComponent(clean)}`, 12000)
      .then(r => r.ok ? r.json() : null).catch(() => null);
    const [s, g] = await Promise.all([ss, ig]);
    if(s && s.found){
      (Array.isArray(s.boxes) && s.boxes.length ? s.boxes : (s.box ? [{ label: 'ScreenScraper', url: s.box }] : []))
        .forEach(b => add('ScreenScraper · ' + b.label, b.url));
    }
    if(g && g.cover) add('IGDB', g.cover);
  }
  if(list.length > 1){
    try{ await window.storage.set(ckey, JSON.stringify({ list, ts: Date.now() }), false); }catch(e){}
  }
  return list;
}
