#!/usr/bin/env node

/**
 * Unit tests: FAQ answer cleaner (JSON-LD Strategy A post-processing).
 */

import assert from 'node:assert/strict';
import { cleanExtractedFaqAnswerText } from './faq-extraction.mjs';

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

testMidTextBylineStripped();
testTrailingReadMyPostStripped();
testCleanAnswerUnchanged();

console.log('✅ FAQ extraction unit tests passed (cleanExtractedFaqAnswerText).');
