import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('G:/Dropbox/alan ranger photography/Website Code/Chat AI Bot/package.json');
const { chromium } = require('playwright');

const root = path.dirname(fileURLToPath(import.meta.url));
const blogLoader = path.join(root, '../alanranger-schema/loaders/blog-page-loader.js');
const eventLoader = path.join(root, '../alanranger-schema/loaders/event-page-loader.js');
const TOOL = 'https://ai-geo-audit.vercel.app/api/aigeo/tool-run-report';

const pages = [
  { type: 'blog', url: 'https://www.alanranger.com/blog-on-photography/the-history-of-photography', loader: blogLoader },
  { type: 'event', url: 'https://www.alanranger.com/photographic-workshops-near-me/batsford-arboretum-autumn-photography-3nov', loader: eventLoader },
  { type: 'product', url: 'https://www.alanranger.com/photography-services-near-me/four-private-photography-classes', loader: null, pathGate: true },
  { type: 'landing', url: 'https://www.alanranger.com/photography-courses-coventry', loader: null }
];

function summarise(nodes) {
  const types = {};
  nodes.forEach((n) => { types[n.type] = (types[n.type] || 0) + 1; });
  const articles = nodes.filter((n) => n.type === 'Article' || n.type === 'BlogPosting' || n.type.indexOf('Article') !== -1);
  const events = nodes.filter((n) => n.type === 'Event' || n.type.indexOf('Event') !== -1);
  const products = nodes.filter((n) => n.type === 'Product' || n.type.indexOf('Product') !== -1);
  const orgs = nodes.filter((n) => n.type.indexOf('Organization') !== -1);
  return { types, articleCount: articles.length, eventCount: events.length, productCount: products.length, orgCount: orgs.length, articles, events, products, orgs };
}

async function snapshot(page) {
  return page.evaluate(() => {
    const nodes = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
      const t = (el.textContent || '').trim();
      if (!t) return;
      try {
        const j = JSON.parse(t);
        const list = Array.isArray(j) ? j : (j['@graph'] || [j]);
        list.forEach((n) => {
          if (!n || typeof n !== 'object') return;
          const type = Array.isArray(n['@type']) ? n['@type'].join('+') : String(n['@type'] || '?');
          const offers = n.offers ? (Array.isArray(n.offers) ? n.offers : [n.offers]) : [];
          nodes.push({
            id: String(n['@id'] || ''),
            type,
            where: el.id ? '#' + el.id : (el.closest('head') ? 'head' : 'body'),
            price: offers.map((o) => o && o.price).filter(Boolean)[0] || null,
            author: !!(n.author),
            image: !!n.image,
            q: Array.isArray(n.mainEntity) ? n.mainEntity.length : 0
          });
        });
      } catch (e) {}
    });
    return nodes;
  });
}

async function applyD(page, spec) {
  await page.evaluate((kind) => {
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
      const t = el.textContent || '';
      const footerGraph = t.indexOf('#photography-services') !== -1 && t.indexOf('#website') !== -1;
      if (footerGraph) return;
      if (kind === 'product') {
        if (el.id === 'arp-critical-schema') el.remove();
        return;
      }
      if (kind === 'landing') return;
      el.remove();
    });
    ['arp-critical-schema-workshops', 'arp-critical-schema'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && kind !== 'landing') el.remove();
    });
    document.querySelectorAll('script[id^="arp-schema-"]').forEach((el) => el.remove());
  }, spec.type);
  if (spec.loader) await page.addScriptTag({ path: spec.loader });
  await page.waitForTimeout(4500);
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'
  });
  const out = [];
  const drops = [];
  for (const spec of pages) {
    const page = await ctx.newPage();
    await page.goto(spec.url, { waitUntil: 'load', timeout: 90000 });
    await page.waitForTimeout(4500);
    const before = summarise(await snapshot(page));
    await applyD(page, spec);
    const afterNodes = await snapshot(page);
    const after = summarise(afterNodes);
    const drop = await page.evaluate(() => window.__AR_FAQ_DROP || null);
    if (drop && drop.reason !== 'all-visible') drops.push(drop);
    out.push({ type: spec.type, url: spec.url, before, after, drop });
    await page.close();
  }
  await browser.close();

  if (drops.length) {
    try {
      const body = {
        tool: 'schema-tools',
        flow: 'blog-faq-visible-only',
        run_id: 'option-d-' + Date.now(),
        started_at: new Date().toISOString(),
        version: '2026-10-27-option-d',
        state: 'ok',
        items_processed: drops.length,
        failed: drops.map((d) => ({ url: d.url, reason: d.reason + ' ' + d.before + '→' + d.after })),
        errors: 0,
        summary: { drops }
      };
      const res = await fetch(TOOL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      body._report = await res.json();
      console.log('tool_run_reports', body._report);
    } catch (e) {
      console.log('tool_run_reports failed', e.message);
    }
  }

  for (const row of out) {
    console.log('\n== ' + row.type + ' ==');
    console.log(row.url);
    console.log('BEFORE types', JSON.stringify(row.before.types));
    console.log('AFTER  types', JSON.stringify(row.after.types));
    console.log('articles', row.before.articleCount, '->', row.after.articleCount, row.after.articles.map((a) => a.id || a.type));
    console.log('events', row.before.eventCount, '->', row.after.eventCount, row.after.events.map((a) => (a.id || a.type) + (a.price ? ' £' + a.price : '')));
    console.log('products', row.before.productCount, '->', row.after.productCount);
    console.log('orgs', row.before.orgCount, '->', row.after.orgCount, row.after.orgs.map((a) => a.id || a.type));
    if (row.drop) console.log('faq drop', row.drop);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
