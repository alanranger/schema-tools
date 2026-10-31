#!/usr/bin/env node
/**
 * Business aggregateRating + review[] for landing pages, rebuilt every run from Supabase product_reviews
 * (non-excluded rows only), computed the way products get theirs in generate-product-schema.py:
 * ratingValue = mean of all rated reviews (2 dp, string), reviewCount = all rated reviews, review[] = 25 newest with text.
 *   node scripts/build-business-rating.mjs [--out <file>]
 * Default output: alan-shared-resources/outputs/schema/business-rating-LATEST.json (read by the landing generator).
 * Reads the service key from Chat AI Bot/.env.local; GET only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.resolve(ROOT, '..');
const ENV_FILE = path.join(WEB, 'Chat AI Bot', '.env.local');
const DEFAULT_OUT = path.join(WEB, 'alan-shared-resources', 'outputs', 'schema', 'business-rating-LATEST.json');
const REVIEW_CAP = 25;

function env() {
  const text = fs.readFileSync(ENV_FILE, 'utf8');
  const get = (k) => (text.match(new RegExp(`^${k}=(.+)$`, 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
  return { url: get('SUPABASE_URL'), key: get('SUPABASE_SERVICE_ROLE_KEY') };
}

async function loadReviews({ url, key }) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${url}/rest/v1/product_reviews?select=reviewer_name,review_date,rating,quote,source&is_excluded=eq.false&order=id.asc&limit=1000&offset=${offset}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`product_reviews -> ${res.status}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

export function businessRating(rows) {
  const rated = rows.filter((r) => Number.isFinite(Number(r.rating)) && r.rating !== null);
  if (!rated.length) return null;
  const mean = rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length;
  const review = rated
    .filter((r) => String(r.quote || '').trim())
    .sort((a, b) => String(b.review_date || '').localeCompare(String(a.review_date || '')))
    .slice(0, REVIEW_CAP)
    .map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.reviewer_name },
      publisher: { '@type': 'Organization', name: r.source },
      reviewBody: String(r.quote).trim(),
      reviewRating: { '@type': 'Rating', bestRating: '5', ratingValue: String(r.rating), worstRating: '1' },
      ...(r.review_date ? { datePublished: r.review_date } : {})
    }));
  return {
    aggregateRating: { '@type': 'AggregateRating', ratingValue: String(Math.round(mean * 100) / 100), reviewCount: rated.length, bestRating: '5', worstRating: '1' },
    review
  };
}

async function main() {
  const i = process.argv.indexOf('--out');
  const out = path.resolve(i > 0 ? process.argv[i + 1] : DEFAULT_OUT);
  const rating = businessRating(await loadReviews(env()));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify({ generatedAt: new Date().toISOString(), source: 'product_reviews (is_excluded = false)', ...rating }, null, 2)}\n`);
  console.log(JSON.stringify({ out, reviewCount: rating?.aggregateRating.reviewCount, ratingValue: rating?.aggregateRating.ratingValue, reviews: rating?.review.length }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
