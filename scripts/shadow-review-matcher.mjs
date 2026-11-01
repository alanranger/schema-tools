#!/usr/bin/env node
/**
 * SHADOW Google review matcher (report only). Order: booking sheet -> place/workshop aliases ->
 * service words -> hold. Never writes attributions, overrides, the frozen file, the DB or schema.
 *
 * Reads : csv processed/03b_google_matched.csv, csv processed/15-review-attribution-overrides.csv,
 *         Supabase booking_sheet_* tables (GET only, key from Chat AI Bot/.env.local)
 * Writes: outputs/reports/shadow-review-matcher-LATEST.json (+ .csv)
 * Usage : node scripts/shadow-review-matcher.mjs [--bookings <cached.json>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLACES, SERVICES, match, nameMatches } from './lib/review-matcher-rules.mjs';
import { WEB_ROOT, loadOrders, orderEvidence, slugIndex } from './lib/squarespace-orders.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHARED = path.resolve(HERE, '..', '..', 'alan-shared-resources');
const PROC = path.join(SHARED, 'csv processed');
const REPORTS = path.join(SHARED, 'outputs', 'reports');
/** Absolute (not relative to this file): the runner runs a copy of scripts/ inside its sandbox. */
const ENV_FILE = path.join(WEB_ROOT, 'Chat AI Bot', '.env.local');
export const AUTO = 0.85;
export const SUGGEST = 0.6;
const WINDOW_DAYS = { workshop: 120, course: 150, txn: 365 };

function parseCsv(text) {
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i += 1; } else if (c === '"') q = false; else f += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k.replace(/^\uFEFF/, ''), r[i] ?? ''])));
}
const readCsv = (file) => parseCsv(fs.readFileSync(file, 'utf8'));

async function fetchBookings() {
  const env = Object.fromEntries(fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]));
  const get = async (table, select) => {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?select=${select}`, { method: 'GET',
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, Range: `${from}-${from + 999}` } });
      const page = await res.json();
      out.push(...page);
      if (page.length < 1000) return out;
    }
  };
  return {
    workshop: await get('booking_sheet_workshop_attendees', 'event_start,theme_location,client_name'),
    course: await get('booking_sheet_course_attendees', 'from_date,event_name,client_name,first_name,last_name'),
    txn: await get('booking_sheet_transactions', 'txn_date,client_name,canonical_product,event_label')
  };
}

function bookingRows(raw) {
  const rows = [
    ...raw.workshop.map((b) => ({ client: b.client_name, date: b.event_start, label: b.theme_location, kind: 'workshop' })),
    ...raw.course.map((b) => ({ client: b.client_name || `${b.first_name} ${b.last_name}`, date: b.from_date,
      label: /lightroom/i.test(b.event_name) ? 'lightroom' : `${b.event_name} beginners course`, kind: 'course' })),
    ...raw.txn.map((b) => ({ client: b.client_name, date: b.txn_date, label: `${b.canonical_product || ''} ${b.event_label || ''}`, kind: 'txn' }))
  ];
  return rows.filter((b) => b.client && /^\d{4}-\d\d-\d\d/.test(String(b.date || '')) && !NOT_EVIDENCE.test(b.label));
}

/** Transactions that say nothing about what was reviewed (memberships, plans, vouchers). */
const NOT_EVIDENCE = /academy - membership|mentoring - monthly subscription|voucher|pick n mix|royalt|commission -|print sale/i;

/** Same-family products (a disagreement inside a family is reported separately). */
const FAMILIES = [
  ['landscape-peak-district-photography-workshops-derbyshire', 'peak-district-heather-photography-workshop'],
  ['four-private-photography-classes', 'private-online-photography-classes-zoom'],
  ['rps-mentoring-photography-course', 'photography-mentoring-online-assignments']
];
const sameFamily = (a, b) => FAMILIES.some((f) => f.includes(a) && f.includes(b));

function bookingEvidence(review, bookings) {
  const t = Date.parse(review.date);
  if (Number.isNaN(t)) return null;
  const hits = bookings.filter((b) => {
    const days = (t - Date.parse(String(b.date).slice(0, 10))) / 86400000;
    return days >= -3 && days <= WINDOW_DAYS[b.kind] && nameMatches(review.reviewer, b.client);
  });
  if (!hits.length) return null;
  const slugs = [...new Set(hits.flatMap((h) => [...match(PLACES, h.label.toLowerCase()), ...match(SERVICES, h.label.toLowerCase())]))];
  return { slugs, labels: [...new Set(hits.map((h) => `${String(h.date).slice(0, 10)} ${h.client}: ${h.label.trim()}`))].slice(0, 3) };
}

/** One booked product: 0.97 when the text agrees, 0.90 when the text is silent, hold when the text names another product. */
function bookingScore(booking, places, services) {
  const [slug] = booking.slugs;
  const named = [...places, ...services];
  if (named.includes(slug)) return { slug, score: 0.97, why: `booking: ${booking.labels[0]} (text agrees)` };
  if (!named.length) return { slug, score: 0.9, why: `booking: ${booking.labels[0]}` };
  return { slug, score: 0.55, why: `booking (${booking.labels[0]}) and text (${named.join(', ')}) disagree` };
}

/** Score one review. Returns { slug, score, why }. */
export function scoreReview(review, bookings) {
  const text = String(review.review || '').toLowerCase();
  const places = match(PLACES, text);
  const services = match(SERVICES, text);
  const booking = bookingEvidence(review, bookings);
  if (booking && booking.slugs.length === 1) return bookingScore(booking, places, services);
  if (places.length === 1) return { slug: places[0], score: 0.8, why: `place/workshop alias: ${places[0]}` };
  if (places.length > 1) return { slug: places[0], score: 0.55, why: `several places named: ${places.join(', ')}` };
  if (services.length === 1) return { slug: services[0], score: 0.7, why: `service words: ${services[0]}` };
  if (services.length > 1) return { slug: services[0], score: 0.55, why: `several services named: ${services.join(', ')}` };
  const note = booking ? `booking ambiguous: ${booking.labels.join(' | ')}` : 'no booking, place or service words';
  return { slug: '', score: 0, why: note };
}

export const actionFor = (score) => (score >= AUTO ? 'auto-assign' : score >= SUGGEST ? 'suggest' : 'hold');

/** The review names one product the order is not for: a transfer only counts if the booking sheet or order notes show it. */
function conflictScore(order, named, attended, noted) {
  const x = named.length === 1 ? named[0] : '';
  const via = attended === x ? 'booking sheet' : (noted.includes(x) ? 'order notes' : '');
  if (x && via) return { slug: x, score: 0.95, why: `transfer: order #${order.orders[0]} bought ${order.slugs[0]}; ${via} shows ${x} attended (text agrees)`, transfer: via };
  return { slug: x, score: 0.5, why: `hold: text names ${named.join(', ')}, order #${order.orders[0]} is for ${order.slugs[0]}; no transfer found` };
}

/**
 * Alan's evidence order: (1) what the review text is about, (2) where they actually went (booking sheet, order notes),
 * (3) the order's product, (4) place/service rules, (5) hold. The order never overrides what the review is about.
 */
function withoutOrder(review, bookings, order) {
  const base = scoreReview(review, bookings);
  const later = order?.eventAfterReview || [];
  return later.length ? { ...base, why: `${base.why}; order event after the review set aside: ${later.join(', ')}` } : base;
}

/** Several products ordered: only the one the text names counts; otherwise the order says nothing. */
function multiOrder(review, bookings, order, named) {
  const pick = named.length === 1 && order.slugs.includes(named[0]) ? named[0] : '';
  return pick ? { slug: pick, score: 0.95, why: `order #${order.orders.join(', #')} (text picks ${pick})` } : scoreReview(review, bookings);
}

const namedIn = (text) => [...match(PLACES, text.toLowerCase()), ...match(SERVICES, text.toLowerCase())];

export function scoreReviewWithOrders(review, bookings, orders, homes = null) {
  const order = orderEvidence(review, orders, homes);
  if (!order?.slugs.length) return withoutOrder(review, bookings, order);
  const named = namedIn(String(review.review || ''));
  if (order.slugs.length > 1) return multiOrder(review, bookings, order, named);
  const booking = bookingEvidence(review, bookings);
  const attended = booking?.slugs.length === 1 ? booking.slugs[0] : '';
  const noted = order.notes.flatMap(namedIn);
  const [slug] = order.slugs;
  if (named.length && !named.includes(slug)) return conflictScore(order, named, attended, noted);
  if (attended && attended !== slug) return { slug: attended, score: 0.9, why: `transfer: order #${order.orders[0]} bought ${slug}; booking sheet shows ${attended} attended`, transfer: 'booking sheet' };
  if (named.includes(slug)) return { slug, score: 0.97, why: `order #${order.orders[0]}: ${slug} (text agrees)` };
  if (attended === slug) return { slug, score: 0.97, why: `order #${order.orders[0]}: ${slug} (booking sheet agrees)` };
  if (order.undated) return { slug, score: 0.55, why: `hold: order #${order.orders[0]} (${slug}) has no event date to check against the review` };
  return { slug, score: 0.88, why: `order #${order.orders[0]}: ${slug} (event date fits the review date)` };
}

const key = (name, date) => `${String(name).trim().toLowerCase()}|${String(date).slice(0, 10)}`;

/** Compare a shadow result with Alan's decision (override row). */
function backtestVerdict(result, decision) {
  const expected = decision.scope === 'business_level' ? '' : decision.product_slug;
  const action = actionFor(result.score);
  if (action === 'hold') return expected ? 'held (Alan decided a product)' : 'agrees (held; Alan chose business level)';
  if (result.slug === expected) return 'agrees';
  if (!expected) return 'disagrees (Alan chose business level)';
  return sameFamily(result.slug, expected) ? 'disagrees (same family)' : 'disagrees';
}

/** agree / held / disagree, from the detailed verdict. */
export const bucket = (verdict) => (verdict.startsWith('agrees') ? 'agree' : verdict.startsWith('held') ? 'held' : 'disagree');
const firstName = (name) => String(name || '').trim().split(/\s+/)[0];
const tallyOf = (rows, k) => rows.reduce((m, r) => ({ ...m, [bucket(r[k])]: (m[bucket(r[k])] || 0) + 1 }), { agree: 0, held: 0, disagree: 0 });

/** Alan's decisions: the overrides file (product / business level) + his 31 Oct "keep" decisions (not in overrides). */
function loadDecisions() {
  const rows = readCsv(path.join(PROC, '15-review-attribution-overrides.csv')).filter((o) => o.source === 'Google' && ['product', 'business_level'].includes(o.scope));
  const keeps = JSON.parse(fs.readFileSync(path.join(HERE, 'review-matcher-alan-2026-10-31-keeps.json'), 'utf8'))
    .map((k) => ({ reviewer_name: k.reviewer, review_date: k.date, scope: 'product', product_slug: k.product_slug, notes: 'alan_confirmed_2026-10-31_keep' }));
  return new Map([...rows, ...keeps].map((o) => [key(o.reviewer_name, o.review_date), o]));
}

async function loadEvidence() {
  const cacheArg = process.argv.indexOf('--bookings');
  const raw = cacheArg > 0 ? JSON.parse(fs.readFileSync(process.argv[cacheArg + 1], 'utf8')) : await fetchBookings();
  const slugById = slugIndex(readCsv(path.join(SHARED, 'csv', 'raw-01-products-sqsp-export.csv')));
  const orders = await loadOrders({ slugById }).catch((e) => ({ orders: [], error: String(e.message || e) }));
  const homes = new Set(readCsv(path.join(PROC, '03 – combined_product_reviews.csv')).map((r) => r.product_slug).filter(Boolean));
  return { bookings: bookingRows(raw), orders, homes, ids: reviewIds() };
}

/** product_reviews ids (the runner's DB snapshot) so reports can name a review by id, not by person. */
function reviewIds() {
  const file = path.join(PROC, 'product-reviews-db-snapshot.csv');
  if (!fs.existsSync(file)) return new Map();
  return new Map(readCsv(file).filter((r) => r.source === 'Google').map((r) => [key(r.reviewer_name, r.review_date), r.id]));
}

function scoreRow(r, ev, decisions) {
  const review = { reviewer: r.reviewer, date: r.date_parsed || r.date, review: r.review };
  const s = scoreReview(review, ev.bookings);
  const o = scoreReviewWithOrders(review, ev.bookings, ev.orders.orders, ev.homes);
  const decision = decisions.get(key(r.reviewer, review.date));
  return { review_id: r.reference_id || ev.ids?.get(key(r.reviewer, review.date)) || '', reviewer: r.reviewer, date: String(review.date).slice(0, 10), current: r.product_slug, attribution_source: r.attribution_source,
    shadow_slug: s.slug, score: s.score, action: actionFor(s.score), why: s.why,
    orders_slug: o.slug, orders_score: o.score, orders_action: actionFor(o.score), orders_why: o.why, transfer: o.transfer || '',
    alan_decision: decision ? (decision.scope === 'business_level' ? '(business level)' : decision.product_slug) : '',
    alan_note: decision?.notes || '', backtest: decision ? backtestVerdict(s, decision) : '', backtest_orders: decision ? backtestVerdict(o, decision) : '' };
}

/** Back-test before vs after adding orders; disagreements by review id + first name; transfer cases. No personal data. */
function backtestSummary(results, decisions) {
  const decided = results.filter((r) => r.backtest);
  const changed = decided.filter((r) => bucket(r.backtest) !== bucket(r.backtest_orders));
  const view = (r, k, slug) => ({ review_id: r.review_id, first_name: firstName(r.reviewer), date: r.date, matcher: r[slug] || '(hold)', alan: r.alan_decision, verdict: bucket(r[k]) });
  return { decisions: decided.length, decisions_available: decisions.size, before: tallyOf(decided, 'backtest'), after: tallyOf(decided, 'backtest_orders'),
    changed_by_orders: changed.map((r) => ({ ...view(r, 'backtest_orders', 'orders_slug'), before: bucket(r.backtest), why: r.orders_why })),
    disagreements_before: decided.filter((r) => bucket(r.backtest) === 'disagree').map((r) => view(r, 'backtest', 'shadow_slug')),
    disagreements_after: decided.filter((r) => bucket(r.backtest_orders) === 'disagree').map((r) => view(r, 'backtest_orders', 'orders_slug')),
    transfer_cases: results.filter((r) => r.transfer).map((r) => ({ review_id: r.review_id, first_name: firstName(r.reviewer), date: r.date, found_in: r.transfer, why: r.orders_why })) };
}

const REPORT_COLS = ['review_id', 'reviewer', 'date', 'current', 'shadow_slug', 'score', 'action', 'why', 'orders_slug', 'orders_score', 'orders_action', 'orders_why', 'transfer', 'alan_decision', 'backtest', 'backtest_orders'];

async function main() {
  const ev = await loadEvidence();
  const decisions = loadDecisions();
  const google = readCsv(path.join(PROC, '03b_google_matched.csv')).filter((r) => String(r.review || '').trim());
  const results = google.map((r) => scoreRow(r, ev, decisions));
  const summary = { generatedAt: new Date().toISOString(), mode: 'shadow (report only)', thresholds: { auto: AUTO, suggest: SUGGEST },
    reviews_scored: results.length, orders_loaded: ev.orders.orders.length, orders_error: ev.orders.error || null,
    actions: results.reduce((m, r) => ({ ...m, [r.action]: (m[r.action] || 0) + 1 }), {}),
    actions_with_orders: results.reduce((m, r) => ({ ...m, [r.orders_action]: (m[r.orders_action] || 0) + 1 }), {}),
    backtest: backtestSummary(results, decisions) };
  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, 'shadow-review-matcher-LATEST.json'), JSON.stringify({ summary, results: results.map((r) => Object.fromEntries(REPORT_COLS.map((c) => [c, r[c]]))) }, null, 2));
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  fs.writeFileSync(path.join(REPORTS, 'shadow-review-matcher-LATEST.csv'), `${[REPORT_COLS.join(','), ...results.map((r) => REPORT_COLS.map((c) => esc(r[c])).join(','))].join('\n')}\n`);
  const { changed_by_orders: c, disagreements_before: db, disagreements_after: da, transfer_cases: t, ...short } = summary.backtest;
  console.log(JSON.stringify({ ...summary, backtest: { ...short, changed_by_orders: c.length, disagreements_after: da.length, transfer_cases: t.length } }, null, 2));
}

if (process.argv[1] && process.argv[1].endsWith('shadow-review-matcher.mjs')) await main();
