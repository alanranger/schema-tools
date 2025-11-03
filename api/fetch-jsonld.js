// /api/fetch-jsonld.js
// Vercel serverless function: Fetch and parse JSON-LD from URLs
// GET /api/fetch-jsonld?url=<encoded-url>

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ ok: false, error: "Missing URL parameter" });
  }

  try {
    // Use Node fetch with custom headers to bypass Squarespace bot filter
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SchemaValidator/1.0; +https://schema.org)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch ${url}: ${response.status}`);
      return res.status(200).json({ 
        ok: false, 
        error: `Failed to fetch ${url}`,
        count: 0,
        scripts: []
      });
    }

    const html = await response.text();

    // Extract all <script type="application/ld+json">
    const jsonBlocks = [];
    const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      try {
        const json = JSON.parse(match[1]);
        jsonBlocks.push(json);
      } catch {
        // skip malformed blocks safely
      }
    }

    if (jsonBlocks.length === 0) {
      console.warn(`⚠️ No JSON-LD blocks found at ${url}`);
      return res.status(200).json({ 
        ok: true, 
        url,
        count: 0, 
        scripts: [],
        message: "No JSON-LD found" 
      });
    }

    console.log(`✅ Found ${jsonBlocks.length} JSON-LD blocks at ${url}`);
    
    res.status(200).json({
      ok: true,
      url,
      count: jsonBlocks.length,
      scripts: jsonBlocks
    });
    
  } catch (err) {
    console.error("Error in fetch-jsonld:", err);
    res.status(500).json({ 
      ok: false,
      error: err.message,
      count: 0,
      scripts: []
    });
  }
}

