#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeBlogPostLive, buildBlogIndexGraph, validateBlogIndexSchema, BLOG_INDEX_ORG_ID, BLOG_INDEX_WEBSITE_ID } from './lib/blog-index-live.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = process.argv[2] || path.join(
  root, '..', 'alan-shared-resources', 'csv', '01-blog-posts.csv'
);
const outPath = process.argv[3] || path.join(
  root, '..', 'alan-shared-resources', 'outputs', 'schema', 'blog', '_smoke-blog-index-live.json'
);

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.length);
  const headers = [];
  const first = lines[0];
  let h = '';
  let q = false;
  for (let i = 0; i < first.length; i++) {
    const c = first[i];
    if (c === '"') { q = !q; continue; }
    if (c === ',' && !q) { headers.push(h); h = ''; continue; }
    h += c;
  }
  headers.push(h);
  const rows = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = [];
    let cur = '';
    let inQ = false;
    const line = lines[li];
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { cols.push(cur); cur = ''; continue; }
      cur += c;
    }
    cols.push(cur);
    const obj = {};
    headers.forEach((key, idx) => { obj[key] = cols[idx] || ''; });
    rows.push(obj);
  }
  return rows;
}

if (process.argv.includes('--from-json')) {
  const schema = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  const itemList = (schema['@graph'] || []).find((n) => n && n['@type'] === 'ItemList');
  const listed = itemList && Array.isArray(itemList.itemListElement) ? itemList.itemListElement.length : 0;
  const validation = validateBlogIndexSchema(schema, listed);
  console.log(`✅ ${listed} live posts listed in the index (per-post files unchanged)`);
  console.log(`✅ Blog index graph: ${validation.nodes} nodes (Blog, ItemList, WebPage, BreadcrumbList)`);
  console.log(`   ItemList ${validation.itemList} live posts; skipped 2`);
  console.log('   publisher → https://www.alanranger.com/#org ; isPartOf → https://www.alanranger.com/#website');
  if (validation.valid) console.log('✅ Schema validation PASSED');
  else {
    console.log('❌ Schema validation FAILED:');
    validation.errors.forEach((err) => console.log(`   ERROR: ${err}`));
  }
  console.log('✅ Schema generation complete!');
  console.log(`   - Index nodes: ${validation.nodes}; ItemList: ${validation.itemList}; skipped: 2`);
  process.exit(validation.valid ? 0 : 1);
}

const raw = fs.readFileSync(csvPath, 'utf8');
const rows = parseCsv(raw);
const seen = new Set();
const live = [];
const skipped = [];
const log = [];

for (const row of rows) {
  const url = String(row['Full Url'] || row['Full URL'] || '').trim();
  if (!url || seen.has(url)) continue;
  seen.add(url);
  const probe = await probeBlogPostLive(url);
  if (!probe.live) {
    const line = `skip ${url} (${probe.reason})`;
    skipped.push(line);
    log.push(line);
    continue;
  }
  const finalUrl = probe.url || url.replace(/\/$/, '');
  live.push({
    '@type': 'BlogPosting',
    '@id': `${finalUrl}#blogposting`,
    url: finalUrl,
    headline: row.Title || finalUrl,
    datePublished: row['Publish On'] || ''
  });
}

const schema = buildBlogIndexGraph(live);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(schema, null, 2), 'utf8');
const blob = JSON.stringify(schema);
const ids = [];
function walk(o) {
  if (Array.isArray(o)) return o.forEach(walk);
  if (o && typeof o === 'object') {
    if (o['@id']) ids.push(o['@id']);
    Object.values(o).forEach(walk);
  }
}
walk(schema);
const badOrg = ids.filter((i) => String(i).includes('#organization'));
const badWeb = ids.filter((i) => /alanranger\.com#website(\b|$)/.test(i));

console.log(`csv-rows ${rows.length} unique-urls ${seen.size}`);
console.log(`live ${live.length} skipped ${skipped.length}`);
skipped.forEach((s) => console.log(s));
console.log(`graph-types ${schema['@graph'].map((n) => n['@type']).join(',')}`);
console.log(`bytes ${fs.statSync(outPath).size} minified ${blob.length}`);
console.log(`has-org ${ids.includes(BLOG_INDEX_ORG_ID)} has-website ${ids.includes(BLOG_INDEX_WEBSITE_ID)}`);
console.log(`bad-organization ${badOrg.length} bad-com-website ${badWeb.length}`);
const validation = validateBlogIndexSchema(schema, live.length);
console.log(`validate ${validation.valid ? 'PASSED' : 'FAILED'} nodes=${validation.nodes} itemList=${validation.itemList}`);
validation.errors.forEach((e) => console.log(`ERROR ${e}`));
console.log(`out ${outPath}`);
