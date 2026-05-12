#!/usr/bin/env node

/**
 * Regression test: extracted HowTo steps must not contain HTML artefacts or oversize text.
 */

import { extractHowToFromArticle, htmlBlockToPlainText } from './howto-extraction.mjs';

const STARTER_URLS = [
  'https://www.alanranger.com/blog-on-photography/what-is-aperture-in-photography',
  'https://www.alanranger.com/blog-on-photography/what-is-iso-in-photography',
  'https://www.alanranger.com/blog-on-photography/what-is-shutter-speed',
  'https://www.alanranger.com/blog-on-photography/what-is-depth-of-field',
  'https://www.alanranger.com/blog-on-photography/top-tips-for-photographing-bluebells',
  'https://www.alanranger.com/blog-on-photography/mastering-photography-composition-rules'
];

const BAD_HTML_RE = /<\/?|`\s*<p>|<a\s|<ul>|<li>|\\"|&lt;\/?[a-z]/i;

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; SchemaToolsHowToExtract/1.0)',
      accept: 'text/html,application/xhtml+xml'
    },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function auditSteps(url, steps) {
  const problems = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const name = s.name || '';
    const text = s.text || '';
    if (BAD_HTML_RE.test(name)) problems.push(`step ${i + 1} name: HTML artefact`);
    if (BAD_HTML_RE.test(text)) problems.push(`step ${i + 1} text: HTML artefact`);
    if (text.length > 600) problems.push(`step ${i + 1} text length ${text.length} > 600`);
    if (name.length > 120) problems.push(`step ${i + 1} name length ${name.length} > 120`);
  }
  return problems;
}

console.log('HowTo extraction regression test');
console.log('='.repeat(72));

let hardFail = false;

for (const url of STARTER_URLS) {
  const logs = [];
  const debugLog = (msg) => logs.push(msg);

  let html;
  try {
    html = await fetchHtml(url);
  } catch (e) {
    console.error(`❌ Fetch failed: ${url}\n   ${e.message}`);
    hardFail = true;
    continue;
  }

  const plain = htmlBlockToPlainText(html);
  const result = extractHowToFromArticle(html, plain, debugLog);

  console.log(`\n${url}`);
  console.log(`   Strategy: ${result.strategy}`);
  console.log(`   Steps (accepted): ${result.steps.length}`);
  if (result.steps[0]) {
    console.log(`   First step name: ${result.steps[0].name.slice(0, 100)}${result.steps[0].name.length > 100 ? '…' : ''}`);
  }

  const problems = auditSteps(url, result.steps);
  if (problems.length) {
    console.error(`   ❌ Quality check failed:`);
    problems.forEach((p) => console.error(`      - ${p}`));
    hardFail = true;
  }
}

console.log('\n' + '='.repeat(72));

if (hardFail) {
  console.error('❌ One or more URLs failed quality checks (or fetch failed).');
  process.exit(1);
}

console.log('✅ Quality checks passed for all starter URLs (no bad steps where steps exist).');
