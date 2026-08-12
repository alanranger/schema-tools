#!/usr/bin/env node
/**
 * One-pass repair of published alanranger-schema files after the 2026-08-12 full run.
 * Fixes HowTo CSS bleed, http image URLs, event date glue, known bad descriptions,
 * Lee Filters binary body, and stale event leftovers not in events-manifest.json.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, '..', 'alanranger-schema');

const MANUAL_DESCRIPTIONS = {
  'how-to-take-real-estate-photos':
    'This guide explains how to take real estate photos in a practical UK context, whether you are photographing a home for sale, a rental, or a holiday let.',
  'landscape-photography-guide':
    'A one-page field checklist for landscape photography covering light, composition, and camera settings.',
  'midlands-photography-workshops-with-alan-ranger':
    "If you're passionate about photography and eager to capture the Midlands' allure, our Midlands photography workshops with Alan Ranger are the ideal match.",
  'lee-filter-15-percent-off':
    'Lee Filters 15 percent off for Alan Ranger Photography clients. A client deal on quality landscape filters.'
};

const STALE_EVENT_SLUGS = [
  'camera-courses-for-beginners-coventry-2n74k',
  'camera-courses-for-beginners-coventry-be4sb',
  'camera-courses-for-beginners-coventry-dg9pz',
  'camera-courses-for-beginners-coventry-nhjlm',
  'camera-courses-for-beginners-coventry-wk1',
  'camera-courses-for-beginners-coventry-',
  'long-exposure-photography-burnham-on-sea',
  'secrets-of-woodland-photography-masterclass-summer',
  'sezincote-garden-photography-workshop'
];

function isJunk(text) {
  if (!text) return true;
  const s = String(text);
  let ctrl = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) ctrl++;
    if (ctrl > 3) return true;
  }
  return /wf-loading|document\.documentElement|@keyframes|fonts-loading|classList\.add/i.test(s);
}

function withStop(text) {
  const d = String(text || '').replace(/\s+/g, ' ').trim();
  if (!d) return d;
  return /[.!?]$/.test(d) ? d : `${d}.`;
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function siblingDescription(slug) {
  for (const suffix of ['_schema.json', '_blogposting.json']) {
    const p = path.join(repo, `${slug}${suffix}`);
    if (!fs.existsSync(p)) continue;
    try {
      const d = String(readJson(p).description || '').trim();
      if (d && !isJunk(d)) return withStop(d);
    } catch {
      /* ignore */
    }
  }
  return '';
}

const stats = {
  howto: 0,
  images: 0,
  events: 0,
  manuals: 0,
  staleDeleted: 0
};

for (const name of fs.readdirSync(repo)) {
  if (!name.endsWith('_howto.json')) continue;
  const filePath = path.join(repo, name);
  const doc = readJson(filePath);
  if (!isJunk(doc.description)) continue;
  const slug = name.slice(0, -'_howto.json'.length);
  doc.description = siblingDescription(slug) || withStop(doc.name || slug.replace(/-/g, ' '));
  writeJson(filePath, doc);
  stats.howto += 1;
}

for (const name of fs.readdirSync(repo)) {
  if (!name.endsWith('_image.json')) continue;
  const filePath = path.join(repo, name);
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.includes('"url": "http://')) continue;
  const doc = JSON.parse(raw);
  if (typeof doc.url === 'string') doc.url = doc.url.replace(/^http:\/\//i, 'https://');
  writeJson(filePath, doc);
  stats.images += 1;
}

for (const name of fs.readdirSync(repo)) {
  if (!name.endsWith('_event_schema.json')) continue;
  const filePath = path.join(repo, name);
  const doc = readJson(filePath);
  const graph = Array.isArray(doc['@graph']) ? doc['@graph'] : [doc];
  let changed = false;
  for (const node of graph) {
    if (!node || typeof node !== 'object') continue;
    if (typeof node.description === 'string') {
      const next = node.description
        .replace(/(\d{1,2}\/\d{1,2}\/\d{4})([A-Za-z])/g, '$1 $2')
        .replace(/(\d{4}-\d{2}-\d{2})([A-Za-z])/g, '$1 $2');
      if (next !== node.description) {
        node.description = next;
        changed = true;
      }
    }
    if (node.offers && node.offers.shippingDetails && node.offers.shippingDetails.doesNotShip === 'http://schema.org/True') {
      node.offers.shippingDetails.doesNotShip = true;
      changed = true;
    }
    if (typeof node.image === 'string' && node.image.startsWith('http://')) {
      node.image = node.image.replace(/^http:\/\//i, 'https://');
      changed = true;
    }
  }
  if (changed) {
    writeJson(filePath, doc);
    stats.events += 1;
  }
}

for (const [slug, description] of Object.entries(MANUAL_DESCRIPTIONS)) {
  for (const suffix of ['_schema.json', '_blogposting.json', '_howto.json']) {
    const filePath = path.join(repo, `${slug}${suffix}`);
    if (!fs.existsSync(filePath)) continue;
    const doc = readJson(filePath);
    if (doc.description === description) continue;
    doc.description = description;
    writeJson(filePath, doc);
    stats.manuals += 1;
  }
}

const leePath = path.join(repo, 'lee-filter-15-percent-off_blogposting.json');
if (fs.existsSync(leePath)) {
  const lee = readJson(leePath);
  lee.description = MANUAL_DESCRIPTIONS['lee-filter-15-percent-off'];
  lee.articleBody =
    'Lee Filters 15 percent off for Alan Ranger Photography clients. Grab the deal on quality landscape filters.';
  lee.wordCount = 18;
  writeJson(leePath, lee);
}

for (const slug of STALE_EVENT_SLUGS) {
  for (const suffix of ['_event_schema.json', '_event_faq.json']) {
    const filePath = path.join(repo, `${slug}${suffix}`);
    if (!fs.existsSync(filePath)) continue;
    fs.unlinkSync(filePath);
    stats.staleDeleted += 1;
  }
}

console.log(JSON.stringify(stats, null, 2));
