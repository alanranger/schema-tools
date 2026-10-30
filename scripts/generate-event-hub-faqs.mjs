/**
 * Generate FAQPage files for event collection hubs from live visible FAQs.
 * Same extractor as blogs. Called from Event Posts generation and as:
 *   node scripts/generate-event-hub-faqs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFAQFromArticle } from './faq-extraction.mjs';
import { EVENT_HUB_PATHS } from './lib/event-hub-paths.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.join(root, 'alanranger-schema');
const UA = 'Mozilla/5.0 (compatible; SchemaToolsEventHub/1.0)';

function faqPage(url, pairs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: pairs.map((p) => ({
      '@type': 'Question',
      name: p.question,
      acceptedAnswer: { '@type': 'Answer', text: p.answer }
    }))
  };
}

function cleanHubQuestion(raw) {
  const q = String(raw || '')
    .replace(/\[[^\]]*-icon\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (q.length < 12 || q.charAt(q.length - 1) !== '?') return '';
  return q;
}

export async function generateEventHubFaqs({ destDir = repo } = {}) {
  const written = [];
  for (const p of EVENT_HUB_PATHS) {
    const url = `https://www.alanranger.com${p}`;
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' } });
    if (!res.ok) throw new Error(`${p} HTTP ${res.status}`);
    const html = await res.text();
    const extracted = extractFAQFromArticle(html, '', null);
    const pairs = (extracted.pairs || [])
      .map((row) => ({ question: cleanHubQuestion(row.question), answer: String(row.answer || '').trim() }))
      .filter((row) => row.question && row.answer.length >= 24);
    const slug = p.replace(/^\//, '');
    const dest = path.join(destDir, `${slug}_faq.json`);
    if (!pairs.length) {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      written.push({ path: p, file: `${slug}_faq.json`, count: 0, strategy: extracted.strategy || 'none' });
      continue;
    }
    fs.writeFileSync(dest, `${JSON.stringify(faqPage(url, pairs), null, 2)}\n`, 'utf8');
    written.push({ path: p, file: `${slug}_faq.json`, count: pairs.length, strategy: extracted.strategy });
  }
  return written;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('generate-event-hub-faqs.mjs')) {
  const rows = await generateEventHubFaqs();
  const logPath = path.join(root, 'EVENT-HUB-FAQ-LOG.md');
  const stamp = new Date().toISOString();
  const lines = rows.map((r) => `${stamp} ${r.path} file=${r.file} count=${r.count} strategy=${r.strategy}`);
  fs.appendFileSync(logPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(JSON.stringify(rows, null, 2));
}
