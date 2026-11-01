/**
 * Squarespace Commerce Orders as review-matcher evidence (P12). GET only — the key can write; never use that.
 * Orders are cached on this PC outside Drive/Dropbox (%LOCALAPPDATA%\AlanReviewMatcher\orders-cache.json), keeping
 * only what matching needs: order number, dates, names, the email LOCAL PART, products, variant text and notes.
 * No full email, address or phone is stored, and nothing personal is written to reports.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ORDER_HOMES, nameMatches } from './review-matcher-rules.mjs';

export const CACHE = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'AlanReviewMatcher', 'orders-cache.json');
const API = 'https://api.squarespace.com/1.0/commerce/orders';
const GAP_MS = 1500;
/** Absolute: the runner copies scripts/ into a sandbox, so a path relative to this file would not find the key. */
export const WEB_ROOT = process.env.ALAN_WEB_ROOT || 'G:/Dropbox/alan ranger photography/Website Code';
const KEY_FILE = path.join(WEB_ROOT, 'AI GEO Audit', '.env.local');

const field = (form, re) => (form || []).find((f) => re.test(f.label || ''))?.value || '';
const NOT_PRODUCT = /voucher|gift card|subscription|pick n mix|membership/i;

/** The minimum kept per order (personal data stays inside matching). */
export function minimalOrder(o, slugById = new Map()) {
  const form = o.formSubmission || [];
  const names = [`${o.billingAddress?.firstName || ''} ${o.billingAddress?.lastName || ''}`, `${field(form, /^first name/i)} ${field(form, /^surname|^last name/i)}`]
    .map((n) => n.trim()).filter(Boolean);
  return { orderNumber: o.orderNumber, createdOn: o.createdOn, names: [...new Set(names)],
    emailLocal: String(o.customerEmail || field(form, /^email/i)).split('@')[0].toLowerCase(),
    items: (o.lineItems || []).map((li) => ({ productId: li.productId, productName: li.productName, slug: slugById.get(li.productId) || '',
      variant: (li.variantOptions || []).map((v) => v.value).join(' ') })),
    notes: [...(o.internalNotes || []).map((n) => n.content || ''), field(form, /notes/i)].filter(Boolean) };
}

function apiKey(file = KEY_FILE) {
  const m = fs.readFileSync(file, 'utf8').match(/^SQUARESPACE_API_KEY_CURSOR=(.+)$/m);
  if (!m) throw new Error('SQUARESPACE_API_KEY_CURSOR missing');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

async function getPage(url, key) {
  const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'AlanRanger-ReviewMatcher/1.0' } });
  if (!res.ok) throw new Error(`orders API ${res.status}`);
  return res.json();
}

/** All orders (first run) or those modified since the last fetch, paced, merged into the cache. */
export async function loadOrders({ slugById = new Map(), cacheFile = CACHE, key } = {}) {
  const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : { fetchedAt: null, orders: {} };
  const k = key || apiKey();
  const now = new Date().toISOString();
  let url = cache.fetchedAt ? `${API}?modifiedAfter=${encodeURIComponent(cache.fetchedAt)}&modifiedBefore=${encodeURIComponent(now)}` : API;
  let pages = 0;
  while (url) {
    if (pages) await new Promise((r) => setTimeout(r, GAP_MS));
    const page = await getPage(url, k);
    for (const o of page.result || []) cache.orders[o.id] = minimalOrder(o, slugById);
    pages += 1;
    url = page.pagination?.hasNextPage ? `${API}?cursor=${encodeURIComponent(page.pagination.nextPageCursor)}` : null;
  }
  for (const o of Object.values(cache.orders)) o.items.forEach((i) => { if (!i.slug) i.slug = slugById.get(i.productId) || ''; });
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify({ fetchedAt: now, orders: cache.orders }));
  return { orders: Object.values(cache.orders), pages };
}

const compact = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '');
/** Email local part ≈ reviewer name: "sofia.gza" ≈ "Sofiagzagdo"; needs 5+ letters on the shorter side. */
export function emailMatches(reviewer, local) {
  const r = compact(reviewer); const l = compact(local);
  if (l.length < 5 || r.length < 5) return false;
  return r.startsWith(l) || l.startsWith(r);
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const DAY = 86400000;
/**
 * Event date from variant text like "Sat 23 Oct 2027", "Fri 22 Jan - 24 Jan - 3 Days 2027" (first date) or "Wed 1st Mar"
 * (no year: the first such date on or after the order date), or null when the text has no date.
 */
export function variantDate(text, createdOn) {
  const m = String(text || '').toLowerCase().match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  if (!m) return null;
  const y = String(text || '').match(/\b(20\d\d)\b/);
  if (y) return Date.UTC(Number(y[1]), MONTHS[m[2]], Number(m[1]));
  const created = Date.parse(createdOn);
  if (Number.isNaN(created)) return null;
  const year = new Date(created).getUTCFullYear();
  const d = Date.UTC(year, MONTHS[m[2]], Number(m[1]));
  return d < created - DAY ? Date.UTC(year + 1, MONTHS[m[2]], Number(m[1])) : d;
}

/** A review is about an event from 3 days before it to 150 days after it; undated orders: placed within a year before the review. */
const EVENT_WINDOW = { before: 3 * DAY, after: 150 * DAY };
function timing(item, created, t) {
  const at = variantDate(item.variant, created);
  if (at === null) return t - Date.parse(created) <= 365 * DAY ? 'undated' : 'old';
  if (at > t + EVENT_WINDOW.before) return 'after';
  return t - at > EVENT_WINDOW.after ? 'old' : 'dated';
}

const isMine = (review, o) => o.names.some((n) => nameMatches(review.reviewer, n)) || emailMatches(review.reviewer, o.emailLocal);

/** The review home for an ordered product: itself, its ORDER_HOMES alias, or '' (a product with no reviews says nothing). */
const homeOf = (slug, homes) => (ORDER_HOMES[slug] || (!homes || homes.has(slug) ? slug : ''));

/**
 * Orders by this reviewer (billing name, attendee name, or email local part) placed before the review. An order whose
 * event is after the review, or more than 150 days before it, can't be what was reviewed: it is set aside.
 * homes: product slugs that carry reviews (others only count through ORDER_HOMES).
 */
export function orderEvidence(review, orders, homes = null) {
  const t = Date.parse(review.date);
  if (Number.isNaN(t)) return null;
  const items = orders.filter((o) => isMine(review, o) && Date.parse(o.createdOn) <= t + DAY)
    .flatMap((o) => o.items.filter((i) => i.slug && !NOT_PRODUCT.test(i.productName)).map((i) => ({ ...i, slug: homeOf(i.slug, homes), order: o.orderNumber, notes: o.notes, when: timing(i, o.createdOn, t) })))
    .filter((i) => i.slug);
  const usable = items.filter((i) => i.when === 'dated' || i.when === 'undated');
  const setAside = items.filter((i) => i.when === 'after');
  if (!usable.length && !setAside.length) return null;
  return { slugs: [...new Set(usable.map((i) => i.slug))], orders: [...new Set(usable.map((i) => i.order))], undated: usable.every((i) => i.when === 'undated'),
    notes: usable.flatMap((i) => i.notes), eventAfterReview: setAside.map((i) => `#${i.order} ${i.slug}`) };
}

/** productId → product slug from raw-01 (first row of each product carries the id). */
export function slugIndex(raw01Rows) {
  return new Map(raw01Rows.filter((r) => r['Product ID [Non Editable]']).map((r) => [r['Product ID [Non Editable]'], r['Product URL']]));
}
