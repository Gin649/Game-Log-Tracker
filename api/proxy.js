// api/proxy.js

const ALLOWED_ORIGIN = 'https://gin649.github.io'; 
const ALLOWED_HOST = 'gamefaqs.gamespot.com';

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  
  // Set up safe CORS headers
  res.setHeader('Access-Control-Allow-Origin', origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : 'null');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET is supported' });
  }

  // Extract the target URL from the query string
  const target = req.query.url;
  if (!target) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid url parameter' });
  }

  // Enforce isolation so it only scrapes GameFAQs
  if (targetUrl.hostname !== ALLOWED_HOST) {
    return res.status(403).json({ error: `This proxy only relays ${ALLOWED_HOST}` });
  }

  try {
    // Fetch GameFAQs using realistic browser footprints
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      },
    });

    const contentType = response.headers.get('Content-Type') || 'text/html; charset=utf-8';
    const body = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    return res.status(response.status).send(Buffer.from(body));

  } catch (e) {
    return res.status(502).json({ error: `Could not reach ${ALLOWED_HOST}: ${e.message}` });
  }
}
