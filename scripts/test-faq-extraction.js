#!/usr/bin/env node

/**
 * Unit tests: FAQ answer cleaner, deny-list guard, and legacy JSON-LD rejection.
 */

import assert from 'node:assert/strict';
import {
  cleanExtractedFaqAnswerText,
  extractFAQFromArticle,
  extractFromArpFaqItems,
  KNOWN_BAD_FAQ_QUESTIONS
} from './faq-extraction.mjs';

function testMidTextBylineStripped() {
  const input =
    'When aiming to strengthen your photographic composition, remember to:\n\n' +
    'Simplify the scene to focus on your main subject.\n\n' +
    'Alan Ranger Remember that your images are your unique experience and therefore it is essential to ensure they are backed up.';
  const out = cleanExtractedFaqAnswerText(input);
  assert.ok(!/\bAlan Ranger Remember\b/i.test(out));
  assert.ok(out.includes('Simplify the scene'));
}

function testTrailingReadMyPostStripped() {
  const input =
    'Some good instructional content here with enough length to pass validation later.\n\n' +
    'Read my post on Safeguarding high-quality images using proper backups.';
  const out = cleanExtractedFaqAnswerText(input);
  assert.ok(!/\bRead my post on\b/i.test(out));
  assert.ok(out.includes('Some good instructional'));
}

function testCleanAnswerUnchanged() {
  const input =
    'Alan teaches composition using practical examples. Keep horizons level and watch the edges of the frame for distractions.';
  const out = cleanExtractedFaqAnswerText(input);
  assert.equal(out, input);
}

function faqPageHtml(mainEntity) {
  const doc = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity
  };
  const json = JSON.stringify(doc);
  return `<!DOCTYPE html><html><head><script type="application/ld+json">${json}</script></head><body></body></html>`;
}

function ldQuestion(name, answerText) {
  return {
    '@type': 'Question',
    name,
    acceptedAnswer: { '@type': 'Answer', text: answerText }
  };
}

function testLegacyEightQuestionJsonLdReturnsEmpty() {
  const mainEntity = KNOWN_BAD_FAQ_QUESTIONS.map((name) =>
    ldQuestion(name, 'Placeholder answer text repeated for schema length minimum.'.repeat(1))
  );
  const html = faqPageHtml(mainEntity);
  const r = extractFAQFromArticle(html, '', null);
  assert.equal(r.strategy, 'none');
  assert.equal(r.pairs.length, 0);
}

function testMixedRealAndLegacyQuestionJsonLdReturnsEmpty() {
  const long = 'Thoughtful answer text used for testing validation paths when not denied.'.repeat(1);
  const mainEntity = [
    ldQuestion('What is white balance in digital photography?', long),
    ldQuestion('How does aperture affect depth of field in practice?', long),
    ldQuestion('When should I raise ISO instead of opening the aperture?', long),
    ldQuestion('Where should I meter for a high-contrast sunset scene?', long),
    ldQuestion('Why does my tripod still show movement on windy days?', long),
    ldQuestion('What is this photography technique about?', long)
  ];
  const html = faqPageHtml(mainEntity);
  const r = extractFAQFromArticle(html, '', null);
  assert.equal(r.strategy, 'none');
  assert.equal(r.pairs.length, 0);
}

testMidTextBylineStripped();
testTrailingReadMyPostStripped();
testCleanAnswerUnchanged();
testLegacyEightQuestionJsonLdReturnsEmpty();
testMixedRealAndLegacyQuestionJsonLdReturnsEmpty();

console.log('✅ FAQ extraction unit tests passed (cleaner, deny-list, legacy JSON-LD).');

/**
 * Regression: Academy lessons must use visible #arp-*-faq .arp-faq-item Q&As,
 * not stale generic FAQ files (definition / film / compositional rule templates).
 */
const STALE_FAQ_MARKERS = [
  'What is the definition of composition balance?',
  'What is compositional balance in film?',
  'What is the definition of contrast in photography?',
  'What does contrast do on a camera?',
  'What does negative space in photography mean?',
  'What is an example of negative space?',
  'What does it mean when photography is an art of observation?',
  'What is the art of observation?',
  'What is photography as an art form?'
];

const ARP_FAQ_REGRESSION = [
  {
    slug: 'finding-your-compositional-balance',
    expectFirst: 'What is compositional balance in photography?',
    expectCount: 8
  },
  {
    slug: 'what-is-contrast-in-photography',
    expectFirst: 'What is contrast in photography?',
    expectCount: 8
  },
  {
    slug: 'what-is-negative-space-in-photography',
    expectFirst: 'What is negative space in photography?',
    expectCount: 8
  },
  {
    slug: 'photography-is-an-art-of-observation',
    expectFirst: 'Why is photography an art of observation?',
    expectCount: 8
  },
  {
    slug: 'the-art-of-storytelling-photography',
    expectFirst: 'What is storytelling photography?',
    expectCount: 8
  },
  {
    slug: 'what-is-framing-in-photography',
    expectFirst: 'What is framing in photography?',
    expectCount: 7
  },
  {
    slug: 'mastering-photography-composition-rules',
    expectFirst: 'What are the main composition rules in photography?',
    expectCount: 10
  },
  {
    slug: 'what-are-leading-lines-in-photography',
    expectFirst: 'What are leading lines in photography?',
    expectCount: 8
  }
];

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'SchemaToolsFaqRegression/1.0', accept: 'text/html' },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function testArpFaqRegression() {
  console.log('\nAcademy arp-faq regression (Contrast / Negative Space / Compositional Balance)...');
  for (const case_ of ARP_FAQ_REGRESSION) {
    const url = `https://www.alanranger.com/blog-on-photography/${case_.slug}`;
    const html = await fetchHtml(url);
    const direct = extractFromArpFaqItems(html);
    const extracted = extractFAQFromArticle(html, '', null);
    assert.equal(extracted.strategy, 'arp-faq', `${case_.slug} strategy`);
    assert.equal(extracted.pairs.length, case_.expectCount, `${case_.slug} count`);
    assert.equal(extracted.pairs[0].question, case_.expectFirst, `${case_.slug} first Q`);
    assert.equal(direct.length, case_.expectCount, `${case_.slug} arp-faq-item count`);
    for (const q of extracted.pairs.map((p) => p.question)) {
      assert.ok(!STALE_FAQ_MARKERS.includes(q), `${case_.slug} stale marker: ${q}`);
    }
    console.log(`  ✅ ${case_.slug}: ${extracted.pairs.length} via ${extracted.strategy}`);
  }
}

await testArpFaqRegression();
console.log('✅ Academy arp-faq regression passed.');
