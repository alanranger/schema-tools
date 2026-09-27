#!/usr/bin/env node
/**
 * Repair blog schema when Squarespace title/meta changes but URL/slug stays the same.
 * - Prefer live og:title + meta description over slug-derived titles
 * - Upsert into blog-schema.json by @id (never by title)
 *
 * Usage:
 *   node scripts/repair-blog-title-sync.mjs
 *   node scripts/repair-blog-title-sync.mjs --slug what-is-contrast-in-photography
 *   node scripts/repair-blog-title-sync.mjs --scan-only
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { upsertSlugsIntoBlogSchema, normalizeUrl } from './lib/upsert-blog-schema-nodes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO = path.join(ROOT, 'alanranger-schema');
const SITE = 'https://www.alanranger.com/blog-on-photography/';

function parseArgs(argv) {
  const out = { slugs: [], scanOnly: false, upsertOnly: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--scan-only') out.scanOnly = true;
    else if (a === '--upsert-only') out.upsertOnly = true;
    else if (a === '--slug') out.slugs.push(argv[++i]);
    else if (a === '--all-mismatches') out.allMismatches = true;
  }
  return out;
}

function cleanText(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripBrand(title) {
  return cleanText(title).replace(/\s*[-|]\s*Alan Ranger Photography.*$/i, '').trim();
}

function attr(html, re) {
  const m = html.match(re);
  return m ? cleanText(m[1]) : '';
}

function extractHead(html) {
  let title = attr(html, /property=["']og:title["']\s+content=["']([^"']+)["']/i)
    || attr(html, /content=["']([^"']+)["']\s+property=["']og:title["']/i);
  if (!title) title = attr(html, /<title[^>]*>([^<]+)<\/title>/i);
  title = stripBrand(title);

  let description = attr(html, /name=["']description["']\s+content=["']([^"']+)["']/i)
    || attr(html, /content=["']([^"']+)["']\s+name=["']description["']/i);
  if (!description) {
    description = attr(html, /property=["']og:description["']\s+content=["']([^"']+)["']/i)
      || attr(html, /content=["']([^"']+)["']\s+property=["']og:description["']/i);
  }
  return { title, description: cleanText(description) };
}

function extractSqspDates(html, preferredTitle = '') {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const posts = [];
  for (const b of blocks) {
    try {
      const j = JSON.parse(b[1]);
      const nodes = Array.isArray(j) ? j : j['@graph'] ? j['@graph'] : [j];
      for (const n of nodes) {
        const t = n && n['@type'];
        const types = Array.isArray(t) ? t : [t];
        const isArticle = types.includes('Article');
        const isBlog = types.includes('BlogPosting');
        if (!isArticle && !isBlog) continue;
        if (n.datePublished || n.dateModified) {
          posts.push({ ...n, isArticle });
        }
      }
    } catch { /* ignore bad blocks */ }
  }
  if (!posts.length) return { datePublished: null, dateModified: null };
  const want = cleanText(preferredTitle).toLowerCase();
  const matched = want
    ? posts.find((p) => cleanText(p.headline || p.name || '').toLowerCase() === want)
    : null;
  const article = posts.find((p) => p.isArticle);
  const byNewest = [...posts].sort((a, b) => {
    const da = Date.parse(a.dateModified || a.datePublished || 0) || 0;
    const db = Date.parse(b.dateModified || b.datePublished || 0) || 0;
    return db - da;
  })[0];
  // Prefer Squarespace Article (real publish day) over injected BlogPosting dates.
  const chosen = article || matched || byNewest;
  return {
    datePublished: chosen.datePublished || null,
    dateModified: chosen.dateModified || chosen.datePublished || null
  };
}

function bodyTitleHint(articleBody) {
  const raw = String(articleBody || '').trim();
  if (!raw) return '';
  const m = raw.match(/^(.{12,140}?)\s+Updated\b/i);
  return m ? cleanText(m[1]) : '';
}

function looksLikeSlugTitle(headline, slug) {
  const fromSlug = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return cleanText(headline).toLowerCase() === fromSlug.toLowerCase();
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'AlanRangerSchemaRepair/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, obj) {
  fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
}

function toUtcMidnightIso(dateStr) {
  const m = String(dateStr || '').match(/(\d{4}-\d{2}-\d{2})/);
  return m ? `${m[1]}T00:00:00.000Z` : null;
}

function ensurePeriod(s) {
  const t = cleanText(s);
  if (!t) return t;
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function patchIndividuals(slug, live) {
  const url = normalizeUrl(`${SITE}${slug}`);
  const changed = [];

  const schemaPath = path.join(REPO, `${slug}_schema.json`);
  if (fs.existsSync(schemaPath)) {
    const wp = readJson(schemaPath);
    wp.name = live.title;
    wp.description = ensurePeriod(live.description || live.title);
    wp.url = url;
    wp['@id'] = `${url}#webpage`;
    writeJson(schemaPath, wp);
    changed.push(path.basename(schemaPath));
  }

  const bpPath = path.join(REPO, `${slug}_blogposting.json`);
  if (fs.existsSync(bpPath)) {
    const bp = readJson(bpPath);
    bp.headline = live.title;
    bp.alternativeHeadline = `${live.title} | Alan Ranger Photography`;
    bp.description = ensurePeriod(live.description || live.title);
    bp.url = url;
    bp['@id'] = `${url}#blogposting`;
    if (live.datePublished) {
      bp.datePublished = toUtcMidnightIso(live.datePublished);
      bp.dateCreated = bp.datePublished;
    }
    if (live.dateModified) bp.dateModified = toUtcMidnightIso(live.dateModified);
    else if (live.datePublished) bp.dateModified = bp.datePublished;
    writeJson(bpPath, bp);
    changed.push(path.basename(bpPath));
  }

  const crumbPath = path.join(REPO, `${slug}_breadcrumb.json`);
  if (fs.existsSync(crumbPath)) {
    const crumb = readJson(crumbPath);
    if (Array.isArray(crumb.itemListElement) && crumb.itemListElement[1]) {
      crumb.itemListElement[1].name = live.title;
      crumb.itemListElement[1].item = url;
    }
    crumb['@id'] = `${url}#breadcrumb`;
    writeJson(crumbPath, crumb);
    changed.push(path.basename(crumbPath));
  }

  return changed;
}

function findMismatchSlugs() {
  const files = fs.readdirSync(REPO).filter((f) => f.endsWith('_blogposting.json'));
  const hits = [];
  for (const f of files) {
    const slug = f.replace(/_blogposting\.json$/, '');
    const bp = readJson(path.join(REPO, f));
    const hint = bodyTitleHint(bp.articleBody);
    const slugTitle = looksLikeSlugTitle(bp.headline, slug);
    const bodyDiffers = hint && cleanText(hint).toLowerCase() !== cleanText(bp.headline || '').toLowerCase();
    if (slugTitle || bodyDiffers) hits.push({ slug, headline: bp.headline, hint, slugTitle, bodyDiffers });
  }
  return hits;
}

async function refreshSlug(slug) {
  const url = `${SITE}${slug}`;
  const html = await fetchHtml(url);
  const head = extractHead(html);
  if (!head.title) throw new Error(`No live title for ${slug}`);
  const dates = extractSqspDates(html, head.title);
  const live = { ...head, ...dates };
  const changed = patchIndividuals(slug, live);
  return { slug, live, changed };
}

async function main() {
  const opts = parseArgs(process.argv);
  let slugs = opts.slugs.slice();

  if (opts.scanOnly || opts.allMismatches || slugs.length === 0) {
    const mismatches = findMismatchSlugs();
    console.log(`Found ${mismatches.length} possible title mismatches:`);
    for (const m of mismatches.slice(0, 40)) {
      console.log(`- ${m.slug}`);
      console.log(`    headline: ${m.headline}`);
      if (m.hint) console.log(`    bodyHint: ${m.hint}`);
    }
    if (opts.scanOnly) return;
    if (opts.allMismatches || slugs.length === 0) {
      slugs = mismatches.map((m) => m.slug);
    }
  }

  // Always include the known renamed pages
  for (const must of ['what-is-contrast-in-photography', 'what-is-negative-space-in-photography']) {
    if (!slugs.includes(must)) slugs.push(must);
  }

  if (opts.upsertOnly) {
    const r = upsertSlugsIntoBlogSchema(REPO, slugs);
    console.log(`Upserted ${r.upserted} nodes into blog-schema.json (graph size ${r.total})`);
    return;
  }

  const repaired = [];
  for (const slug of slugs) {
    try {
      const r = await refreshSlug(slug);
      repaired.push(r);
      console.log(`OK ${slug}`);
      console.log(`   title: ${r.live.title}`);
      console.log(`   desc:  ${(r.live.description || '').slice(0, 100)}`);
      console.log(`   files: ${r.changed.join(', ')}`);
    } catch (e) {
      console.error(`FAIL ${slug}: ${e.message}`);
    }
  }

  const r = upsertSlugsIntoBlogSchema(REPO, repaired.map((x) => x.slug));
  console.log(`\nUpserted ${r.upserted} nodes into blog-schema.json (graph size ${r.total})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
