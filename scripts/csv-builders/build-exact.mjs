/**
 * Exact-copy builder: reproduce each Squarespace export's byte format from the live feeds.
 * Writes only to CSV_BUILDERS_OUT (the Update-all sandbox in dry runs; never the live csv folder unless pointed there).
 */
import fs from 'node:fs';
import path from 'node:path';
import { FEEDS, LIVE_CSV, OUT, ORIGIN, readFeed, readCsvObjects, londonParts, pathKey } from './lib.mjs';
const abs = (u) => (String(u || '').startsWith('http') ? u : `${ORIGIN}${u}`);

/** Per-file byte format, measured from the live exports (format-inspect.mjs). */
const FORMATS = {
  collection: { bom: true, eol: '\n', trailing: true, quoteAll: false, quoteEdgeSpace: false },
  events: { bom: false, eol: '\r\n', trailing: false, quoteAll: false, quoteEdgeSpace: true },
  raw01: { bom: false, eol: '\n', trailing: true, quoteAll: true, quoteEdgeSpace: false },
  landing: { bom: false, eol: '\r\n', trailing: true, quoteAll: false, quoteEdgeSpace: false }
};

function cell(v, fmt) {
  const s = String(v ?? '');
  const edge = fmt.quoteEdgeSpace && /^\s|\s$/.test(s);
  if (fmt.quoteAll || edge || /[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeExact(file, header, rows, fmt) {
  const lines = [header.map((h) => cell(h, fmt)).join(','),
    ...rows.map((r) => header.map((h) => cell(r[h], fmt)).join(','))];
  const body = lines.join(fmt.eol) + (fmt.trailing ? fmt.eol : '');
  fs.writeFileSync(path.join(OUT, file), (fmt.bom ? '\uFEFF' : '') + body, 'utf8');
  return rows.length;
}

// ---------- 01 / 04 / 05 ----------
const COLLECTION_HEADER = ['Title', 'Url Id', 'Full Url', 'Categories', 'Tags', 'Image', 'Publish On'];
const collectionRow = (item) => ({
  Title: item.title, 'Url Id': item.urlId, 'Full Url': abs(item.fullUrl),
  Categories: (item.categories || []).join(';'), Tags: (item.tags || []).join(';'),
  Image: item.assetUrl || '', 'Publish On': londonParts(item.publishOn).date
});

// ---------- 02 / 03 ----------
const EVENT_HEADER = ['Event_Title', 'Start_Date', 'Start_Time', 'End_Date', 'End_Time', 'Category', 'Tags', 'Excerpt',
  'Location_Business_Name', 'Location_Address', 'Location_City_State_ZIP', 'Event_URL', 'Event_Image', 'Text_Block',
  'Published_Date', 'Workflow_State'];
const EVENT_ITEMS = JSON.parse(fs.readFileSync(path.join(FEEDS, 'event-items.json'), 'utf8'));

/** The export's Text_Block: inner HTML of the text block wrapper, whitespace and all. */
function textBlock(fullUrl) {
  const body = EVENT_ITEMS[fullUrl]?.body || '';
  const m = body.match(/<div class="sqs-block-content">(\s*<div class="sqs-html-content"[^>]*>[\s\S]*?<\/div>\s*)<\/div>/);
  return m ? m[1].replace('data-sqsp-text-block-content>', 'data-sqsp-text-block-content="">') : '';
}

function eventRow(ev) {
  const s = londonParts(ev.startDate);
  const e = londonParts(ev.endDate);
  const p = londonParts(ev.updatedOn);
  const loc = ev.location || {};
  const parts = [loc.addressLine1, loc.addressLine2, loc.addressCountry].map((x) => String(x || '').trim()).filter(Boolean);
  return {
    Event_Title: ev.title, Start_Date: s.date, Start_Time: s.seconds, End_Date: e.date, End_Time: e.seconds,
    Category: (ev.categories || []).join(','), Tags: (ev.tags || []).join(','),
    Excerpt: String(ev.excerpt || '').replace(/<[^>]+>/g, '').trim(),
    Location_Business_Name: loc.addressTitle || '', Location_Address: parts.join(', '),
    Location_City_State_ZIP: String(loc.addressLine2 || '').split(',').pop().trim(),
    Event_URL: abs(ev.fullUrl), Event_Image: ev.assetUrl || '', Text_Block: textBlock(ev.fullUrl),
    Published_Date: `${p.date} ${p.seconds}`, Workflow_State: ev.workflowState === 1 ? 'Published' : String(ev.workflowState)
  };
}

// ---------- raw-01 ----------
const RAW01_HEADER = readCsvObjects(`${LIVE_CSV}/raw-01-products-sqsp-export.csv`).header;
const TYPES = { 1: 'PHYSICAL', 2: 'DIGITAL', 3: 'SERVICE', 4: 'GIFT_CARD' };

function variantCells(v, ordering) {
  const out = {};
  ordering.forEach((name, i) => { out[`Option Name ${i + 1}`] = name; out[`Option Value ${i + 1}`] = v.attributes?.[name] ?? ''; });
  return {
    ...out, 'Variant ID [Non Editable]': v.id, SKU: v.sku || '', Price: v.priceMoney?.value || '',
    'Sale Price': v.salePriceMoney?.value || '', 'On Sale': v.onSale ? 'Yes' : 'No',
    Stock: v.unlimited ? 'Unlimited' : String(v.qtyInStock ?? '')
  };
}

function productRows(item, page) {
  const ordering = item.variantOptionOrdering || [];
  const head = {
    'Product ID [Non Editable]': item.id, 'Product Type [Non Editable]': TYPES[item.productType] || '',
    'Product Page': page, 'Product URL': item.urlId, Title: item.title, Description: item.excerpt || '',
    Categories: (item.categories || []).join(', '), Tags: (item.tags || []).join(', '), Visible: 'Yes',
    'Hosted Image URLs': (item.items || []).map((i) => i.assetUrl).filter(Boolean).join(' ')
  };
  return (item.variants || []).map((v, i) => (i === 0 ? { ...head, ...variantCells(v, ordering) } : variantCells(v, ordering)));
}

function raw01Rows() {
  const products = [];
  for (const page of ['photography-services-near-me', 'photo-workshops-uk']) {
    for (const item of readFeed(page).items) if (item.productType === 3) products.push({ item, page });
  }
  products.sort((a, b) => (a.item.urlId < b.item.urlId ? -1 : a.item.urlId > b.item.urlId ? 1 : 0));
  return products.flatMap(({ item, page }) => productRows(item, page));
}

// ---------- 08 ----------
const NON_LANDING = [/^\/blog-on-photography\/.+/, /^\/beginners-photography-lessons(\/.*)?$/, /^\/photographic-workshops-near-me\/.+/,
  /^\/photography-services-near-me\/.+/, /^\/photo-workshops-uk\/.+/];

/** Alan's existing 08 order and types are kept; pages new in 06 are appended with a suggested type. */
function landingRows() {
  const live = readCsvObjects(`${LIVE_CSV}/08-landing-and-service-pages.csv`).rows;
  const candidates = readCsvObjects(`${LIVE_CSV}/06-site-urls.csv`).rows
    .filter((r) => !NON_LANDING.some((re) => re.test(pathKey(r.url))));
  const keep = new Set(candidates.map((r) => pathKey(r.url)));
  const known = new Set(live.map((r) => pathKey(r.url)));
  const kept = live.filter((r) => keep.has(pathKey(r.url))).map((r) => ({ url: r.url, category: r.category }));
  const added = candidates.filter((r) => !known.has(pathKey(r.url))).map((r) => ({ url: r.url, category: 'NEW-suggested' }));
  return [...kept, ...added];
}

fs.mkdirSync(OUT, { recursive: true });
const events = (feed) => { const f = readFeed(feed); return [...f.upcoming, ...f.past].map(eventRow); };
const counts = {
  '01': writeExact('01-blog-posts.csv', COLLECTION_HEADER, readFeed('blog-on-photography').items.map(collectionRow), FORMATS.collection),
  '02': writeExact('02-beginners-photography-lessons.csv', EVENT_HEADER, events('beginners-photography-lessons'), FORMATS.events),
  '03': writeExact('03-photographic-workshops-near-me.csv', EVENT_HEADER, events('photographic-workshops-near-me'), FORMATS.events),
  '04': writeExact('04-photography-services-courses-mentoring.csv', COLLECTION_HEADER, readFeed('photography-services-near-me').items.map(collectionRow), FORMATS.collection),
  '05': writeExact('05-photo-workshops-uk-landscape.csv', COLLECTION_HEADER, readFeed('photo-workshops-uk').items.map(collectionRow), FORMATS.collection),
  'raw-01': writeExact('raw-01-products-sqsp-export.csv', RAW01_HEADER, raw01Rows(), FORMATS.raw01),
  '08': writeExact('08-landing-and-service-pages.csv', ['url', 'category'], landingRows(), FORMATS.landing)
};
console.log(JSON.stringify(counts));
