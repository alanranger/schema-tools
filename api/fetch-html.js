// /api/fetch-html.js
export default async function handler(req, res) {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).send('Missing url');

    const r = await fetch(url, {
      method: 'GET',
      headers: {
        // Be polite and realistic
        'user-agent': 'Mozilla/5.0 (compatible; SchemaTools/1.0; +https://schema-tools-six.vercel.app)',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-GB,en;q=0.9'
      },
      redirect: 'follow',
      cache: 'no-store'
    });

    if (!r.ok) return res.status(r.status).send(`Upstream ${r.status} ${r.statusText}`);
    const html = await r.text();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send(`Fetch error: ${err.message}`);
  }
}








