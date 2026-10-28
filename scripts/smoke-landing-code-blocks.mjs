#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'module';
import { LANDING_FAQ_KEEP, LANDING_FAQ_EXPECT_ZERO, landingFileName } from './lib/landing-hosted-paths.mjs';

const require = createRequire('G:/Dropbox/alan ranger photography/Website Code/Chat AI Bot/package.json');
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.join(root, 'alanranger-schema');
const loaderPath = path.join(repo, 'loaders', 'landing-page-loader.js');

const PAGES = [
  '/batsford-arboretum-photography',
  '/bluebell-woods-near-me',
  '/fine-art-prints',
  '/hire-a-professional-photographer-in-coventry',
  '/jaguar-land-rover-els',
  '/photography-gift-vouchers',
  '/corporate-photography-training',
  '/course-finder-photography-classes-near-me',
  '/photography-courses-coventry',
  '/photography-workshops-near-me',
  '/professional-photographer-near-me',
  '/professional-commercial-photographer-coventry',
  '/property-photographer-coventry',
  '/beginners-photography-classes',
  '/beginners-portrait-photography-course',
  '/photo-editing-course-coventry',
  '/photography-mentoring-online-assignments',
  '/photography-special-offers',
  '/private-photography-lessons',
  '/photography-lessons-online-121',
  '/rps-courses-mentoring-distinctions'
];

function pageUrl(p) {
  return p === '/home' ? 'https://www.alanranger.com/home' : `https://www.alanranger.com${p}`;
}

async function snapshot(page) {
  return page.evaluate(() => {
    const nodes = [];
    const questions = [];
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
        if (type.indexOf('FAQPage') !== -1) {
          const me = Array.isArray(n.mainEntity) ? n.mainEntity : (n.mainEntity ? [n.mainEntity] : []);
          me.forEach((q) => questions.push(String((q && q.name) || '')));
        }
      });
    });
    const clone = document.body ? document.body.cloneNode(true) : null;
    if (clone) clone.querySelectorAll('script,style,noscript').forEach((el) => el.remove());
    const text = String((clone && clone.textContent) || '').replace(/['’]/g, "'").toLowerCase();
    const visQ = questions.filter((name) => {
      const n = name.replace(/['’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
      return n.length > 8 && text.indexOf(n) !== -1;
    });
    const faqPages = nodes.filter((n) => n.type.indexOf('FAQPage') !== -1);
    const orgs = nodes.filter((n) => n.type.indexOf('Organization') !== -1);
    const bareCore = nodes.filter((n) => /WebPage|Service/.test(n.type) && !n.id);
    return {
      nodes,
      ids: nodes.map((n) => n.id).filter(Boolean),
      faqPages: faqPages.length,
      faqQ: questions,
      faqQVisible: visQ,
      org: orgs.length,
      bareCore: bareCore.map((n) => n.type),
      drop: window.__AR_FAQ_DROP || null
    };
  });
}

async function simulateSwap(page, p) {
  const jsonPath = path.join(repo, landingFileName(p));
  const schema = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  await page.evaluate(() => {
    document.querySelectorAll('script').forEach((el) => {
      const t = el.textContent || '';
      if (el.id === 'arp-critical-schema' || /__AR_CORE_SUPPRESSOR/.test(t)) el.remove();
    });
    window.scrollTo(0, document.body ? document.body.scrollHeight : 0);
  });
  await new Promise((r) => setTimeout(r, 800));
  const bodyFaqQs = await page.evaluate(() => {
    const qs = [];
    document.querySelectorAll('script[type="application/ld+json"], script[data-type="application/ld+json"]').forEach((el) => {
      if (el.id === 'arp-critical-schema' || el.id === 'arp-landing-schema') return;
      const txt = (el.textContent || '').trim();
      if (!txt || (txt.indexOf('#photography-services') !== -1 && txt.indexOf('#website') !== -1)) return;
      let json;
      try { json = JSON.parse(txt); } catch (e) { return; }
      const list = Array.isArray(json['@graph']) ? json['@graph'] : [json];
      list.forEach((n) => {
        const type = Array.isArray(n && n['@type']) ? n['@type'] : [n && n['@type']];
        if (type.indexOf('FAQPage') === -1) return;
        const me = Array.isArray(n.mainEntity) ? n.mainEntity : (n.mainEntity ? [n.mainEntity] : []);
        me.forEach((q) => qs.push(String((q && q.name) || '')));
      });
    });
    return qs;
  });
  await page.evaluate((raw) => { window.__AR_LANDING_SCHEMA_INLINE = JSON.parse(raw); }, JSON.stringify(schema));
  await page.addScriptTag({ path: loaderPath });
  await page.waitForSelector('#arp-landing-schema', { state: 'attached', timeout: 15000 });
  await new Promise((r) => setTimeout(r, 4000));
  return bodyFaqQs;
}

async function main() {
  const only = process.env.SMOKE_ONLY || '';
  const pages = only ? PAGES.filter((p) => p.indexOf(only) !== -1) : PAGES;
  if (!pages.length) throw new Error('no pages match SMOKE_ONLY=' + only);
  console.log('smoke start', pages.length, 'pages');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'
  });
  // Live header still has Core Schema Suppressor v2 (FAQPage in CORE_TYPES, no
  // disconnect flag). After header swap that script is gone. Neutralise it here
  // so the simulation matches swapped HTML, not "loader + leftover suppressor".
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
  const rows = [];
  for (const p of pages) {
    console.log('goto', p);
    const page = await ctx.newPage();
    await page.goto(pageUrl(p), { waitUntil: 'load', timeout: 90000 });
    console.log('loaded', p);
    const before = await snapshot(page);
    const bodyFaqQs = await simulateSwap(page, p);
    const after = await snapshot(page);
    const lost = before.ids.filter((id) => id && after.ids.indexOf(id) === -1);
    const expectKeep = LANDING_FAQ_KEEP[p];
    const expectZero = LANDING_FAQ_EXPECT_ZERO.includes(p);
    const faqOk = after.faqPages <= 1
      && after.faqQ.length === after.faqQVisible.length
      && (typeof expectKeep === 'number' ? after.faqQ.length === expectKeep : true)
      && (expectZero ? after.faqQ.length === 0 : true);
    const bareOk = after.bareCore.length === 0;
    const orgOk = after.org >= 1;
    const hosted = after.nodes.some((n) => n.where === '#arp-landing-schema');
    const ok = faqOk && bareOk && orgOk && hosted;
    const row = {
      path: p,
      ok,
      faqPages: after.faqPages,
      faqQ: after.faqQ.length,
      faqVisible: after.faqQVisible.length,
      org: after.org,
      bareCore: after.bareCore,
      lostIds: lost,
      bodyFaqQuestions: bodyFaqQs,
      questionsKept: after.faqQ
    };
    rows.push(row);
    console.log(`${ok ? 'ok' : 'FAIL'} ${p} hosted=${hosted} FAQPage=${after.faqPages} q=${after.faqQ.length} vis=${after.faqQVisible.length} org=${after.org} lost=${lost.length} bare=${after.bareCore.join(',') || '-'}`);
    if (!ok) {
      console.log('  drop', JSON.stringify(after.drop));
      console.log('  types', after.nodes.map((n) => `${n.type}@${n.where} ${n.id || '(no id)'} q${n.q}`).join(' | '));
    }
    if (p === '/jaguar-land-rover-els' || p === '/course-finder-photography-classes-near-me') {
      console.log('  body-faq:', bodyFaqQs.join(' | ') || '(none)');
      console.log('  kept:', after.faqQ.join(' | ') || '(none)');
    }
    await page.close();
  }
  const out = path.join(root, 'outputs', 'landing-code-block-smoke-2026-10-28.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(rows, null, 2), 'utf8');
  await browser.close();
  const fails = rows.filter((r) => !r.ok);
  console.log(`done ${rows.length} fail ${fails.length} report ${out}`);
  if (fails.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
