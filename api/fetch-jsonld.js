// Serverless function to fetch HTML and extract JSON-LD blocks
// Bypasses CORS restrictions for client-side parsing

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ ok: false, error: 'Missing url parameter' });
  }

  // Validate URL format
  let targetUrl;
  try {
    targetUrl = new URL(url);
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'Invalid URL format' });
  }

  try {
    // Fetch HTML with browser-like headers
    const fetchResponse = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
      // Set a reasonable timeout
      signal: AbortSignal.timeout(10000), // 10 seconds
    });

    if (!fetchResponse.ok) {
      return res.status(fetchResponse.status).json({
        ok: false,
        error: `HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`,
      });
    }

    const html = await fetchResponse.text();

    // Extract all <script type="application/ld+json"> blocks
    const scriptPattern = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const scripts = [];
    let match;

    while ((match = scriptPattern.exec(html)) !== null) {
      const jsonText = match[1].trim();
      if (!jsonText) continue;

      // Try to parse JSON, with tolerance for trailing commas
      let parsed;
      try {
        // First attempt: direct parse
        parsed = JSON.parse(jsonText);
      } catch (e) {
        // Second attempt: clean trailing commas and try again
        try {
          const cleaned = jsonText
            .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas before } or ]
            .replace(/,\s*$/, ''); // Remove trailing comma at end of string
          parsed = JSON.parse(cleaned);
        } catch (e2) {
          // Skip malformed JSON-LD blocks
          continue;
        }
      }

      scripts.push({
        raw: jsonText,
        parsed: parsed,
      });
    }

    return res.status(200).json({
      ok: true,
      count: scripts.length,
      scripts: scripts.map(s => s.parsed),
      url: targetUrl.toString(),
    });

  } catch (error) {
    // Handle timeout, network errors, etc.
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return res.status(504).json({
        ok: false,
        error: 'Request timeout',
      });
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return res.status(502).json({
        ok: false,
        error: 'Network error: ' + error.message,
      });
    }

    return res.status(500).json({
      ok: false,
      error: error.message || 'Unknown error',
    });
  }
}

