#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'module';
import { landingFileName, LANDING_FAQ_EXPECT_ZERO, LANDING_FAQ_KEEP } from './lib/landing-hosted-paths.mjs';

const require = createRequire('G:/Dropbox/alan ranger photography/Website Code/Chat AI Bot/package.json');
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.join(root, 'alanranger-schema');
const targets = [
  '/photography-courses-coventry',
  '/free-online-photography-course',
  '/gallery-image-portfolios'
];

function typesOf(schema) {
  const nodes = Array.isArray(schema['@graph']) ? schema['@graph'] : [schema];
  return [...new Set(nodes.flatMap((n) => Array.isArray(n['@type']) ? n['@type'] : [n['@type']].filter(Boolean)))];
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'
  });
  for (const p of targets) {
    const file = path.join(repo, landingFileName(p));
    const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
    const page = await ctx.newPage();
    await page.goto('https://www.alanranger.com' + p, { waitUntil: 'load', timeout: 90000 });
    await page.addScriptTag({ path: path.join(repo, 'loaders', 'landing-page-loader.js') });
    const result = await page.evaluate((hosted) => {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script,style,noscript').forEach((el) => el.remove());
      const text = String(clone.textContent || '').replace(/['’]/g, "'").toLowerCase();
      const nodes = Array.isArray(hosted['@graph']) ? hosted['@graph'] : [hosted];
      const faq = nodes.find((n) => {
        const t = n && n['@type'];
        return t === 'FAQPage' || (Array.isArray(t) && t.includes('FAQPage'));
      });
      const qs = faq && Array.isArray(faq.mainEntity) ? faq.mainEntity : [];
      const vis = qs.filter((q) => {
        const name = String((q && q.name) || '').replace(/['’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
        return name.length > 8 && text.indexOf(name) !== -1;
      });
      const ids = JSON.stringify(hosted);
      return {
        title: document.title,
        errors: [],
        org: ids.includes('alanranger.com/#org'),
        website: ids.includes('alanranger.com/#website'),
        faqBefore: qs.length,
        faqAfter: vis.length
      };
    }, schema);
    const expectZero = LANDING_FAQ_EXPECT_ZERO.includes(p);
    const keep = LANDING_FAQ_KEEP[p];
    const faqOk = expectZero ? result.faqAfter === 0 : result.faqAfter === keep;
    console.log([
      p,
      `types ${typesOf(schema).join(',')}`,
      `faq ${result.faqBefore}->${result.faqAfter} ${faqOk ? 'OK' : 'FAIL'}`,
      `org ${result.org} website ${result.website}`
    ].join(' | '));
    await page.close();
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
