// Review cards in the product page loader: under 3 stars wait for "Show all" and sort last; owner reply shown.
// Run: npm run test:product-review-cards
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ASSET = path.join(here, 'assets', 'product-page-loader.js');
const HOSTED = path.join(here, '..', 'alanranger-schema', 'loaders', 'product-page-loader.js');

function loadBlock() {
  const src = fs.readFileSync(ASSET, 'utf8');
  const m = src.match(/\/\* ar-review-cards:start[\s\S]*?\/\* ar-review-cards:end \*\//);
  assert.ok(m, 'ar-review-cards block markers missing');
  const ctx = {};
  vm.runInNewContext(`${m[0]}\nthis.api = { arReviewCardSets, arReviewReplyHtml, arReviewStarValue };`, ctx);
  return ctx.api;
}

const rv = (name, stars, reply) => ({
  author: { name },
  reviewRating: stars == null ? undefined : { ratingValue: String(stars) },
  ...(reply ? { comment: { '@type': 'Comment', text: reply } } : {}),
});
const names = (list) => Array.from(list, (r) => r.author.name);

test('hosted loader and generator asset are identical', () => {
  if (!fs.existsSync(HOSTED)) return;
  assert.equal(fs.readFileSync(HOSTED, 'utf8'), fs.readFileSync(ASSET, 'utf8'));
});

test('Norfolk: 1-star is not on load and sorts last after Show all', () => {
  const { arReviewCardSets } = loadBlock();
  const revs = [rv('Peter', 4), rv('Harriet', 5), rv('James', 5), rv('Andy', 5), rv('GT', 1, 'Sorry GT')];
  const sets = arReviewCardSets(revs, 4);
  assert.deepEqual(names(sets.initial), ['Peter', 'Harriet', 'James', 'Andy']);
  assert.deepEqual(names(sets.all), ['Peter', 'Harriet', 'James', 'Andy', 'GT']);
});

test('low review among the newest is held back; the next high review fills the slot', () => {
  const { arReviewCardSets } = loadBlock();
  const revs = [rv('A', 5), rv('Low', 2), rv('B', 5), rv('C', 4), rv('D', 5), rv('E', 5)];
  const sets = arReviewCardSets(revs, 4);
  assert.deepEqual(names(sets.initial), ['A', 'B', 'C', 'D']);
  assert.deepEqual(names(sets.all), ['A', 'B', 'C', 'D', 'E', 'Low']);
});

test('Urban Architecture: two 2-star reviews move to the end, order otherwise kept', () => {
  const { arReviewCardSets } = loadBlock();
  const stars = [5, 5, 5, 5, 5, 5, 5, 4, 5, 2, 2, 5];
  const revs = stars.map((s, i) => rv(`R${i + 1}`, s));
  const sets = arReviewCardSets(revs, 4);
  assert.equal(sets.all.length, 12);
  assert.deepEqual(names(sets.all).slice(-2), ['R10', 'R11']);
  assert.ok(sets.initial.every((r) => Number(r.reviewRating.ratingValue) >= 3));
});

test('3 stars stays default-visible; missing rating counts as 5 like the card stars', () => {
  const { arReviewCardSets, arReviewStarValue } = loadBlock();
  const sets = arReviewCardSets([rv('Three', 3), rv('NoRating', null)], 4);
  assert.deepEqual(names(sets.initial), ['Three', 'NoRating']);
  assert.equal(arReviewStarValue(rv('x', null)), 5);
});

test('no low reviews: cards identical to before (first N, same order)', () => {
  const { arReviewCardSets } = loadBlock();
  const revs = [5, 5, 4, 5, 5, 5, 5].map((s, i) => rv(`S${i}`, s));
  const sets = arReviewCardSets(revs, 4);
  assert.deepEqual(names(sets.initial), names(revs.slice(0, 4)));
  assert.deepEqual(names(sets.all), names(revs));
  assert.ok(sets.all.every((r, i) => r === revs[i]));
});

test('reply renders as "Reply from Alan", escaped; none when no comment', () => {
  const { arReviewReplyHtml } = loadBlock();
  const html = arReviewReplyHtml(rv('GT', 1, 'Thanks <b>GT</b> & "sorry"'));
  assert.match(html, /Reply from Alan/);
  assert.match(html, /Thanks &lt;b&gt;GT&lt;\/b&gt; &amp; &quot;sorry&quot;/);
  assert.equal(arReviewReplyHtml(rv('A', 5)), '');
  assert.equal(arReviewReplyHtml({ comment: { text: '   ' } }), '');
});
