/**
 * raw-01 from the Squarespace Commerce Products API (saved GET responses, fetch-commerce-products.mjs):
 * includes hidden products and the stored description HTML. Categories are not in the API, so they come
 * from the public store feed (visible products only). Writes <CSV_BUILDERS_OUT>/raw-01-products-sqsp-export.csv.
 */
import fs from 'node:fs';
import path from 'node:path';
import { FEEDS, LIVE_CSV, OUT, readCsvObjects, readFeed } from './lib.mjs';

// Hidden products' categories (not in the API or the public feed) are carried forward from the previous raw-01
// export by default (Alan to confirm, parking lot P2). CARRY_HIDDEN_CATEGORIES=0 gives the strict API-only file.
const CARRY = process.env.CARRY_HIDDEN_CATEGORIES !== '0';
const PREVIOUS = readCsvObjects(`${LIVE_CSV}/raw-01-products-sqsp-export.csv`);
const HEADER = PREVIOUS.header;
const previousCategories = new Map(PREVIOUS.rows.filter((r) => r['Product ID [Non Editable]']).map((r) => [r['Product ID [Non Editable]'], r.Categories]));
const load = (f) => JSON.parse(fs.readFileSync(path.join(FEEDS, f), 'utf8'));
const products = load('commerce-api-products-v2.json');
const pageSlug = new Map(load('commerce-api-store-pages.json').map((p) => [p.id, p.urlSlug]));
const feedItems = new Map(['photography-services-near-me', 'photo-workshops-uk'].flatMap((page) => readFeed(page).items.map((i) => [i.id, i])));
const REDIRECTS_FILE = path.join(FEEDS, 'static1-image-redirects.json');
const redirects = fs.existsSync(REDIRECTS_FILE) ? load('static1-image-redirects.json') : {};

const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** static1.squarespace.com/static/... 301s to images.squarespace-cdn.com/content/<site>/...; the export uses /content/v1/. */
async function resolveImage(url) {
  if (!url.includes('static1.squarespace.com/static/')) return url;
  if (!redirects[url]) {
    const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    redirects[url] = res.headers.get('location') || url;
    await new Promise((r) => setTimeout(r, 300));
  }
  return redirects[url].split('?')[0].replace('images.squarespace-cdn.com/content/', 'images.squarespace-cdn.com/content/v1/');
}

/** Visible products: the public feed's image list (the API omits some images). Hidden: API images, resolved. */
async function imageUrls(p) {
  const feed = feedItems.get(p.id);
  if (feed) return (feed.items || []).map((i) => i.assetUrl).filter(Boolean);
  const sorted = [...(p.images || [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const out = [];
  for (const img of sorted) out.push(await resolveImage(img.url));
  return out;
}

function categoriesFor(p) {
  const feed = feedItems.get(p.id);
  if (feed) return (feed.categories || []).join(', ');
  return CARRY ? previousCategories.get(p.id) ?? '' : '';
}

function variantCells(v, ordering) {
  const out = {};
  ordering.forEach((name, i) => { out[`Option Name ${i + 1}`] = name; out[`Option Value ${i + 1}`] = v.attributes?.[name] ?? ''; });
  const stock = v.stock || {};
  return {
    ...out, 'Variant ID [Non Editable]': v.id, SKU: v.sku || '',
    Price: v.pricing?.basePrice?.value || '', 'Sale Price': v.pricing?.salePrice?.value || '',
    'On Sale': v.pricing?.onSale ? 'Yes' : 'No', Stock: stock.unlimited ? 'Unlimited' : String(stock.quantity ?? '')
  };
}

async function productRows(p) {
  const ordering = p.variantAttributes || [];
  const head = {
    'Product ID [Non Editable]': p.id, 'Product Type [Non Editable]': p.type, 'Product Page': pageSlug.get(p.storePageId) || '',
    'Product URL': p.urlSlug, Title: p.name, Description: p.description || '', Categories: categoriesFor(p),
    Tags: (p.tags || []).join(', '), Visible: p.isVisible ? 'Yes' : 'No', 'Hosted Image URLs': (await imageUrls(p)).join(' ')
  };
  return (p.variants || []).map((v, i) => (i === 0 ? { ...head, ...variantCells(v, ordering) } : variantCells(v, ordering)));
}

const service = products.filter((p) => p.type === 'SERVICE')
  .sort((a, b) => (a.urlSlug < b.urlSlug ? -1 : a.urlSlug > b.urlSlug ? 1 : 0));
const rows = [];
for (const p of service) rows.push(...(await productRows(p)));
fs.writeFileSync(REDIRECTS_FILE, JSON.stringify(redirects, null, 2));
fs.mkdirSync(OUT, { recursive: true });
const lines = [HEADER.map(cell).join(','), ...rows.map((r) => HEADER.map((h) => cell(r[h])).join(','))];
fs.writeFileSync(path.join(OUT, 'raw-01-products-sqsp-export.csv'), `${lines.join('\n')}\n`, 'utf8');
console.log(`products=${service.length} rows=${rows.length} hidden=${service.filter((p) => !p.isVisible).length} not-in-public-feed=${service.filter((p) => !feedItems.has(p.id)).length} carry=${CARRY}`);
