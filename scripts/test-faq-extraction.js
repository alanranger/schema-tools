#!/usr/bin/env node

/**
 * Unit tests: FAQ answer cleaner, deny-list guard, and legacy JSON-LD rejection.
 */

import assert from 'node:assert/strict';
import {
  cleanExtractedFaqAnswerText,
  extractFAQFromArticle,
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
