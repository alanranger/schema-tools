#!/usr/bin/env node

/**
 * Bulk-regenerate blog `_howto.json` and `_faq.json` from live HTML (force overwrite on disk).
 * Skips slugs whose filenames contain `_event` (events / event-style posts). Commits every `--batch` URLs (default 50).
 *
 * Usage (from Schema Tools repo root):
 *   node scripts/bulk-regen-blog-howto-faq.mjs --from-schema-dir [--repo=alanranger-schema] [--batch=50] [--max=500] [--no-commit]
 *   (--from-schema-dir only includes *_schema.json whose canonical WebPage URL is under /blog-on-photography/.)
 *   node scripts/bulk-regen-blog-howto-faq.mjs --csv=path/to.csv [--repo=...] ...
 *
 * CSV must include a `url` column (header row). Only blog-on-photography URLs are processed.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { extractHowToFromArticle, htmlBlockToPlainText } from './howto-extraction.mjs';
import { extractFAQFromArticle } from './faq-extraction.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function parseArgs() {
  const a = process.argv.slice(2);
  const o = {
    fromSchemaDir: false,
    csv: null,
    repo: path.join(root, 'alanranger-schema'),
    batch: 50,
    max: Number.POSITIVE_INFINITY,
    noCommit: false
  };
  for (const x of a) {
    if (x === '--from-schema-dir') o.fromSchemaDir = true;
    else if (x === '--no-commit') o.noCommit = true;
    else if (x.startsWith('--csv=')) o.csv = path.resolve(x.slice(6));
    else if (x.startsWith('--repo=')) o.repo = path.resolve(x.slice(7));
    else if (x.startsWith('--batch=')) o.batch = Math.max(1, Number.parseInt(x.slice(8), 10) || 50);
    else if (x.startsWith('--max=')) o.max = Math.max(1, Number.parseInt(x.slice(6), 10) || o.max);
  }
  return o;
}

function appendLog(line) {
  const logPath = path.join(root, 'BULK-REGEN-LOG.md');
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`, 'utf8');
}

function slugFromSchemaFileName(name) {
  if (!name.endsWith('_schema.json')) return null;
  return name.slice(0, -'_schema.json'.length);
}

/** Only blog posts: canonical WebPage URL must include /blog-on-photography/. Skips products, events, etc. */
function canonicalBlogUrlFromSchemaFile(filePath) {
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
  const blogPath = '/blog-on-photography/';
  if (doc && doc['@type'] === 'WebPage' && typeof doc.url === 'string' && doc.url.includes(blogPath)) {
    return doc.url;
  }
  const graph = doc && Array.isArray(doc['@graph']) ? doc['@graph'] : [];
  for (const node of graph) {
    if (node && node['@type'] === 'WebPage' && typeof node.url === 'string' && node.url.includes(blogPath)) {
      return node.url;
    }
  }
  return null;
}

function buildUrlsFromSchemaDir(repo, max) {
  const names = fs.readdirSync(repo).filter((n) => n.endsWith('_schema.json'));
  const urls = [];
  for (const n of names) {
    const slug = slugFromSchemaFileName(n);
    if (!slug || /_event/i.test(slug)) continue;
    const canonical = canonicalBlogUrlFromSchemaFile(path.join(repo, n));
    if (!canonical) continue;
    urls.push(canonical);
  }
  return urls.sort().slice(0, max);
}

function readUrlsFromCsv(csvPath, max) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const urlIdx = header.indexOf('url');
  if (urlIdx < 0) throw new Error('CSV must include a url column in the header row');
  const urls = [];
  for (let i = 1; i < lines.length && urls.length < max; i++) {
    const cells = lines[i].split(',');
    const u = (cells[urlIdx] || '').trim().replace(/^"|"$/g, '');
    if (!u || !u.includes('alanranger.com/blog-on-photography/')) continue;
    const slug = u.split('/').pop() || '';
    if (!slug || /_event/i.test(slug)) continue;
    urls.push(u);
  }
  return urls;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; SchemaToolsBulkRegen/1.0)',
      accept: 'text/html,application/xhtml+xml'
    },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function writeHowTo(repo, slug, url, extracted, headline) {
  if (!extracted || extracted.steps.length < 3) return 'skip-howto';
  const steps = extracted.steps.map((s, idx) => ({
    '@type': 'HowToStep',
    position: typeof s.position === 'number' && s.position > 0 ? s.position : idx + 1,
    name: s.name,
    text: s.text
  }));
  const doc = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': `${url}#howto`,
    name: headline || slug.replace(/-/g, ' '),
    description: '',
    inLanguage: 'en-GB',
    image: { '@id': `${url}#primaryimage` },
    author: { '@id': 'https://www.alanranger.com/#person' },
    publisher: { '@id': 'https://www.alanranger.com/#org' },
    step: steps
  };
  fs.writeFileSync(path.join(repo, `${slug}_howto.json`), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return 'ok-howto';
}

function writeFaq(repo, slug, url, extracted) {
  if (!extracted || extracted.pairs.length < 3) return 'skip-faq';
  const mainEntity = extracted.pairs.map((p) => ({
    '@type': 'Question',
    name: p.question,
    acceptedAnswer: { '@type': 'Answer', text: p.answer }
  }));
  const doc = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity
  };
  fs.writeFileSync(path.join(repo, `${slug}_faq.json`), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return 'ok-faq';
}

function gitCommitBatch(repo, batchNum) {
  execSync('git add -A', { cwd: repo, stdio: 'inherit' });
  execSync(`git commit -m "Bulk regen blog HowTo and FAQ (batch ${batchNum})"`, { cwd: repo, stdio: 'inherit' });
  execSync('git push', { cwd: repo, stdio: 'inherit' });
}

async function main() {
  const opts = parseArgs();
  if (!opts.fromSchemaDir && !opts.csv) {
    console.error(
      'Usage: node scripts/bulk-regen-blog-howto-faq.mjs (--from-schema-dir|--csv=path) [--repo=alanranger-schema] [--batch=50] [--max=N] [--no-commit]'
    );
    process.exit(1);
  }

  const urls = opts.fromSchemaDir
    ? buildUrlsFromSchemaDir(opts.repo, opts.max)
    : readUrlsFromCsv(opts.csv, opts.max);

  if (!urls.length) {
    console.error('No URLs to process.');
    process.exit(1);
  }

  appendLog(`Starting bulk HowTo/FAQ regen: ${urls.length} URL(s), batch=${opts.batch}, repo=${opts.repo}, noCommit=${opts.noCommit}`);

  let batchNum = 1;
  let batchErrors = 0;

  const finishBatch = () => {
    if (!opts.noCommit) {
      try {
        const st = execSync('git status --porcelain', { cwd: opts.repo, encoding: 'utf8' }).trim();
        if (!st) {
          appendLog(`Batch ${batchNum}: no file changes; skipping commit.`);
        } else {
          gitCommitBatch(opts.repo, batchNum);
          appendLog(`Batch ${batchNum} committed and pushed.`);
        }
      } catch (e) {
        appendLog(`Batch ${batchNum} git failed: ${e.message}`);
        throw e;
      }
      batchNum += 1;
    }
    batchErrors = 0;
  };

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const slug = url.split('/').pop() || '';
    try {
      const html = await fetchHtml(url);
      const plain = htmlBlockToPlainText(html);
      const ogTitle = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1];
      const headline = ogTitle ? ogTitle.replace(/&amp;/g, '&').replace(/&#039;/g, "'") : '';
      const how = extractHowToFromArticle(html, plain, null);
      const faq = extractFAQFromArticle(html, plain, null);
      const hRes = writeHowTo(opts.repo, slug, url, how, headline);
      const fRes = writeFaq(opts.repo, slug, url, faq);
      appendLog(`${slug} howto=${how.strategy}/${how.steps.length} faq=${faq.strategy}/${faq.pairs.length} files=${hRes},${fRes}`);
    } catch (e) {
      batchErrors += 1;
      appendLog(`${slug} ERROR ${e.message}`);
    }

    const posInBatch = (i + 1) % opts.batch;
    const countInBatch = posInBatch === 0 ? opts.batch : posInBatch;
    const endOfBatch = posInBatch === 0 || i + 1 === urls.length;
    if (endOfBatch) {
      const rate = batchErrors / Math.max(1, countInBatch);
      if (rate > 0.1) {
        appendLog(`Halted: batch error rate ${(100 * rate).toFixed(1)}% exceeds 10% (${batchErrors}/${countInBatch}).`);
        process.exit(1);
      }
      finishBatch();
    }
  }

  appendLog(`Finished bulk HowTo/FAQ regen (${urls.length} URL(s)).`);
  console.log(`Done. ${urls.length} URL(s) processed. Log appended to BULK-REGEN-LOG.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
