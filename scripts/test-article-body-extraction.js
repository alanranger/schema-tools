#!/usr/bin/env node

/**
 * Unit tests: BlogPosting articleBody extraction + publish guard (scripts/article-body-extraction.mjs).
 */

import assert from 'node:assert/strict';
import {
  extractBlogArticleText,
  findArticleContentStart,
  blogPostingSaveDecision,
  countWords
} from './article-body-extraction.mjs';

const INTRO = 'Every April the UK puts on one of the great natural shows on the planet.';
const LONG = `${'Woodland light changes fast so plan the shot carefully and watch the canopy. '.repeat(60)}`.trim();

function blogPage({ title, body }) {
  return `<html><head><title>${title}</title><script>document.documentElement.classList.add('wf-loading')</script></head>
<body><header><nav>Courses Workshops Cart 0 Sign In My Account</nav></header>
<main class="Main Main--blog-item"><article class="BlogItem hentry">
  <h1 class="BlogItem-title">${title}</h1>
  <div class="Blog-meta BlogItem-meta"><span>photography-tips</span> Alan Ranger 9 January 2026</div>
  <div class="sqs-layout"><div class="sqs-block-content">${body}</div>
  <div class="sqs-block-code"><style>.x{color:red}</style><script type="application/ld+json">{"@type":"FAQPage"}</script></div></div>
  <div class="BlogItem-share"><span>Facebook 0</span> <span>LinkedIn 0</span></div>
  <div class="BlogItem-comments">0 Likes</div>
  <nav class="BlogItem-pagination clear"><a>Next Post</a></nav>
</article></main><footer>45 Hathaway Road</footer></body></html>`;
}

function testTitleAtIndexZeroKeepsIntro() {
  const title = 'Bluebell Photography in the UK: A Practical Field Guide';
  const text = `${title} Cart 0 Sign In My Account ${INTRO} The light matters before you arrive at the wood.`;
  const start = findArticleContentStart(text, title);
  assert.equal(start, title.length);
  assert.ok(text.slice(start).includes(INTRO), 'intro must survive when the title is at index 0');
}

function testMidTextBeforeYouIsNotAContentStart() {
  const text = `${INTRO} Good preparation before you arrive matters. This guide is the planning layer.`;
  assert.equal(findArticleContentStart(text, ''), 0);
  assert.equal(findArticleContentStart('Intro text. BEFORE YOU START check the tide.', ''), 'Intro text. '.length);
}

function testContainerExtractionExcludesChrome() {
  const html = blogPage({ title: 'Bluebell Photography in the UK', body: `<p>${INTRO}</p><p>${LONG}</p>` });
  const r = extractBlogArticleText(html);
  assert.equal(r.found, true);
  assert.ok(r.text.startsWith(INTRO), `body should open with the intro, got: ${r.text.slice(0, 60)}`);
  for (const junk of ['Facebook 0', 'Likes', 'Next Post', 'Alan Ranger 9 January', 'Cart 0', 'wf-loading', 'FAQPage', 'color:red', 'Hathaway']) {
    assert.ok(!r.text.includes(junk), `container text must not include "${junk}"`);
  }
  assert.equal(r.words, countWords(`${INTRO} ${LONG}`));
}

function testChecklistPageHasEmptyBodyButIsPublishable() {
  const html = blogPage({ title: 'Macro Photography Guide: 1-Page Field Checklist PDF', body: '<img src="checklist.png" alt="">' });
  const r = extractBlogArticleText(html);
  assert.equal(r.found, true);
  assert.equal(r.words, 0);
  const d = blogPostingSaveDecision({ htmlFetched: true, bodySource: 'text', articleWords: 18, pageWords: r.words });
  assert.equal(d.save, true, 'a genuinely short checklist page must stay publishable');
}

function testFailedFetchIsNeverPublished() {
  const d = blogPostingSaveDecision({ htmlFetched: false, bodySource: 'title-fallback', articleWords: 9, pageWords: 0 });
  assert.equal(d.save, false);
  assert.match(d.reason, /could not be fetched/);
}

function testTitleFallbackAndThinBodyAreNeverPublished() {
  assert.equal(blogPostingSaveDecision({ htmlFetched: true, bodySource: 'title-fallback', articleWords: 9, pageWords: 3500 }).save, false);
  assert.equal(blogPostingSaveDecision({ htmlFetched: true, bodySource: 'text', articleWords: 40, pageWords: 3500 }).save, false);
  assert.equal(blogPostingSaveDecision({ htmlFetched: true, bodySource: 'container', articleWords: 3500, pageWords: 3500 }).save, true);
}

function testNestedArticleInCodeBlockDoesNotTruncate() {
  const body = `<p>${INTRO}</p><div class="arp-section"><article class="arp-card"><p>Card one text.</p></article></div><p>${LONG}</p>`;
  const r = extractBlogArticleText(blogPage({ title: 'Composition', body }));
  assert.ok(r.text.includes('Card one text.') && r.text.endsWith(LONG.slice(-40)), 'text after a nested </article> must be kept');
}

function testInfographicSvgTextAndEntitiesKept() {
  const body = `<p>${LONG}</p><figure><svg><title>Equipment guide for in-house business photography</title><path d="M0 0"/></svg></figure><p>Mattia Tosi &middot; JLR employee &rarr; workshops</p>`;
  const r = extractBlogArticleText(blogPage({ title: 'Corporate training', body }));
  assert.ok(r.text.includes('Equipment guide for in-house business photography'));
  assert.ok(r.text.includes('Mattia Tosi \u00b7 JLR employee \u2192 workshops'));
}

function testNoArticleElement() {
  const r = extractBlogArticleText('<html><body><div class="ProductList">Lee filters 15% off</div></body></html>');
  assert.equal(r.found, false);
  assert.equal(r.words, 0);
}

testTitleAtIndexZeroKeepsIntro();
testMidTextBeforeYouIsNotAContentStart();
testContainerExtractionExcludesChrome();
testChecklistPageHasEmptyBodyButIsPublishable();
testFailedFetchIsNeverPublished();
testTitleFallbackAndThinBodyAreNeverPublished();
testNoArticleElement();
testNestedArticleInCodeBlockDoesNotTruncate();
testInfographicSvgTextAndEntitiesKept();
console.log('✅ Article body extraction tests passed (title-at-0, before-you mid-text, container chrome, checklist, failed fetch, guard).');
