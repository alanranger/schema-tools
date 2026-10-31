#!/usr/bin/env node
/**
 * Per-file differences between a landings app-cli output and the hosted landing files, each tied to its live source.
 *   node scripts/landing-diff-explain.mjs <app-cli out dir> [--json <file>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(ROOT, 'alanranger-schema');
const OUT = path.resolve(process.argv[2]);
const jsonArg = process.argv.indexOf('--json');
const DATES = new Set(['validFrom', 'priceValidUntil', 'generatedAt', 'dateModified']);
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).filter((k) => !DATES.has(k)).sort().map((k) => [k, canon(v[k])])) : v);
const types = (n) => [].concat(n['@type']);
const find = (g, t) => g.filter((n) => types(n).includes(t));
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

function itemListNote(h, n) {
  const hc = h.reduce((s, x) => s + (x.itemListElement || []).length, 0);
  const nc = n.reduce((s, x) => s + (x.itemListElement || []).length, 0);
  if (!h.length && !n.length) return null;
  if (same(h, n)) return null;
  if (!n.length) return `ItemList removed (${hc} items before): the page shows no list of pages`;
  return `ItemList ${hc} → ${nc} items: the page's summary blocks show ${nc} item(s), in that order`;
}

function breadcrumbNote(h, n) {
  if (same(h, n)) return null;
  const names = n[0] ? n[0].itemListElement.map((c) => c.name).join(' > ') : '';
  return h.length ? `BreadcrumbList rebuilt from the URL path: ${names}` : `BreadcrumbList added from the URL path: ${names}`;
}

function videoNote(h, n) {
  if (same(h, n)) return null;
  const facts = n.map((v) => `${v.name} (uploaded ${String(v.uploadDate).slice(0, 10)}, ${v.duration || 'no duration'})`).join('; ');
  return `VideoObject ${h.length} → ${n.length}: from the YouTube watch pages of the videos embedded on the page — ${facts}`;
}

function ratingNote(h, n) {
  const ho = h[0] || {};
  const no = n[0] || {};
  if (same([ho.aggregateRating, ho.review], [no.aggregateRating, no.review])) return null;
  const fmt = (r) => (r ? `${r.ratingValue} from ${r.reviewCount}` : 'none');
  if (no.aggregateRating || no.review) return `UNEXPECTED business rating ${fmt(no.aggregateRating)} on the business node`;
  return `business rating ${fmt(ho.aggregateRating)} removed (P23: Google treats self-serving LocalBusiness/Organization reviews as ineligible)`;
}

function websiteNote(h, n) {
  const pick = (x) => ({ description: x?.description, image: x?.image, publisher: x?.publisher, potentialAction: x?.potentialAction, url: x?.url });
  if (same(pick(h[0]), pick(n[0]))) return null;
  const changed = Object.keys(pick(h[0])).filter((k) => !same(pick(h[0])[k], pick(n[0])[k]));
  return `WebSite ${changed.join(', ')}: description + image from Squarespace's site-level WebSite JSON-LD on the page; url/publisher/SearchAction from the generator`;
}

function otherNotes(hg, ng) {
  const notes = [];
  const org = (g) => find(g, 'LocalBusiness')[0] || {};
  if (org(hg).telephone !== org(ng).telephone) notes.push(`telephone ${org(hg).telephone} → ${org(ng).telephone} (Alan's format)`);
  const img = (g) => find(g, 'ImageObject').map((i) => i.contentUrl).join(',');
  if (img(hg) !== img(ng)) notes.push('primary image follows the page\'s og:image (R1)');
  const wp = (g) => find(g, 'WebPage')[0] || {};
  if (wp(hg).description !== wp(ng).description || wp(hg).headline !== wp(ng).headline) notes.push('WebPage title/description follow the live head tags (R1)');
  if (!same(find(hg, 'FAQPage').map((f) => f.mainEntity), find(ng, 'FAQPage').map((f) => f.mainEntity))) notes.push('FAQ mirrors the visible accordion on the page');
  const svc = (g) => find(g, 'Service')[0] || {};
  if (JSON.stringify(types(svc(hg))) !== JSON.stringify(types(svc(ng)))) notes.push(`Service type ${types(svc(hg)).join('+')} → ${types(svc(ng)).join('+')} (generator builds Service; the Product type came from an old paste)`);
  return notes;
}

function explain(file) {
  const hg = JSON.parse(fs.readFileSync(path.join(REPO, file), 'utf8'))['@graph'] || [];
  const ng = JSON.parse(fs.readFileSync(path.join(OUT, 'alanranger-schema', file), 'utf8'))['@graph'] || [];
  const notes = [
    itemListNote(find(hg, 'ItemList'), find(ng, 'ItemList')),
    breadcrumbNote(find(hg, 'BreadcrumbList'), find(ng, 'BreadcrumbList')),
    videoNote(find(hg, 'VideoObject'), find(ng, 'VideoObject')),
    ratingNote(find(hg, 'LocalBusiness'), find(ng, 'LocalBusiness')),
    websiteNote(find(hg, 'WebSite'), find(ng, 'WebSite')),
    ...otherNotes(hg, ng)
  ].filter(Boolean);
  const keyOrderOnly = !notes.length && same(hg, ng);
  return { file: file.replace('_landing_schema.json', ''), keyOrderOnly, notes };
}

const isBusiness = (n) => types(n).some((t) => t === 'LocalBusiness' || t === 'Organization');
/** Business nodes still carrying aggregateRating / review in the new output (must be 0, P23). */
function businessRatingFiles(all) {
  return all.filter((f) => (JSON.parse(fs.readFileSync(path.join(OUT, 'alanranger-schema', f), 'utf8'))['@graph'] || [])
    .some((n) => isBusiness(n) && (n.aggregateRating || n.review))).map((f) => f.replace('_landing_schema.json', ''));
}

const allNew = fs.readdirSync(path.join(OUT, 'alanranger-schema')).filter((f) => f.endsWith('_landing_schema.json'));
const files = allNew.filter((f) => fs.existsSync(path.join(REPO, f)));
const rows = files.map(explain);
const unexplained = rows.filter((r) => (!r.keyOrderOnly && !r.notes.length) || r.notes.some((n) => n.startsWith('UNEXPECTED'))).map((r) => r.file);
const businessRating = businessRatingFiles(allNew);
const summary = { files: rows.length, landingFilesGenerated: allNew.length, keyOrderOrIdentical: rows.filter((r) => r.keyOrderOnly).length,
  unexplained, businessRatingFiles: businessRating, rows };
if (jsonArg > 0) fs.writeFileSync(process.argv[jsonArg + 1], JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ files: summary.files, landingFilesGenerated: allNew.length, keyOrderOrIdentical: summary.keyOrderOrIdentical, unexplained, businessRatingFiles: businessRating }, null, 1));
for (const r of rows) if (r.notes.length) console.log(`${r.file}: ${r.notes.join(' | ')}`);
