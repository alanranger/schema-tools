/**
 * Regression fixtures for every on-site FAQ layout. Fail = bulk generation must refuse to start.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { countVisibleFaqQuestions, extractFAQFromArticle } from './faq-extraction.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(root, '..', 'test', 'fixtures', 'faq-layouts');

export const FAQ_LAYOUT_FIXTURES = [
  { slug: 'exposure-bracketing-a-guide-for-photographers', expectedVisible: 10, file: 'exposure-bracketing-a-guide-for-photographers.html' },
  { slug: 'photography-styles-trends-and-tips', expectedVisible: 15, file: 'photography-styles-trends-and-tips.html' },
  { slug: 'take-the-on-line-colour-test', expectedVisible: 5, file: 'take-the-on-line-colour-test.html' },
  { slug: 'uk-photography-editing-workflow-guide', expectedVisible: 8, file: 'uk-photography-editing-workflow-guide.html' },
  { slug: 'uk-sports-action-photography-guide', expectedVisible: 8, file: 'uk-sports-action-photography-guide.html' },
  { slug: 'etsy-product-photography-rules', expectedVisible: 8, file: 'etsy-product-photography-rules.html' },
  { slug: 'headshots-at-home-guide', expectedVisible: 8, file: 'headshots-at-home-guide.html' },
  { slug: 'what-is-exposure-in-photography', expectedVisible: 5, file: 'what-is-exposure-in-photography.html' },
  { slug: 'what-is-shutter-speed', expectedVisible: 4, file: 'what-is-shutter-speed.html' },
  { slug: 'what-is-iso-in-photography', expectedVisible: 6, file: 'what-is-iso-in-photography.html' },
  { slug: 'what-is-aperture-in-photography', expectedVisible: 4, file: 'what-is-aperture-in-photography.html' },
  { slug: 'case-study-mike-ford', expectedVisible: 0, file: 'case-study-mike-ford.html' }
];

export function loadFaqLayoutManifest() {
  return FAQ_LAYOUT_FIXTURES;
}

export function assertFaqLayoutFixtures() {
  const manifest = loadFaqLayoutManifest();
  if (!Array.isArray(manifest) || manifest.length < 12) {
    throw new Error(`FAQ layout manifest too small (${manifest?.length ?? 0}); need 12+ fixtures`);
  }
  for (const row of manifest) {
    const html = readFileSync(join(fixtureDir, row.file), 'utf8');
    const visible = countVisibleFaqQuestions(html);
    const extracted = extractFAQFromArticle(html, '', null);
    assert.equal(
      visible,
      row.expectedVisible,
      `${row.slug} visible count ${visible} !== ${row.expectedVisible}`
    );
    if (row.expectedVisible === 0) {
      assert.equal(extracted.pairs.length, 0, `${row.slug} expected no FAQ pairs`);
      assert.notEqual(extracted.strategy, 'visible-faq-failed', `${row.slug} false visible-fail`);
      continue;
    }
    assert.equal(
      extracted.pairs.length,
      row.expectedVisible,
      `${row.slug} extracted ${extracted.pairs.length} !== ${row.expectedVisible} (${extracted.strategy})`
    );
    assert.equal(extracted.keepExisting, undefined, `${row.slug} must not shortfall`);
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('faq-layout-fixtures.mjs')) {
  assertFaqLayoutFixtures();
  console.log('✅ FAQ layout fixtures passed');
}
