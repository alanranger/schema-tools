#!/usr/bin/env node
/**
 * Build the hosted code-block stylesheet (Alan 4 Nov): styles/blocks.css for schema.alanranger.com.
 *   node scripts/blocks-css/build-blocks-css.mjs --out <dir> [--previous <dir>] [--html-dir <cache>] [--scope risk|all] [--env <.env>]
 * Writes <out>/styles/blocks.css, <out>/styles/blocks-sources.json (each block's CSS as designed = next run's
 * "last known good") and <out>/styles/blocks-manifest.json; prints a JSON summary. Read-only on the site.
 * scope risk (default): blocks Squarespace can blank (a rule body with no whitespace, or already blanked); all: every block.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './css-lib.mjs';
import { pageBlocks, groupBlocks, findClashes, buildStylesheet } from './blocks-css.mjs';
import { pasteStyles, snapshotReader, resolveDamaged } from './sources.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = 'https://www.alanranger.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i += 1) {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36' } }).catch(() => null);
    if (r?.status === 200) return r.text();
    await sleep(r?.status === 429 ? 20000 : 3000);
  }
  return null;
}

/** Every sitemap page's served HTML: from a cache folder (index.json + files) or fetched politely. */
export async function loadPages({ htmlDir, onProgress } = {}) {
  if (htmlDir) {
    const index = JSON.parse(fs.readFileSync(path.join(htmlDir, 'index.json'), 'utf8').replace(/^\uFEFF/, ''));
    return index.filter((p) => p.file).map((p) => ({ url: p.url, html: fs.readFileSync(path.join(htmlDir, p.file), 'utf8') }));
  }
  const sitemap = await get(`${SITE}/sitemap.xml`);
  const urls = [...new Set([...(sitemap || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()))];
  const pages = [];
  for (const [i, url] of urls.entries()) {
    const html = await get(url);
    if (html) pages.push({ url, html });
    onProgress?.(`Reading site pages ({n} of {total})`, i, urls.length);
    await sleep(400);
  }
  if (urls.length < 100 || pages.length < urls.length * 0.95) throw new Error(`only ${pages.length} of ${urls.length} sitemap pages could be read`);
  return pages;
}

const readJson = (f, fallback) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback);

/** Pick the blocks for the file: damaged ones from their source, intact ones as they are live. */
async function selectBlocks(all, scope, ctx) {
  const blocks = []; const unconfirmed = [];
  for (const b of all) {
    if (!b.bodyId) continue;
    if (b.stripped) {
      const s = await resolveDamaged(b, ctx);
      if (s) blocks.push({ ...b, css: s.css, source: s.source });
      else unconfirmed.push({ key: b.key, stripped: b.stripped });
    } else if (scope === 'all' || b.atRisk) blocks.push({ ...b, source: 'live (intact)' });
  }
  return { blocks, unconfirmed };
}

export async function buildBlocksCss({ out, previous = out, htmlDir, scope = 'risk', envFile, onProgress } = {}) {
  const pages = await loadPages({ htmlDir, onProgress });
  const all = pages.flatMap((p) => pageBlocks(p.url, p.html));
  const prevSources = readJson(path.join(previous, 'styles', 'blocks-sources.json'), { blocks: {} }).blocks;
  const env = envFile && fs.existsSync(envFile) ? loadEnv(envFile) : process.env;
  const { blocks, unconfirmed } = await selectBlocks(all, scope, { previous: prevSources, pastes: pasteStyles(), snapshots: snapshotReader(env) });
  const groups = groupBlocks(blocks);
  const built = buildStylesheet(groups, 'build');
  const fixes = fs.readFileSync(path.join(HERE, 'contrast-fixes.css'), 'utf8');
  const bodyCss = `${built.css}\n/* contrast fixes (audit 4 Nov 2026) */\n${fixes}`;
  const hash = crypto.createHash('sha1').update(bodyCss).digest('hex').slice(0, 10);
  const css = bodyCss.replace('generated build', `content ${hash}`);
  const dir = path.join(out, 'styles');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'blocks.css'), css);
  const sources = Object.fromEntries(blocks.map((b) => [b.key, { css: b.css, source: b.source, page: b.url }]));
  fs.writeFileSync(path.join(dir, 'blocks-sources.json'), `${JSON.stringify({ note: 'Each styled code block\'s CSS as designed (last known good for the next build). Generated; do not edit.', blocks: sources }, null, 1)}\n`);
  const manifest = { content: hash, scope, pages_read: pages.length, styled_blocks_on_site: all.length, blocks_in_file: blocks.length, unique_groups: groups.length,
    pages_in_file: new Set(blocks.map((b) => b.url)).size, damaged_fixed: blocks.filter((b) => b.stripped).map((b) => ({ key: b.key, source: b.source })), unconfirmed, notes: built.notes };
  fs.writeFileSync(path.join(dir, 'blocks-manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  return { ...manifest, bytes: Buffer.byteLength(css), gzip_bytes: zlib.gzipSync(css).length, clashes: findClashes(blocks) };
}

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const out = arg('out');
  if (!out) { console.error('usage: --out <dir> [--previous <dir>] [--html-dir <cache>] [--scope risk|all] [--env <.env>]'); process.exit(2); }
  const r = await buildBlocksCss({ out, previous: arg('previous') || out, htmlDir: arg('html-dir'), scope: arg('scope') || 'risk', envFile: arg('env') });
  if (arg('clashes')) fs.writeFileSync(arg('clashes'), JSON.stringify(r.clashes, null, 1));
  console.log(JSON.stringify({ ...r, clashes: r.clashes.length }, null, 1));
}
