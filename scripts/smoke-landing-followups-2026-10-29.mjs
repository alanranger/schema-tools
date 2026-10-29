#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'module';
import {
  LANDING_HOSTED_PATHS,
  LANDING_FAQ_KEEP,
  LANDING_FAQ_EXPECT_ZERO,
  landingFileName
} from './lib/landing-hosted-paths.mjs';

const require = createRequire('G:/Dropbox/alan ranger photography/Website Code/Chat AI Bot/package.json');
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.join(root, 'alanranger-schema');
const landingLoader = path.join(repo, 'loaders', 'landing-page-loader.js');
const productLoader = path.join(repo, 'loaders', 'product-page-loader.js');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const PRODUCTS = [
  '/photography-services-near-me/beginners-photography-course',
  '/photography-services-near-me/camera-sensor-clean'
];

function pageUrl(p) {
  return p === '/home' ? 'https://www.alanranger.com/home' : `https://www.alanranger.com${p}`;
}

function expectedFaq(p) {
  if (typeof LANDING_FAQ_KEEP[p] === 'number') return LANDING_FAQ_KEEP[p];
  return 0;
}

async function scrapeVisibleFaqCount(page) {
  return page.evaluate(() => {
    const found = new Set();
    document.querySelectorAll('.ar-faq details, .ar-faq-wrap details, details.ar-faq-item').forEach((el) => found.add(el));
    if (!found.size) {
      document.querySelectorAll('details').forEach((det) => {
        const summary = String((det.querySelector('summary') && det.querySelector('summary').textContent) || '');
        if (/\?/.test(summary)) found.add(det);
      });
    }
    let n = 0;
    found.forEach((det) => {
      const summary = det.querySelector('summary');
      if (!summary) return;
      const clone = summary.cloneNode(true);
      clone.querySelectorAll('[class*="icon"]').forEach((el) => el.remove());
      const q = String(clone.textContent || '').replace(/\s+/g, ' ').trim();
      const paragraphs = Array.from(det.querySelectorAll('p')).map((p) => String(p.textContent || '').trim()).filter(Boolean);
      const ans = paragraphs.join(' ') || String(det.textContent || '').replace(q, '').trim();
      if (q && ans) n += 1;
    });
    return n;
  });
}

async function schemaSnap(page) {
  return page.evaluate(() => {
    const nodes = [];
    document.querySelectorAll('script[type="application/ld+json"], script[data-type="application/ld+json"]').forEach((el) => {
      const txt = (el.textContent || '').trim();
      if (!txt) return;
      let json;
      try { json = JSON.parse(txt); } catch (e) { return; }
      const list = Array.isArray(json['@graph']) ? json['@graph'] : [json];
      list.forEach((n) => {
        if (!n || typeof n !== 'object') return;
        const type = Array.isArray(n['@type']) ? n['@type'] : [n['@type']].filter(Boolean);
        nodes.push({
          id: String(n['@id'] || ''),
          type: type.join('+'),
          where: el.id ? '#' + el.id : (el.closest('head') ? 'head' : 'body'),
          q: Array.isArray(n.mainEntity) ? n.mainEntity.length : 0
        });
      });
    });
    return {
      nodes,
      faqPages: nodes.filter((n) => n.type.indexOf('FAQPage') !== -1).length,
      faqQ: nodes.filter((n) => n.type.indexOf('FAQPage') !== -1).reduce((s, n) => s + n.q, 0),
      products: nodes.filter((n) => n.type.indexOf('Product') !== -1).length,
      hasPlace: nodes.some((n) => n.id.indexOf('#place') !== -1),
      hostedPlace: nodes.some((n) => n.where === '#arp-landing-schema' && n.id.indexOf('#place') !== -1),
      hosted: nodes.some((n) => n.where === '#arp-landing-schema'),
      h1Cards: document.querySelectorAll('h1.ProductList-title').length,
      h2Demoted: document.querySelectorAll('h2.ProductList-title[data-ar-demoted]').length
    };
  });
}

async function swapLanding(page, p, keepProductLoader) {
  const schema = JSON.parse(fs.readFileSync(path.join(repo, landingFileName(p)), 'utf8'));
  await page.evaluate((keep) => {
    document.querySelectorAll('script').forEach((el) => {
      const src = el.src || '';
      const t = el.textContent || '';
      if (el.id === 'arp-critical-schema') el.remove();
      if (keep && /product-page-loader\.js/.test(src)) return;
      if (!src && /CORE_TYPES/.test(t) && /FAQPage/.test(t) && t.indexOf('__AR_CORE_SUPPRESSOR_V21__') === -1) el.remove();
    });
    window.scrollTo(0, document.body ? document.body.scrollHeight : 0);
  }, keepProductLoader);
  await new Promise((r) => setTimeout(r, 800));
  await page.evaluate((raw) => { window.__AR_LANDING_SCHEMA_INLINE = JSON.parse(raw); }, JSON.stringify(schema));
  await page.addScriptTag({ path: landingLoader });
  await page.waitForSelector('#arp-landing-schema', { state: 'attached', timeout: 15000 });
  await new Promise((r) => setTimeout(r, 4000));
}

async function withBrowser() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ userAgent: UA });
  await ctx.addInitScript(() => {
    const OrigSet = window.Set;
    window.Set = function (init) {
      if (Array.isArray(init) && init.indexOf('FAQPage') !== -1 && init.indexOf('WebPage') !== -1) {
        return new OrigSet();
      }
      return init === undefined ? new OrigSet() : new OrigSet(init);
    };
    window.Set.prototype = OrigSet.prototype;
    Object.setPrototypeOf(window.Set, OrigSet);
  });
  return { browser, ctx };
}

async function main() {
  const { browser, ctx } = await withBrowser();
  const scrapeRows = [];
  console.log('scrape FAQ counts', LANDING_HOSTED_PATHS.length);
  for (const p of LANDING_HOSTED_PATHS) {
    const page = await ctx.newPage();
    await page.goto(pageUrl(p), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2500));
    const scraped = await scrapeVisibleFaqCount(page);
    const expect = expectedFaq(p);
    const ok = scraped === expect;
    scrapeRows.push({ path: p, scraped, expect, ok });
    console.log(`${ok ? 'ok' : 'DIFF'} ${p} scraped=${scraped} expect=${expect}`);
    await page.close();
  }

  await ctx.route('https://schema.alanranger.com/loaders/product-page-loader.js', (route) => {
    route.fulfill({ path: productLoader, contentType: 'application/javascript; charset=utf-8' });
  });

  const page = await ctx.newPage();
  console.log('smoke /photography-services-near-me');
  await page.goto(pageUrl('/photography-services-near-me'), { waitUntil: 'load', timeout: 90000 });
  await swapLanding(page, '/photography-services-near-me', true);
  const shop = await schemaSnap(page);
  const shopOk = shop.hosted && shop.hostedPlace && shop.hasPlace;
  console.log(`${shopOk ? 'ok' : 'FAIL'} services-shop hosted=${shop.hosted} hostedPlace=${shop.hostedPlace} h1=${shop.h1Cards} h2demoted=${shop.h2Demoted}`);
  await page.close();

  const land = await ctx.newPage();
  console.log('smoke /landscape-photography-workshops');
  await land.goto(pageUrl('/landscape-photography-workshops'), { waitUntil: 'load', timeout: 90000 });
  await swapLanding(land, '/landscape-photography-workshops', false);
  const landSnap = await schemaSnap(land);
  const landOk = landSnap.hosted && landSnap.faqPages === 1 && landSnap.faqQ === 11;
  console.log(`${landOk ? 'ok' : 'FAIL'} landscape FAQPage=${landSnap.faqPages} q=${landSnap.faqQ}`);
  await land.close();

  const productRows = [];
  for (const p of PRODUCTS) {
    const pg = await ctx.newPage();
    await pg.goto(pageUrl(p), { waitUntil: 'load', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 3500));
    const snap = await schemaSnap(pg);
    const ok = snap.products === 1 && snap.h1Cards === 0;
    productRows.push({ path: p, ok, products: snap.products, faqPages: snap.faqPages, faqQ: snap.faqQ, h1Cards: snap.h1Cards, h2Demoted: snap.h2Demoted });
    console.log(`${ok ? 'ok' : 'FAIL'} product ${p} Product=${snap.products} FAQPage=${snap.faqPages} q=${snap.faqQ} h1=${snap.h1Cards} h2demoted=${snap.h2Demoted}`);
    await pg.close();
  }

  const out = {
    scrapeRows,
    shop: { ok: shopOk, ...shop },
    landscape: { ok: landOk, ...landSnap },
    productRows
  };
  const outPath = path.join(root, 'outputs', 'landing-followups-2026-10-29.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  await browser.close();
  const scrapeFail = scrapeRows.filter((r) => !r.ok).length;
  const prodFail = productRows.filter((r) => !r.ok).length;
  console.log(`done scrapeDiff=${scrapeFail} shop=${shopOk} landscape=${landOk} productFail=${prodFail} report ${outPath}`);
  if (scrapeFail || !shopOk || !landOk || prodFail) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
