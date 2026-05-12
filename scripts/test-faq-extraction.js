#!/usr/bin/env node

/**
 * Regression test: blog FAQ extraction must yield 3+ validated pairs on canon URLs.
 */

import { extractFAQFromArticle } from './faq-extraction.mjs';

const STARTER_URLS = [
  'https://www.alanranger.com/blog-on-photography/what-is-aperture-in-photography',
  'https://www.alanranger.com/blog-on-photography/what-is-iso-in-photography',
  'https://www.alanranger.com/blog-on-photography/what-is-shutter-speed',
  'https://www.alanranger.com/blog-on-photography/what-is-depth-of-field',
  'https://www.alanranger.com/blog-on-photography/top-tips-for-photographing-bluebells',
  'https://www.alanranger.com/blog-on-photography/mastering-photography-composition-rules'
];

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; SchemaToolsFAQExtract/1.0)',
      accept: 'text/html,application/xhtml+xml'
    },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

console.log('FAQ extraction regression test');
console.log('='.repeat(72));

let failures = 0;

for (const url of STARTER_URLS) {
  const logs = [];
  const debugLog = (msg) => logs.push(msg);

  let html;
  try {
    html = await fetchHtml(url);
  } catch (e) {
    console.error(`❌ Fetch failed: ${url}\n   ${e.message}`);
    failures++;
    continue;
  }

  const result = extractFAQFromArticle(html, '', debugLog);
  const ok = result.pairs.length >= 3;
  if (!ok) failures++;

  console.log(`\n${ok ? '✅' : '❌'} ${url}`);
  console.log(`   Strategy: ${result.strategy}`);
  console.log(`   Pairs (accepted): ${result.pairs.length}`);
  console.log(`   First question: ${result.pairs[0]?.question || '(none)'}`);
  if (!ok) {
    console.log('   Debug tail:');
    logs.slice(-8).forEach((line) => console.log(`     ${line}`));
  }
}

console.log('\n' + '='.repeat(72));

if (failures > 0) {
  console.error(`❌ Failed: ${failures} URL(s) returned fewer than 3 pairs.`);
  process.exit(1);
}

console.log('✅ All starter URLs passed (3+ pairs each).');
