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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHARED = path.resolve(HERE, '..', '..', 'alan-shared-resources');
const PROC = path.join(SHARED, 'csv processed');
const REPORTS = path.join(SHARED, 'outputs', 'reports');
const ENV_FILE = path.resolve(HERE, '..', '..', 'Chat AI Bot', '.env.local');
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

async function main() {
  const cacheArg = process.argv.indexOf('--bookings');
  const raw = cacheArg > 0 ? JSON.parse(fs.readFileSync(process.argv[cacheArg + 1], 'utf8')) : await fetchBookings();
  const bookings = bookingRows(raw);
  const google = readCsv(path.join(PROC, '03b_google_matched.csv')).filter((r) => String(r.review || '').trim());
  const decisions = new Map(readCsv(path.join(PROC, '15-review-attribution-overrides.csv'))
    .filter((o) => o.source === 'Google' && ['product', 'business_level'].includes(o.scope))
    .map((o) => [key(o.reviewer_name, o.review_date), o]));
  const results = google.map((r) => {
    const s = scoreReview({ reviewer: r.reviewer, date: r.date_parsed || r.date, review: r.review }, bookings);
    const decision = decisions.get(key(r.reviewer, r.date_parsed || r.date));
    return { reviewer: r.reviewer, date: String(r.date_parsed || r.date).slice(0, 10), current: r.product_slug, attribution_source: r.attribution_source,
      shadow_slug: s.slug, score: s.score, action: actionFor(s.score), why: s.why,
      alan_decision: decision ? (decision.scope === 'business_level' ? '(business level)' : decision.product_slug) : '',
      alan_note: decision?.notes || '', backtest: decision ? backtestVerdict(s, decision) : '' };
  });
  const decided = results.filter((r) => r.backtest);
  const tally = decided.reduce((m, r) => ({ ...m, [r.backtest]: (m[r.backtest] || 0) + 1 }), {});
  const provenance = (note) => String(note).split(/[;_]20\d\d/)[0].trim() || 'unspecified';
  const byProvenance = decided.reduce((m, r) => {
    const p = provenance(r.alan_note);
    m[p] = m[p] || {};
    m[p][r.backtest] = (m[p][r.backtest] || 0) + 1;
    return m;
  }, {});
  const summary = { generatedAt: new Date().toISOString(), mode: 'shadow (report only)', thresholds: { auto: AUTO, suggest: SUGGEST },
    reviews_scored: results.length, actions: results.reduce((m, r) => ({ ...m, [r.action]: (m[r.action] || 0) + 1 }), {}),
    backtest: { decisions_found: decided.length, decisions_in_overrides: decisions.size, ...tally, by_decision_source: byProvenance } };
  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, 'shadow-review-matcher-LATEST.json'), JSON.stringify({ summary, results }, null, 2));
  const cols = Object.keys(results[0]);
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  fs.writeFileSync(path.join(REPORTS, 'shadow-review-matcher-LATEST.csv'), `${[cols.join(','), ...results.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && process.argv[1].endsWith('shadow-review-matcher.mjs')) await main();
