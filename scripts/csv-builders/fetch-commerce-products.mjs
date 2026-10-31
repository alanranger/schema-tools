// READ-ONLY: page through the Squarespace Commerce Products API (v2) and store pages (v1); GET only.
// The API key is read from a local .env file outside Drive and never written anywhere.
import fs from 'node:fs';
import path from 'node:path';
import { FEEDS, sleep } from './lib.mjs';

const ENV = 'G:/Dropbox/alan ranger photography/Website Code/AI GEO Audit/.env.local';
const KEY = fs.readFileSync(ENV, 'utf8').match(/^SQUARESPACE_API_KEY_CURSOR=(.+)$/m)?.[1]?.trim();
if (!KEY) throw new Error('SQUARESPACE_API_KEY_CURSOR missing');
const API = 'https://api.squarespace.com';

async function get(pathAndQuery) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(`${API}${pathAndQuery}`, { method: 'GET', headers: { Authorization: `Bearer ${KEY}`, 'User-Agent': 'AlanRanger-Cursor-pilot/1.0' } });
    if (res.status === 429) { await sleep(5000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`GET ${pathAndQuery} -> ${res.status} ${await res.text()}`);
    return res.json();
  }
  throw new Error(`GET ${pathAndQuery} rate limited`);
}

async function all(base, listKey) {
  const items = [];
  let cursor = '';
  do {
    const page = await get(cursor ? `${base.split('?')[0]}?cursor=${encodeURIComponent(cursor)}` : base);
    items.push(...(page[listKey] || []));
    cursor = page.pagination?.hasNextPage ? page.pagination.nextPageCursor : '';
    await sleep(600);
  } while (cursor);
  return items;
}

const products = await all('/v2/commerce/products?type=PHYSICAL,SERVICE,GIFT_CARD,DIGITAL', 'products');
const storePages = await all('/1.0/commerce/store_pages', 'storePages');
fs.writeFileSync(path.join(FEEDS, 'commerce-api-products-v2.json'), JSON.stringify(products, null, 2));
fs.writeFileSync(path.join(FEEDS, 'commerce-api-store-pages.json'), JSON.stringify(storePages, null, 2));
const variants = products.reduce((n, p) => n + (p.variants || []).length, 0);
console.log(`products=${products.length} variants=${variants} hidden=${products.filter((p) => !p.isVisible).length} storePages=${storePages.length}`);
console.log('product keys:', Object.keys(products[0]).join(', '));
console.log('variant keys:', Object.keys(products[0].variants?.[0] || {}).join(', '));
