import test from 'node:test';
import assert from 'node:assert/strict';
import './landing-live-sources.js';

const L = globalThis.LandingLiveSources;
const PAGE = 'https://www.alanranger.com/photography-workshops';

const summaryItem = (href, title) => `<div class=" summary-item positioned summary-item-record-type-event" data-x="1">
  <div class="summary-thumbnail-outer-container"><a href="${href}" class=" summary-thumbnail-container sqs-gallery-image-container " data-title="${title}"></a></div>
  <div class="summary-title"><a href="${href}" class="summary-title-link">${title}</a></div></div>`;

test('ItemList: the page\'s summary items, in page order, de-duplicated; no list → no ItemList', () => {
  const html = `<html><head></head><body><div class="summary-item-list">${summaryItem('/photographic-workshops-near-me/a', 'Workshop A &amp; More')}
    ${summaryItem('/photographic-workshops-near-me/b', 'Workshop B')}${summaryItem('/photographic-workshops-near-me/a', 'Workshop A &amp; More')}</div></body></html>`;
  const list = L.buildItemList(html, PAGE, 'Photography Workshops');
  assert.equal(list['@id'], `${PAGE}#itemlist`);
  assert.equal(list.numberOfItems, 2);
  assert.deepEqual(list.itemListElement.map((i) => [i.position, i.name, i.url]), [
    [1, 'Workshop A & More', 'https://www.alanranger.com/photographic-workshops-near-me/a'],
    [2, 'Workshop B', 'https://www.alanranger.com/photographic-workshops-near-me/b']
  ]);
  assert.equal(L.buildItemList('<body><p>No list here</p><div class="summary-item-list"></div></body>', PAGE, 'X'), null);
  const gallery = '<body><div class=" summary-item summary-item-record-type-image"><a href="/s/a.jpg" class=" summary-thumbnail-container" data-title="IMG 01.jpg"></a></div></body>';
  assert.equal(L.buildItemList(gallery, PAGE, 'X'), null, 'an image gallery is not a list of pages');
});

test('BreadcrumbList: from the URL path; intermediate levels only when the site navigation links them', () => {
  const top = L.buildBreadcrumbList(PAGE, 'Photography Workshops', '<body></body>');
  assert.deepEqual(top.itemListElement.map((c) => [c.name, c.item]), [['Home', 'https://www.alanranger.com'], ['Photography Workshops', PAGE]]);
  const home = L.buildBreadcrumbList('https://www.alanranger.com/home', 'Home', '<body></body>');
  assert.deepEqual(home.itemListElement.map((c) => c.name), ['Home']);
  const nested = L.buildBreadcrumbList('https://www.alanranger.com/academy/login', 'Academy Login', '<body><nav><a href="/academy" class="Header-nav-item">Academy</a></nav></body>');
  assert.deepEqual(nested.itemListElement.map((c) => c.name), ['Home', 'Academy', 'Academy Login']);
  const named = L.buildBreadcrumbList(PAGE, 'Long SEO Title', '<body><a href="/photography-workshops" class="ProductList-filter">All</a><a href="/photography-workshops" class="Header-nav-folder-item">Workshops</a></body>');
  assert.deepEqual(named.itemListElement.map((c) => c.name), ['Home', 'Workshops'], 'page named by its header navigation label, not other links');
  const noNav = L.buildBreadcrumbList('https://www.alanranger.com/academy/login', 'Academy Login', '<body></body>');
  assert.deepEqual(noNav.itemListElement.map((c) => c.name), ['Home', 'Academy Login']);
});

test('VideoObject: one per embedded YouTube video, fields from its watch page; missing required fields are reported, not invented', async () => {
  const page = '<body><iframe src="https://www.youtube.com/embed/dZcygU48Sbc?rel=0"></iframe><div data-html="&lt;iframe src=&quot;https://www.youtube.com/embed/I3BFwgf1f2I&quot;"></div></body>';
  assert.deepEqual(L.youtubeIds(page), ['dZcygU48Sbc', 'I3BFwgf1f2I']);
  const watch = {
    dZcygU48Sbc: '<meta itemprop="name" content="Help Portrait UK Coventry"><meta itemprop="uploadDate" content="2017-12-16T04:01:03-08:00"><meta itemprop="duration" content="PT3M45S"><meta property="og:image" content="https://i.ytimg.com/vi/dZcygU48Sbc/maxresdefault.jpg"><meta property="og:description" content="Short film">',
    I3BFwgf1f2I: '<meta itemprop="name" content="Promo"><meta property="og:image" content="https://i.ytimg.com/vi/I3BFwgf1f2I/maxresdefault.jpg">'
  };
  const reports = [];
  const nodes = await L.buildVideoObjects(page, 'https://www.alanranger.com/help-portrait-uk-coventry', async (u) => watch[u.split('v=')[1]], (m) => reports.push(m));
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].uploadDate, '2017-12-16T04:01:03-08:00');
  assert.equal(nodes[0].duration, 'PT3M45S');
  assert.equal(nodes[0].embedUrl, 'https://www.youtube.com/embed/dZcygU48Sbc');
  assert.match(reports[0], /I3BFwgf1f2I.*missing uploadDate/);
});

test('WebSite fields come from Squarespace\'s site-level WebSite JSON-LD on the page', () => {
  const html = '<script type="application/ld+json">{"url":"https://www.alanranger.com","name":"ARP","description":"<p class=\\"\\" style=\\"white-space:pre-wrap;\\">Site SEO description</p>","image":"https://x/logo.png","@context":"http://schema.org","@type":"WebSite"}</script>';
  const graph = [{ '@type': 'WebSite', '@id': 'https://www.alanranger.com/#website', description: '' }];
  L.applyWebSiteFields(graph, L.squarespaceWebSite(html));
  assert.equal(graph[0].description, 'Site SEO description');
  assert.equal(graph[0].image, 'https://x/logo.png');
});

test('no business rating on any landing page: aggregateRating / review removed from LocalBusiness and Organization nodes', () => {
  const graph = [
    { '@type': ['Organization', 'LocalBusiness'], '@id': '#org', aggregateRating: { ratingValue: '4.8' }, review: [{ '@type': 'Review' }] },
    { '@type': 'Organization', '@id': '#other', aggregateRating: { ratingValue: '5' } },
    { '@type': 'Course', '@id': '#course', aggregateRating: { ratingValue: '5.0' } }
  ];
  assert.equal(L.businessRatingNodes(graph), 2);
  L.stripBusinessRating(graph);
  assert.equal(L.businessRatingNodes(graph), 0);
  assert.equal(graph[0].review, undefined);
  assert.deepEqual(graph[2].aggregateRating, { ratingValue: '5.0' }, 'Course (a product-type offer) is not a business rating');
});
