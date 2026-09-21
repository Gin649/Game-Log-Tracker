// Vercel serverless function: GET /api/proxy?url=<gamefaqs url>
// Fetches a GameFAQs page server-side and returns the raw HTML with CORS headers.
const ALLOWED_ORIGINS = ['https://gin649.github.io'];

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  let target;
  try { target = new URL(String(req.query.url || '')); }
  catch (e) { res.status(400).send('Missing or invalid ?url='); return; }

  // Only ever fetch GameFAQs — this must not become an open proxy.
  if (target.protocol !== 'https:' || target.hostname !== 'gamefaqs.gamespot.com') {
    res.status(400).send('Only gamefaqs.gamespot.com URLs are allowed');
    return;
  }

  try {
    const upstream = await fetch(target.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    const body = await upstream.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600');
    res.status(upstream.status).send(body);
  } catch (e) {
    res.status(502).send('Upstream fetch failed: ' + e.message);
  }
};
