#!/usr/bin/env node

/**
 * Unit tests: FAQ answer cleaner, deny-list guard, and legacy JSON-LD rejection.
 */

import assert from 'node:assert/strict';
import {
  cleanExtractedFaqAnswerText,
  cleanFaqAnswerText,
  cleanFaqQuestionText,
  extractFAQFromArticle,
  extractFromArpFaqItems,
  extractFromQuestionHeadings,
  pageHasVisibleArpFaq,
  KNOWN_BAD_FAQ_QUESTIONS
} from './faq-extraction.mjs';
import { dedupeFaqPagesByCanonicalUrl, nodeKey } from './lib/upsert-blog-schema-nodes.mjs';

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

const LONG_A =
  'This answer has enough characters to pass the minimum FAQ answer length validation used by extractFAQFromArticle.';

function testUnnumberedStrongFaqSection() {
  const html = `
<article>
  <h2>FAQs on improving your photography composition</h2>
  <p>These answers address common questions.</p>
  <p><strong>How can I improve my photography composition?</strong></p>
  <p>${LONG_A} Start with intention and review one decision.</p>
  <p><strong>What are the most important photography composition rules?</strong></p>
  <p>${LONG_A} Treat rules as options rather than instructions.</p>
  <p><strong>Should I always follow photography composition rules?</strong></p>
  <p>${LONG_A} Use a rule when it strengthens the photograph.</p>
</article>`;
  const r = extractFAQFromArticle(html, '', null);
  assert.equal(r.strategy, 'C', 'unnumbered strong FAQ strategy');
  assert.equal(r.pairs.length, 3);
  assert.equal(r.pairs[0].question, 'How can I improve my photography composition?');
}

function testPlainParagraphFaqSection() {
  const html = `
<article>
  <h2>Frequently Asked Questions</h2>
  <p>How can I improve my photography composition?</p>
  <p>${LONG_A} Begin by deciding what the photograph should communicate.</p>
  <p>What are the most important photography composition rules?</p>
  <p>${LONG_A} Common starting points include thirds, lines and framing.</p>
  <p>Can editing improve photography composition?</p>
  <p>${LONG_A} Editing can refine cropping, tone and local contrast carefully.</p>
</article>`;
  const r = extractFAQFromArticle(html, '', null);
  assert.equal(r.strategy, 'C', 'plain paragraph FAQ strategy');
  assert.equal(r.pairs.length, 3);
}

function testArpFaqInDivContainerWithNestedAnswer() {
  const html = `
<div id="arp-l34-faq" class="arp-l34-faq">
  <div class="arp-faq-item">
    <h3>How can I improve my photography composition?</h3>
    <div class="arp-faq-answer"><p>${LONG_A} Review intention first.</p></div>
  </div>
  <div class="arp-faq-item">
    <h3>What are the most important photography composition rules?</h3>
    <div class="arp-faq-answer"><p>${LONG_A} Treat rules as optional tools.</p></div>
  </div>
  <div class="arp-faq-item">
    <h3>Should I always follow photography composition rules?</h3>
    <div class="arp-faq-answer"><p>${LONG_A} Only when they strengthen the image.</p></div>
  </div>
</div>`;
  const direct = extractFromArpFaqItems(html);
  assert.equal(direct.length, 3, 'nested arp-faq-item count');
  const r = extractFAQFromArticle(html, '', null);
  assert.equal(r.strategy, 'arp-faq');
  assert.equal(r.pairs.length, 3);
  assert.equal(r.pairs[0].question, 'How can I improve my photography composition?');
}

function testAccordionQuestionTitlesOnly() {
  const html = `
<ul class="accordion-items-container">
  <li class="accordion-item">
    <span class="accordion-item__title">Dates and booking</span>
    <div class="accordion-item__description"><p>${LONG_A} Product schedule details go here.</p></div>
  </li>
  <li class="accordion-item">
    <span class="accordion-item__title">How do I book a photography workshop?</span>
    <div class="accordion-item__description"><p>${LONG_A} Choose a date and complete checkout online.</p></div>
  </li>
  <li class="accordion-item">
    <span class="accordion-item__title">What should I bring to the workshop?</span>
    <div class="accordion-item__description"><p>${LONG_A} Bring your camera, lens and spare batteries.</p></div>
  </li>
  <li class="accordion-item">
    <span class="accordion-item__title">Is this workshop suitable for beginners?</span>
    <div class="accordion-item__description"><p>${LONG_A} Yes, beginners are welcome with basic camera knowledge.</p></div>
  </li>
</ul>`;
  const r = extractFAQFromArticle(html, '', null);
  assert.equal(r.strategy, 'accordion');
  assert.equal(r.pairs.length, 3);
  assert.ok(r.pairs.every((p) => p.question.endsWith('?')));
}

/** Exact Lesson 34 / arp-l34-faq format: .faq-item cards + Q1:/A1: prefixes. */
const L34_EXPECTED_QUESTIONS = [
  'How can I improve my photography composition?',
  'What are the most important photography composition rules?',
  'How can I tell whether a photograph has a good composition?',
  'How do I simplify a busy photography composition?',
  'How do I create balance in a photograph?',
  'Should I always follow photography composition rules?',
  'Can editing improve photography composition?',
  'What is the best way to practise photography composition?'
];

const L34_STALE_LEGACY = [
  'What is this photography technique about?',
  'How do I apply these techniques?',
  'What camera settings should I use?',
  'Do I need special equipment?',
  'How can I improve my results?'
];

const L34_ANSWERS = [
  'Begin by deciding what you want the photograph to communicate. Review where attention goes, remove or reduce competing elements and change one decision at a time, such as viewpoint, timing, framing, visual weight or use of space.',
  'Common starting points include the rule of thirds, leading lines, framing, balance, negative space, patterns and visual contrast. Treat them as options to explore rather than instructions that every photograph must follow.',
  'Ask whether the viewer notices what matters, whether the elements support the intended mood or story and whether anything competes unnecessarily for attention. A successful composition communicates clearly.',
  'Move closer, change your camera position, separate overlapping elements or wait for background distractions to disappear. You can also use light, focus or negative space to make the main subject easier to recognise.',
  'Compare the visual influence of size, brightness, colour, contrast, detail and position. Balance does not require symmetry: a small bright element can balance a larger quiet area.',
  'No. Use a rule when it strengthens the subject, relationship or atmosphere you want to communicate. Centred placement, deliberate imbalance, motion blur and unusual cropping can all work.',
  'Editing can refine composition through cropping and adjustments to tone, colour and local contrast. Begin with the original intention and use restrained changes to clarify attention.',
  'Choose one compositional idea for each session, make several versions and compare what changes. Record which choices helped or weakened the image, then turn that review into one practical goal.'
];

function buildLesson34FaqHtml() {
  const cards = L34_EXPECTED_QUESTIONS.map((q, i) => {
    const qPrefix = i % 2 === 0 ? `Q${i + 1}: ` : `Question ${i + 1}: `;
    const aPrefix = i % 2 === 0 ? `A${i + 1}: ` : `Answer ${i + 1}: `;
    return `
  <div class="faq-item">
    <h3>${qPrefix}${q}</h3>
    <p>${aPrefix}${L34_ANSWERS[i]}</p>
  </div>`;
  }).join('\n');
  // Stale JSON-LD that must NOT win when visible arp-l34-faq exists.
  const staleLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: L34_STALE_LEGACY.map((name) => ({
      '@type': 'Question',
      name,
      acceptedAnswer: { '@type': 'Answer', text: LONG_A }
    }))
  });
  return `<!DOCTYPE html><html><head>
<script type="application/ld+json">${staleLd}</script>
</head><body>
<article>
  <h2>How to improve your photography composition</h2>
  <h3>Should ordinary article headings become FAQ questions?</h3>
  <p>${LONG_A} This body heading must not be extracted as FAQ.</p>
  <section id="arp-l34-faq" class="arp-l34-faq">
    <h2>FAQs on improving your photography composition</h2>
    ${cards}
  </section>
</article>
</body></html>`;
}

function testLesson34FaqItemWithPrefixes() {
  const html = buildLesson34FaqHtml();
  assert.equal(pageHasVisibleArpFaq(html), true);
  const direct = extractFromArpFaqItems(html);
  assert.equal(direct.length, 8, 'L34 .faq-item raw count');
  const r = extractFAQFromArticle(html, '', null);
  assert.equal(r.strategy, 'arp-faq', 'L34 strategy');
  assert.equal(r.pairs.length, 8, 'L34 accepted count');
  assert.deepEqual(
    r.pairs.map((p) => p.question),
    L34_EXPECTED_QUESTIONS
  );
  for (const p of r.pairs) {
    assert.ok(!/^Q\d+:/i.test(p.question), `Q prefix left on: ${p.question}`);
    assert.ok(!/^Question\s*\d+:/i.test(p.question), `Question N prefix left on: ${p.question}`);
    assert.ok(!/^A\d+:/i.test(p.answer), `A prefix left on answer for: ${p.question}`);
    assert.ok(!/^Answer\s*\d+:/i.test(p.answer), `Answer N prefix left on for: ${p.question}`);
  }
  const names = new Set(r.pairs.map((p) => p.question));
  for (const stale of L34_STALE_LEGACY) {
    assert.ok(!names.has(stale), `stale legacy remained: ${stale}`);
  }
}

function testBareFaqItemOutsideArpContainerIgnored() {
  const html = `
<article>
  <div class="faq-item"><h3>How can I improve my photography composition?</h3><p>${LONG_A}</p></div>
  <div class="faq-item"><h3>What are the most important photography composition rules?</h3><p>${LONG_A}</p></div>
  <div class="faq-item"><h3>Should I always follow photography composition rules?</h3><p>${LONG_A}</p></div>
</article>`;
  assert.equal(extractFromArpFaqItems(html).length, 0);
}

function testVisibleArpFaqEmptyFailsHard() {
  const html = `
<section id="arp-l34-faq" class="arp-l34-faq">
  <div class="faq-item"><h3>Too short?</h3><p>Nope.</p></div>
</section>
<script type="application/ld+json">${JSON.stringify({
    '@type': 'FAQPage',
    mainEntity: L34_STALE_LEGACY.slice(0, 3).map((name) => ({
      '@type': 'Question',
      name,
      acceptedAnswer: { '@type': 'Answer', text: LONG_A }
    }))
  })}</script>`;
  const r = extractFAQFromArticle(html, '', null);
  assert.equal(r.strategy, 'arp-faq-failed');
  assert.equal(r.visibleFaqFailed, true);
  assert.equal(r.pairs.length, 0);
}

function testOrdinaryHeadingsExcludedWithoutFaqSection() {
  const html = `
<article>
  <h2>How can I improve my photography composition?</h2>
  <p>${LONG_A} Body answer under an ordinary heading.</p>
  <h2>What are the most important photography composition rules?</h2>
  <p>${LONG_A} Another body section that is not an FAQ block.</p>
  <h2>Should I always follow photography composition rules?</h2>
  <p>${LONG_A} Still not inside a confirmed FAQ section.</p>
</article>`;
  assert.equal(extractFromQuestionHeadings(html).length, 0);
  const r = extractFAQFromArticle(html, '', null);
  assert.equal(r.strategy, 'none');
  assert.equal(r.pairs.length, 0);
}

function testPrefixCleaners() {
  assert.equal(cleanFaqQuestionText('Q1: How can I improve my photography composition?'), L34_EXPECTED_QUESTIONS[0]);
  assert.equal(cleanFaqQuestionText('Question 1: How can I improve my photography composition?'), L34_EXPECTED_QUESTIONS[0]);
  assert.equal(cleanFaqAnswerText('A1: Begin by deciding what you want.'), 'Begin by deciding what you want.');
  assert.equal(cleanFaqAnswerText('Answer 2: Begin by deciding what you want.'), 'Begin by deciding what you want.');
}

function testDedupeFaqPagesByCanonicalUrl() {
  const url = 'https://www.alanranger.com/blog-on-photography/how-to-improve-your-photography-composition';
  const graph = [
    { '@type': 'WebPage', '@id': `${url}#webpage`, url },
    {
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: [{ '@type': 'Question', name: 'Stale one?', acceptedAnswer: { text: LONG_A } }]
    },
    {
      '@type': 'FAQPage',
      '@id': `${url}/#faq`,
      mainEntity: [{ '@type': 'Question', name: L34_EXPECTED_QUESTIONS[0], acceptedAnswer: { text: LONG_A } }]
    }
  ];
  const out = dedupeFaqPagesByCanonicalUrl(graph);
  const faqs = out.filter((n) => n['@type'] === 'FAQPage');
  assert.equal(faqs.length, 1);
  assert.equal(nodeKey(faqs[0]), `${url}#faq`);
  assert.equal(faqs[0].mainEntity[0].name, L34_EXPECTED_QUESTIONS[0]);
}

testUnnumberedStrongFaqSection();
testPlainParagraphFaqSection();
testArpFaqInDivContainerWithNestedAnswer();
testAccordionQuestionTitlesOnly();
testPrefixCleaners();
testLesson34FaqItemWithPrefixes();
testBareFaqItemOutsideArpContainerIgnored();
testVisibleArpFaqEmptyFailsHard();
testOrdinaryHeadingsExcludedWithoutFaqSection();
testDedupeFaqPagesByCanonicalUrl();
console.log('✅ FAQ format fixture tests passed (L34 faq-item, prefixes, visible-fail, heading scope, dedupe).');

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
