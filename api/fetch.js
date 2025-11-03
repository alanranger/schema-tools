export default async function handler(req, res) {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).send('Missing url parameter');
  }
  
  try {
    const r = await fetch(url, { 
      headers: { 
        'User-Agent': 'SchemaValidator/1.0' 
      } 
    });
    
    if (!r.ok) {
      return res.status(r.status).send(`Failed to fetch: ${r.statusText}`);
    }
    
    const text = await r.text();
    res.status(200).send(text);
  } catch (err) {
    res.status(500).send(`Failed to fetch: ${err.message}`);
  }
}

