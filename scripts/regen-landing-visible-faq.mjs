#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'module';
import {
  LANDING_HOSTED_PATHS,
  LANDING_FAQ_KEEP,
  landingFileName
} from './lib/landing-hosted-paths.mjs';

const require = createRequire('G:/Dropbox/alan ranger photography/Website Code/Chat AI Bot/package.json');
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.join(root, 'alanranger-schema');
const landingLoader = path.join(repo, 'loaders', 'landing-page-loader.js');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const UPDATE = [
  '/photography-gift-vouchers',
  '/photography-workshops',
  '/jaguar-land-rover-els',
  '/course-finder-photography-classes-near-me'
];
const SWAPPED = [
  '/terms-and-conditions', '/about-alan-ranger', '/photography-courses-coventry',
  '/awards-and-qualifications', '/batsford-arboretum-photography', '/bluebell-woods-near-me',
  '/contact-us-alan-ranger-photography', '/copyright-policy-alan-ranger',
  '/corporate-photography-training', '/data-privacy-policy', '/fine-art-prints',
  '/free-online-photography-course', '/free-photography-tips'
];

function pageUrl(p) {
  return p === '/home' ? 'https://www.alanranger.com/home' : `https://www.alanranger.com${p}`;
}

function hostedFaqCount(p) {
  const file = path.join(repo, landingFileName(p));
  const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
  const nodes = Array.isArray(schema['@graph']) ? schema['@graph'] : [schema];
  let n = 0;
  nodes.forEach((node) => {
    const t = node && node['@type'];
    const isFaq = t === 'FAQPage' || (Array.isArray(t) && t.indexOf('FAQPage') !== -1);
    if (!isFaq) return;
    const me = Array.isArray(node.mainEntity) ? node.mainEntity : (node.mainEntity ? [node.mainEntity] : []);
    n += me.length;
  });
  return n;
}

function upsertFaq(schema, faqNode) {
  const graph = Array.isArray(schema['@graph']) ? schema['@graph'].slice() : [schema];
  const kept = graph.filter((node) => {
    const t = node && node['@type'];
    return !(t === 'FAQPage' || (Array.isArray(t) && t.indexOf('FAQPage') !== -1));
  });
  if (faqNode) kept.splice(Math.min(1, kept.length), 0, faqNode);
  return { '@context': 'https://schema.org', '@graph': kept };
}

async function scrapeFaq(page, pageUrlStr) {
  return page.evaluate((url) => {
    function clean(v) {
      return String(v || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
    }
    function isWidget(raw) { return /[▾▼▶▸]/.test(String(raw || '')); }
    function asQuestion(raw) {
      const q = clean(raw).replace(/[▾▼▶▸▲▴+]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (q.length < 12 || q.charAt(q.length - 1) !== '?') return '';
      if (/^(description|itinerary|dates)\b/i.test(q)) return '';
      return q;
    }
    const found = new Set();
    document.querySelectorAll('.ar-faq details, .ar-faq-wrap details, details.ar-faq-item, [class*="-faq"] details').forEach((el) => found.add(el));
    document.querySelectorAll('details').forEach((det) => {
      const raw = String((det.querySelector('summary') && det.querySelector('summary').textContent) || '');
      if (isWidget(raw)) return;
      if (asQuestion(raw)) found.add(det);
    });
    document.querySelectorAll('li.accordion-item').forEach((el) => found.add(el));
    const questions = [];
    const seen = {};
    found.forEach((el) => {
      const summary = el.querySelector('summary, .accordion-item__title, .ar-faq-q');
      if (!summary) return;
      const clone = summary.cloneNode(true);
      clone.querySelectorAll('[class*="icon"]').forEach((n) => n.remove());
      const raw = clone.textContent || '';
      if (isWidget(raw)) return;
      const question = asQuestion(raw);
      const ps = Array.from(el.querySelectorAll('p')).map((p) => clean(p.textContent)).filter(Boolean);
      let answer = ps.join(' ');
      if (!answer) {
        const box = el.querySelector('.ar-faq-a, .accordion-item__description');
        if (box) answer = clean(box.textContent);
      }
      if (!answer) {
        const body = el.cloneNode(true);
        const drop = body.querySelector('summary, .accordion-item__title');
        if (drop) drop.remove();
        answer = clean(body.textContent);
      }
      if (!question || !answer || answer.length < 24) return;
      const key = question.toLowerCase();
      if (seen[key]) return;
      seen[key] = 1;
      questions.push({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer }
      });
    });
    if (!questions.length) return null;
    const base = String(url || '').replace(/\/+$/, '') || 'https://www.alanranger.com';
    return { '@context': 'https://schema.org', '@type': 'FAQPage', '@id': base + '#faq', mainEntity: questions };
  }, pageUrlStr);
}

async function simulateSwap(page, p) {
  const schema = JSON.parse(fs.readFileSync(path.join(repo, landingFileName(p)), 'utf8'));
  await page.evaluate(() => {
    document.querySelectorAll('script').forEach((el) => {
      const t = el.textContent || '';
      if (el.id === 'arp-critical-schema' || /__AR_CORE_SUPPRESSOR/.test(t)) el.remove();
    });
    window.scrollTo(0, document.body ? document.body.scrollHeight : 0);
  });
  await new Promise((r) => setTimeout(r, 800));
  await page.evaluate((raw) => { window.__AR_LANDING_SCHEMA_INLINE = JSON.parse(raw); }, JSON.stringify(schema));
  await page.addScriptTag({ path: landingLoader });
  await page.waitForSelector('#arp-landing-schema', { state: 'attached', timeout: 15000 });
  await new Promise((r) => setTimeout(r, 4000));
  return page.evaluate(() => {
    const el = document.getElementById('arp-landing-schema');
    let json = null;
    try { json = JSON.parse((el && el.textContent) || ''); } catch (e) { return { faqPages: 0, q: 0, vis: 0 }; }
    const nodes = Array.isArray(json['@graph']) ? json['@graph'] : [json];
    const faq = nodes.find((n) => {
      const t = n && n['@type'];
      return t === 'FAQPage' || (Array.isArray(t) && t.indexOf('FAQPage') !== -1);
    });
    const me = faq && Array.isArray(faq.mainEntity) ? faq.mainEntity : [];
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('script,style,noscript').forEach((n) => n.remove());
    const text = String(clone.textContent || '').replace(/['’]/g, "'").toLowerCase();
    const vis = me.filter((q) => {
      const name = String((q && q.name) || '').replace(/['’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
      return name.length > 8 && text.indexOf(name) !== -1;
    });
    const allFaq = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        const j = JSON.parse(s.textContent || '');
        const list = Array.isArray(j['@graph']) ? j['@graph'] : [j];
        list.forEach((n) => {
          const t = n && n['@type'];
          if (t === 'FAQPage' || (Array.isArray(t) && t.indexOf('FAQPage') !== -1)) allFaq.push(n);
        });
      } catch (e) {}
    });
    return { faqPages: allFaq.length, q: me.length, vis: vis.length, names: me.map((q) => q.name) };
  });
}

async function main() {
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

  console.log('update 4 hosted FAQ graphs');
  for (const p of UPDATE) {
    const page = await ctx.newPage();
    await page.goto(pageUrl(p), { waitUntil: 'load', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2500));
    const faq = await scrapeFaq(page, pageUrl(p));
    const count = faq && faq.mainEntity ? faq.mainEntity.length : 0;
    const expect = LANDING_FAQ_KEEP[p];
    console.log(`  scrape ${p} q=${count} expect=${expect}`);
    if (count !== expect) throw new Error('scrape count mismatch ' + p);
    const file = path.join(repo, landingFileName(p));
    const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
    const next = upsertFaq(schema, faq);
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n', 'utf8');
    await page.close();
  }

  console.log('scan 48 hosted vs visible');
  const scan = [];
  const swappedHits = [];
  for (const p of LANDING_HOSTED_PATHS) {
    const page = await ctx.newPage();
    await page.goto(pageUrl(p), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2500));
    const faq = await scrapeFaq(page, pageUrl(p));
    const visible = faq && faq.mainEntity ? faq.mainEntity.length : 0;
    const hosted = hostedFaqCount(p);
    const ok = visible === hosted;
    scan.push({ path: p, visible, hosted, ok, swapped: SWAPPED.includes(p) });
    console.log(`${ok ? 'ok' : 'DIFF'} ${p} visible=${visible} hosted=${hosted}${SWAPPED.includes(p) ? ' [swapped]' : ''}`);
    if (!ok && SWAPPED.includes(p)) swappedHits.push({ path: p, visible, hosted });
    await page.close();
  }

  console.log('smoke 4 pages');
  const smokes = [];
  for (const p of UPDATE) {
    const page = await ctx.newPage();
    await page.goto(pageUrl(p), { waitUntil: 'load', timeout: 90000 });
    const after = await simulateSwap(page, p);
    const expect = LANDING_FAQ_KEEP[p];
    const ok = after.faqPages === 1 && after.q === expect && after.vis === expect;
    smokes.push({ path: p, ok, ...after, expect });
    console.log(`${ok ? 'ok' : 'FAIL'} smoke ${p} FAQPage=${after.faqPages} q=${after.q} vis=${after.vis} expect=${expect}`);
    await page.close();
  }

  const out = { scan, swappedHits, smokes };
  const outPath = path.join(root, 'outputs', 'landing-visible-faq-2026-10-29.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  await browser.close();
  const diffs = scan.filter((r) => !r.ok);
  const smokeFail = smokes.filter((r) => !r.ok);
  console.log(`done diffs=${diffs.length} swappedHits=${swappedHits.length} smokeFail=${smokeFail.length} ${outPath}`);
  if (smokeFail.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
