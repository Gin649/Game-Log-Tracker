// RAWG key and review score lookups.

// RAWG ratings (optional)
// RAWG auths with a plain API key as a URL query param, and, unlike RA,
// actually supports CORS for direct browser calls, so this tries direct
// first and only falls back to proxies if that fails.
let rawgCreds = null; // { apiKey }, lazy-loaded

async function loadRawgCreds(){
  try{
    const r = await window.storage.get('rawg-credentials', false);
    if(r && r.value) return JSON.parse(r.value);
  }catch(e){ /* not set up yet */ }
  return null;
}
async function saveRawgCreds(apiKey){
  try{ await window.storage.set('rawg-credentials', JSON.stringify({ apiKey }), false); }
  catch(e){ /* non-fatal */ }
}
async function removeRawgCreds(){
  rawgCreds = null;
  try{ await window.storage.delete('rawg-credentials', false); }catch(e){ /* non-fatal */ }
}

async function rawgGet(url){
  function raceFirstSuccess(promises){
    return new Promise((resolve, reject) => {
      let remaining = promises.length;
      const errors = [];
      promises.forEach(p => {
        p.then(resolve, (err) => {
          errors.push(err && err.message ? err.message : String(err));
          remaining--;
          if(remaining === 0) reject(new Error(errors.join('; ')));
        });
      });
    });
  }

  async function attempt(label, run){
    let res;
    try{ res = await run(); }
    catch(networkErr){ throw new Error(`${label}: blocked (${networkErr.message})`); }
    if(!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
    let data;
    try{ data = await res.json(); }
    catch(e){ throw new Error(`${label}: response wasn't valid JSON`); }
    return data;
  }

  try{
    return await attempt('direct', () => fetch(url));
  }catch(directErr){ /* fall through to proxies */ }

  return raceFirstSuccess([
    attempt('allorigins', () => fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url))),
    attempt('codetabs',   () => fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url))),
    attempt('corsproxy',  () => fetch('https://corsproxy.io/?url=' + encodeURIComponent(url))),
    attempt('thingproxy', () => fetch('https://thingproxy.freeboard.io/fetch/' + url)),
    attempt('corseu',     () => fetch('https://cors.eu.org/' + url)),
  ]);
}

async function fetchRawgRatingLive(title){
  if(!rawgCreds) rawgCreds = await loadRawgCreds();
  if(!rawgCreds || !rawgCreds.apiKey) return null;

  const url = `https://api.rawg.io/api/games?key=${encodeURIComponent(rawgCreds.apiKey)}&search=${encodeURIComponent(title)}&page_size=5`;
  const json = await rawgGet(url);
  const results = (json && json.results) || [];
  if(results.length === 0) return null;

  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Prefer RAWG's real Metacritic score when they have one on file; fall
  // back to RAWG's own community rating (scaled 0-5 -> 0-100) otherwise,
  // common for older/retro titles Metacritic never covered. Critically,
  // RAWG returns rating:0 / metacritic:0 for games with NO data yet, not
  // null, so those need to be treated as "nothing here", not a real 0.
  function extractScore(g){
    if(g.metacritic != null && g.metacritic > 0){
      return { score: g.metacritic, metacritic: true };
    }
    if(g.rating != null && g.rating > 0 && Number(g.ratings_count) > 0){
      return { score: g.rating * 20, metacritic: false };
    }
    return null;
  }

  // Try the exact title match first, but if that entry has no usable score,
  // check the other results the search returned before giving up entirely,
  // sometimes the exact match is a barely-populated RAWG entry while a
  // closely related listing among the top results has real review data.
  const exact = results.find(r => norm(r.name) === norm(title));
  const ordered = exact ? [exact, ...results.filter(r => r !== exact)] : results;

  for(const g of ordered){
    const extracted = extractScore(g);
    if(extracted){
      return {
        score: Math.round(extracted.score),
        metacritic: extracted.metacritic,
        matchedName: g.name,
      };
    }
  }
  return null;
}

async function getRawgRating(title, forceRefresh){
  const cacheKey = `rawg-rating:${title.toLowerCase()}`;
  if(!forceRefresh){
    try{
      const r = await window.storage.get(cacheKey, false);
      if(r && r.value){
        const parsed = JSON.parse(r.value);
        const isStaleZeroBug = parsed.data && parsed.data.score === 0; // fixed bug artifact, never a real score
        const ttl = parsed.data ? 30 * 24 * 60 * 60 * 1000 : 10 * 60 * 1000;
        if(!isStaleZeroBug && Date.now() - parsed.ts < ttl) return parsed.data;
      }
    }catch(e){ /* not cached yet */ }
  }

  let data = null;
  try{ data = await fetchRawgRatingLive(title); }
  catch(e){
    data = null;
    console.error(`RAWG lookup failed for "${title}":`, e.message);
  }

  try{ await window.storage.set(cacheKey, JSON.stringify({ data, ts: Date.now() }), false); }
  catch(e){ /* non-fatal */ }
  return data;
}
