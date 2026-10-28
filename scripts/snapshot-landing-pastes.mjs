#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'module';
import {
  LANDING_HOSTED_PATHS,
  LANDING_FAQ_EXPECT_ZERO,
  LANDING_FAQ_KEEP,
  landingFileName
} from './lib/landing-hosted-paths.mjs';

const require = createRequire('G:/Dropbox/alan ranger photography/Website Code/Chat AI Bot/package.json');
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'alanranger-schema');
const extra = process.argv.includes('--news') ? ['/photography-news-blog'] : [];

function graphTypes(schema) {
  const nodes = Array.isArray(schema && schema['@graph']) ? schema['@graph'] : (schema ? [schema] : []);
  const types = [];
  nodes.forEach((n) => {
    const t = n && n['@type'];
    if (Array.isArray(t)) types.push(...t);
    else if (t) types.push(t);
  });
  return [...new Set(types)];
}

function faqCount(schema) {
  const nodes = Array.isArray(schema && schema['@graph']) ? schema['@graph'] : (schema ? [schema] : []);
  const faq = nodes.find((n) => {
    const t = n && n['@type'];
    return t === 'FAQPage' || (Array.isArray(t) && t.includes('FAQPage'));
  });
  if (!faq) return 0;
  const me = faq.mainEntity;
  return Array.isArray(me) ? me.length : (me ? 1 : 0);
}

function ids(schema) {
  const blob = JSON.stringify(schema || {});
  return {
    org: blob.includes('alanranger.com/#org'),
    website: blob.includes('alanranger.com/#website'),
    person: blob.includes('#person'),
    place: blob.includes('#place'),
    badOrg: blob.includes('#organization'),
    badWeb: /alanranger\.com#website(\b|$)/.test(blob)
  };
}

async function extractPaste(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(1500);
  return page.evaluate(() => {
    const sources = [];
    document.querySelectorAll('script[type="application/ld+json"], script[data-type="application/ld+json"]').forEach((el) => {
      const txt = (el.textContent || '').trim();
      if (!txt) return;
      let json = null;
      try { json = JSON.parse(txt); } catch (e) { json = null; }
      sources.push({
        id: el.id || '',
        where: el.closest('head') ? 'head' : 'body',
        parent: el.parentElement ? el.parentElement.tagName : '',
        chars: txt.length,
        types: (function (j) {
          const nodes = j && Array.isArray(j['@graph']) ? j['@graph'] : (j ? [j] : []);
          return nodes.map((n) => Array.isArray(n && n['@type']) ? n['@type'].join('+') : String((n && n['@type']) || '?'));
        }(json)),
        json
      });
    });
    const crit = document.getElementById('arp-critical-schema');
    const suppressor = Array.from(document.scripts).some((s) => /__AR_CORE_SUPPRESSOR/.test(s.textContent || ''));
    return {
      title: document.title || '',
      arpId: crit ? crit.id : '',
      suppressor,
      sources
    };
  });
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'
  });
  const pages = {};
  const report = [];
  const allPaths = [...LANDING_HOSTED_PATHS, ...extra];

  for (const p of allPaths) {
    const url = p === '/home' ? 'https://www.alanranger.com/home' : `https://www.alanranger.com${p}`;
    const page = await ctx.newPage();
    let row = { path: p, url, ok: false };
    try {
      const extracted = await extractPaste(page, url);
      const arp = extracted.sources.find((s) => s.id === 'arp-critical-schema');
      const schema = arp && arp.json;
      row = {
        path: p,
        url,
        ok: !!schema,
        title: extracted.title,
        suppressor: extracted.suppressor,
        sourceCount: extracted.sources.length,
        sourceIds: extracted.sources.map((s) => s.id || `${s.where}:${s.types.join(',')}`),
        types: schema ? graphTypes(schema) : [],
        faqLive: schema ? faqCount(schema) : 0,
        ids: schema ? ids(schema) : {},
        extraSources: extracted.sources.filter((s) => s.id !== 'arp-critical-schema').map((s) => ({
          id: s.id, where: s.where, types: s.types, chars: s.chars
        }))
      };
      if (schema && LANDING_HOSTED_PATHS.includes(p)) {
        const file = landingFileName(p);
        fs.writeFileSync(path.join(outDir, file), JSON.stringify(schema, null, 2), 'utf8');
        pages[p] = { file };
        if (p === '/home') pages['/'] = { file };
      }
      const expectZero = LANDING_FAQ_EXPECT_ZERO.includes(p);
      const keep = LANDING_FAQ_KEEP[p];
      if (expectZero) row.faqNote = row.faqLive > 0 ? 'FAQ removed — not visible' : 'no FAQ in paste';
      else if (typeof keep === 'number') row.faqNote = row.faqLive === keep ? `keep ${keep}` : `FAQ count ${row.faqLive} !== expected ${keep}`;
      else row.faqNote = row.faqLive ? `FAQ ${row.faqLive}` : 'no FAQ in paste';
    } catch (err) {
      row.error = err.message;
    }
    await page.close();
    report.push(row);
    console.log(`${row.ok ? 'ok' : 'FAIL'} ${p} faq=${row.faqLive || 0} ${row.faqNote || row.error || ''}`);
  }

  const manifest = { generatedAt: new Date().toISOString(), pages };
  fs.writeFileSync(path.join(outDir, 'landings-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  const reportPath = path.join(root, 'outputs', 'landing-paste-diff-2026-10-28.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  await browser.close();
  console.log(`manifest ${Object.keys(pages).length} files report ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
