// Vercel Serverless Function — reference implementation for a GameFAQs
// proxy. Deploy at whatever path you're already pointing GF_WORKER_URL at
// in index.html (e.g. api/proxy.js -> .../api/proxy, or api/index.js if
// you want it at the bare domain root).
//
// This does a plain raw passthrough: fetch the target URL server-side (no
// CORS restrictions apply server-to-server), then hand the response BODY
// straight back with permissive CORS headers, unmodified. It deliberately
// does NOT wrap the page in JSON (e.g. {"contents": "..."}) — the client
// expects to receive the target page's raw HTML as the response body, and
// treats a JSON-wrapped response as if it were malformed/empty content.
// If your current deployment already works at its existing path but wraps
// the response in JSON, the fix is just to change whatever it currently
// does — res.json({...}) or similar — to res.send(text) as shown below;
// the route/path itself doesn't need to move.

export default async function handler(req, res) {
  // Allow the browser to actually read this response cross-origin.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const target = req.query.url;
  if (!target || Array.isArray(target)) {
    res.status(400).send('Missing "url" query parameter.');
    return;
  }

  // Basic allowlist so this can't be turned into an open proxy for
  // arbitrary sites — only the hosts this app actually needs to reach.
  let parsed;
  try {
    parsed = new URL(target);
  } catch (e) {
    res.status(400).send('Invalid "url" parameter.');
    return;
  }
  const allowedHosts = ['gamefaqs.gamespot.com', 'html.duckduckgo.com'];
  if (!allowedHosts.includes(parsed.hostname)) {
    res.status(403).send(`Host not allowed: ${parsed.hostname}`);
    return;
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        // Some sites serve a stripped-down/anti-bot page to obvious
        // script clients; a normal browser User-Agent avoids that.
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(9000), // stay under Vercel's own function timeout
    });

    const text = await upstream.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(upstream.status).send(text); // raw body, no JSON envelope
  } catch (e) {
    res.status(502).send(`Upstream fetch failed: ${e.message}`);
  }
}
