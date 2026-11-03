/**
 * Landing schema nodes rebuilt every run from live sources (Alan 2026-10-31, batch 4): never copied from an earlier
 * published file. Works on HTML strings so the same code runs in the app (index.html) and in node tests.
 *   ItemList       ← the page's Squarespace summary-block items, in page order (no list on the page → no ItemList)
 *   BreadcrumbList ← the URL path, with intermediate levels named from the site's own navigation links
 *   VideoObject    ← YouTube videos embedded on the page; fields from the video's own YouTube watch page
 *   WebSite fields ← Squarespace's site-level WebSite JSON-LD on the page (site description + logo)
 *   No business aggregateRating / review on any landing page (P23: self-serving reviews are ineligible)
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LandingLiveSources = api;
})(typeof window !== 'undefined' ? window : globalThis, () => {
  const ORIGIN = 'https://www.alanranger.com';
  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

  const decode = (s) => String(s || '').replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e) => {
    if (ENTITIES[e.toLowerCase()] !== undefined) return ENTITIES[e.toLowerCase()];
    if (/^#x/i.test(e)) return String.fromCodePoint(parseInt(e.slice(2), 16));
    return /^#\d+$/.test(e) ? String.fromCodePoint(Number(e.slice(1))) : m;
  });
  const text = (html) => decode(String(html || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  const attr = (tag, name) => decode((tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i')) || [])[1] || '');
  const absolute = (href, base) => { try { return new URL(href, base).toString().replace(/\/+$/, ''); } catch (e) { return ''; } };
  const bodyOf = (html) => { const s = String(html || ''); const i = s.search(/<body[\s>]/i); return i >= 0 ? s.slice(i) : s; };

  // ---------- ItemList ----------
  const SUMMARY_ITEM_RE = /<div class="(?:[^"]*\s)?summary-item(?:\s[^"]*)?"[^>]*>/gi;

  function summaryItemLink(chunk, pageUrl) {
    const title = chunk.match(/class="summary-title[^"]*"[^>]*>\s*<a\s[^>]*>[\s\S]*?<\/a>/i);
    const titleTag = title && title[0].match(/<a\s[^>]*>([\s\S]*?)<\/a>/i);
    const thumb = chunk.match(/<a\s[^>]*summary-thumbnail-container[^>]*>/i);
    const tag = titleTag ? titleTag[0] : (thumb ? thumb[0] : '');
    const name = (titleTag ? text(titleTag[1]) : '') || attr(tag, 'data-title') || attr(tag, 'aria-label');
    const href = attr(tag, 'href');
    return href && name ? { name, url: absolute(href, pageUrl) } : null;
  }

  /** Page, event, product and blog records; image records are a picture gallery (file names), not a list of pages. */
  function summaryItems(html, pageUrl) {
    const body = bodyOf(html);
    const starts = [...body.matchAll(SUMMARY_ITEM_RE)].filter((m) => !/summary-item-record-type-image/.test(m[0])).map((m) => m.index);
    const items = [];
    const seen = new Set();
    starts.forEach((start, i) => {
      const link = summaryItemLink(body.slice(start, starts[i + 1] || start + 20000), pageUrl);
      if (!link || seen.has(link.url)) return;
      seen.add(link.url);
      items.push(link);
    });
    return items;
  }

  /** Squarespace store page products (ProductList grid), in page order. */
  function storeItems(html, pageUrl) {
    const body = bodyOf(html);
    const starts = [...body.matchAll(/<(?:div|article) class="(?:[^"]*\s)?ProductList-item(?:\s[^"]*)?"[^>]*>/gi)].map((m) => m.index);
    return starts.map((start, i) => {
      const chunk = body.slice(start, starts[i + 1] || start + 20000);
      const link = chunk.match(/<a\s[^>]*ProductList-item-link[^>]*>/i);
      const title = chunk.match(/class="ProductList-title"[^>]*>([\s\S]*?)<\/h\d>/i);
      const href = link ? attr(link[0], 'href') : '';
      return href && title ? { name: text(title[1]), url: absolute(href, pageUrl) } : null;
    }).filter(Boolean);
  }

  function buildItemList(html, pageUrl, pageName) {
    const seen = new Set();
    const items = [...summaryItems(html, pageUrl), ...storeItems(html, pageUrl)].filter((it) => !seen.has(it.url) && seen.add(it.url));
    if (!items.length) return null;
    return {
      '@type': 'ItemList', '@id': `${pageUrl}#itemlist`, name: pageName, numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: it.url }))
    };
  }

  // ---------- BreadcrumbList ----------
  /** The label the site's header navigation gives this path (Header-nav-item / Header-nav-folder-item links only). */
  function navName(html, path) {
    const href = `(?:${ORIGIN})?${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?`;
    const re = new RegExp(`<a\\s(?=[^>]*href="${href}")(?=[^>]*class="[^"]*Header-nav[^"]*")[^>]*>([\\s\\S]*?)</a>`, 'i');
    const m = bodyOf(html).match(re);
    return m ? text(m[1]) : '';
  }

  function buildBreadcrumbList(pageUrl, pageName, html) {
    const path = new URL(pageUrl).pathname.replace(/\/+$/, '');
    const parts = path === '/home' ? [] : path.split('/').filter(Boolean);
    const crumbs = [{ name: 'Home', item: ORIGIN }];
    parts.slice(0, -1).forEach((_, i) => {
      const sub = `/${parts.slice(0, i + 1).join('/')}`;
      const name = navName(html, sub);
      if (name) crumbs.push({ name, item: `${ORIGIN}${sub}` });
    });
    if (parts.length) crumbs.push({ name: navName(html, path) || pageName, item: `${ORIGIN}${path}` });
    return {
      '@type': 'BreadcrumbList', '@id': `${pageUrl}#breadcrumbs`,
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item }))
    };
  }

  // ---------- VideoObject ----------
  function youtubeIds(html) {
    const ids = [...bodyOf(html).matchAll(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|watch\?.*?&amp;v=)|youtu\.be\/)([\w-]{11})/g)].map((m) => m[1]);
    return [...new Set(ids)];
  }

  function watchPageFields(html) {
    const meta = (re) => decode((String(html || '').match(re) || [])[1] || '');
    return {
      name: meta(/itemprop="name" content="([^"]*)"/i) || meta(/property="og:title" content="([^"]*)"/i),
      description: meta(/property="og:description" content="([^"]*)"/i) || meta(/name="description" content="([^"]*)"/i),
      uploadDate: meta(/itemprop="uploadDate" content="([^"]*)"/i) || meta(/"uploadDate":"([^"]+)"/),
      duration: meta(/itemprop="duration" content="([^"]*)"/i),
      thumbnailUrl: meta(/property="og:image" content="([^"]*)"/i)
    };
  }

  const REQUIRED_VIDEO_FIELDS = ['name', 'thumbnailUrl', 'uploadDate'];

  function videoObject(id, pageUrl, f) {
    const node = { '@type': 'VideoObject', '@id': `${pageUrl}#video-${id}`, name: f.name, thumbnailUrl: [f.thumbnailUrl], uploadDate: f.uploadDate,
      embedUrl: `https://www.youtube.com/embed/${id}`, contentUrl: `https://www.youtube.com/watch?v=${id}` };
    if (f.description) node.description = f.description;
    if (f.duration) node.duration = f.duration;
    return node;
  }

  /** fetchHtml(url) → watch page HTML. Videos missing a required field are reported, never invented. */
  async function buildVideoObjects(html, pageUrl, fetchHtml, report = () => {}) {
    const nodes = [];
    for (const id of youtubeIds(html)) {
      let fields = {};
      try { fields = watchPageFields(await fetchHtml(`https://www.youtube.com/watch?v=${id}`)); } catch (e) { report(`video ${id}: watch page not fetched (${e.message})`); }
      const missing = REQUIRED_VIDEO_FIELDS.filter((k) => !fields[k]);
      if (missing.length) { report(`video ${id}: no VideoObject — missing ${missing.join(', ')} from YouTube`); continue; }
      nodes.push(videoObject(id, pageUrl, fields));
    }
    return nodes;
  }

  // ---------- WebSite fields ----------
  function squarespaceWebSite(html) {
    for (const m of String(html || '').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
      try {
        const j = JSON.parse(m[1]);
        if (j && j['@type'] === 'WebSite' && !j['@id']) return j;
      } catch (e) { /* not JSON */ }
    }
    return null;
  }

  function applyWebSiteFields(graph, site) {
    const node = graph.find((n) => n && n['@type'] === 'WebSite');
    if (!node || !site) return graph;
    if (site.description) node.description = text(site.description);
    if (site.image) node.image = String(site.image).replace(/^\/\//, 'https://');
    return graph;
  }

  // ---------- No business rating (Alan, 31 Oct 2026, P23) ----------
  /** Google treats self-serving LocalBusiness/Organization reviews as ineligible: landing pages carry none. */
  const isBusiness = (n) => n && [].concat(n['@type']).some((t) => t === 'LocalBusiness' || t === 'Organization');

  function stripBusinessRating(graph) {
    graph.filter(isBusiness).forEach((org) => { delete org.aggregateRating; delete org.review; });
    return graph;
  }

  const businessRatingNodes = (graph) => (graph || []).filter((n) => isBusiness(n) && (n.aggregateRating || n.review)).length;

  // ---------- selling fields carried forward from the hosted file (Claude 3 Nov, 6.1) ----------
  // Since 28 Oct the pages' own JSON-LD lives only in the hosted landing file (injected by landing-page-loader.js), so a
  // fetch of the page no longer shows a selling page's offers / price or its ratings. The hosted file is what the live
  // page serves; its offers, aggregateRating and reviews (never on the business node — P23) are kept, and a video keeps
  // its WatchAction while the page still embeds that video.
  const SELLING = ['offers', 'aggregateRating', 'review'];
  const hasPrice = (offers) => JSON.stringify(offers || '').includes('"price"');
  const graphOf = (doc) => (Array.isArray(doc && doc['@graph']) ? doc['@graph'] : []);
  const isVideo = (n) => [].concat(n && n['@type']).includes('VideoObject');
  const videoKey = (n) => (String(n.embedUrl || n.contentUrl || n.url || '').match(/(?:embed\/|v=|youtu\.be\/)([\w-]{11})/) || [])[1] || null;

  function carryFields(node, prev) {
    const carried = [];
    for (const f of SELLING) {
      const missing = node[f] == null || (f === 'offers' && !hasPrice(node[f]) && hasPrice(prev[f]));
      if (prev[f] != null && missing) { node[f] = prev[f]; carried.push(f); }
    }
    // A selling node keeps the types it is published with (e.g. Service+Product), so its offers stay eligible.
    const types = [].concat(node['@type'] || []);
    const lost = [].concat(prev['@type'] || []).filter((t) => !types.includes(t));
    if (lost.length) { node['@type'] = [...types, ...lost]; carried.push(`@type ${lost.join('+')}`); }
    return carried;
  }

  function carryVideoActions(graph, hosted) {
    const report = [];
    for (const prev of graphOf(hosted).filter((n) => isVideo(n) && n.potentialAction)) {
      const v = graph.find((n) => isVideo(n) && !n.potentialAction && videoKey(n) && videoKey(n) === videoKey(prev));
      if (v) { v.potentialAction = prev.potentialAction; report.push(`${v['@id'] || videoKey(v)}: WatchAction kept (the video is still on the page)`); }
    }
    return report;
  }

  /** Mutates graph; returns one line per carried field / node. hosted = the published landing JSON (or null). */
  function carryForwardSelling(graph, hosted) {
    const report = [];
    const byId = new Map(graph.filter((n) => n && n['@id']).map((n) => [n['@id'], n]));
    for (const prev of graphOf(hosted)) {
      if (!prev || isBusiness(prev) || !SELLING.some((f) => prev[f] != null)) continue;
      const node = prev['@id'] && byId.get(prev['@id']);
      if (!node) { graph.push(prev); report.push(`${prev['@id'] || [].concat(prev['@type']).join('+')}: node kept from the hosted file (${SELLING.filter((f) => prev[f] != null).join(', ')})`); continue; }
      const carried = carryFields(node, prev);
      if (carried.length) report.push(`${prev['@id']}: ${carried.join(', ')} kept from the hosted file`);
    }
    return [...report, ...carryVideoActions(graph, hosted)];
  }

  // ---------- selling fields from LIVE sources (Claude/Alan 3 Nov, 10) ----------
  // Offers from the products the run built (Squarespace + offer_dates rules, as D) or the page's own membership plan;
  // ratings/reviews from the combined review file (product_reviews), same rules as the product schema (04):
  // excluded rows out, aggregate over every rated review, text reviews listed newest first, at most 25.
  const PRINTS = ['fine-art-photography-prints-canvas-wrap-round-multi-size_schema.json',
    'fine-art-photography-prints-unframed-prints-multi-sizes_schema.json', 'framed-fine-art-photography-prints-multiple-sizes_schema.json'];
  const SELLING_PAGES = {
    'photography-gift-vouchers': { node: 'product', offers: { products: ['photography-gift-vouchers-digital-ecard-email-delivery_schema.json'] } },
    'photo-editing-course-coventry': { node: 'service', offers: { products: ['lightroom-courses-for-beginners-photo-editing-coventry_schema.json'] } },
    'photography-mentoring-online-assignments': { node: 'service', types: ['Service', 'Product'], offers: { plan: true }, reviews: 'photography-mentoring-online-assignments' },
    'gallery-image-portfolios': { node: 'schema', offers: { products: PRINTS, aggregate: true } },
    // The Service node becomes the Course afterwards (applyLandingCourseOverride takes its rating from the rated Service).
    'free-online-photography-course': { node: 'service', reviews: 'free-online-photography-course' }
  };
  const MAX_LISTED_REVIEWS = 25;
  const pageSlug = (pageUrl) => String(pageUrl || '').replace(/\/+$/, '').split('/').pop() || 'home';
  const productNode = (doc) => graphOf(doc).find((n) => [].concat(n['@type'] || []).includes('Product')) || null;

  function offersFromProducts(cfg, docs) {
    const offers = cfg.products.flatMap((f) => [].concat(productNode(docs(f))?.offers || []));
    if (!offers.length) return null;
    if (!cfg.aggregate) return offers.length === 1 ? offers[0] : offers;
    const prices = offers.map((o) => Number(o.price)).filter((p) => p > 0);
    return { '@type': 'AggregateOffer', priceCurrency: 'GBP', lowPrice: Math.min(...prices).toFixed(2), highPrice: Math.max(...prices).toFixed(2),
      offerCount: String(offers.length), availability: 'https://schema.org/InStock' };
  }

  /** A membership plan on the page: "<name> £20.00 Every month" (Squarespace Member Areas, not a commerce product). */
  function offerFromPlan(html, pageUrl, year) {
    const m = text(bodyOf(html)).match(/([A-Z][^£]{2,60}?)\s*£\s?(\d+(?:\.\d{2})?)\s*Every month/);
    if (!m) return null;
    const price = Number(m[2]).toFixed(2);
    return { '@type': 'Offer', name: m[1].trim(), price, priceCurrency: 'GBP', availability: 'https://schema.org/InStock', url: pageUrl,
      validFrom: `${year}-01-01`, priceValidUntil: `${year + 1}-12-31`,
      priceSpecification: { '@type': 'UnitPriceSpecification', price, priceCurrency: 'GBP', billingDuration: 'P1M', unitText: 'MONTH' } };
  }

  const stars = (r) => Number(r.rating_numeric || r.ratingValue || r.rating || r.review_stars || 0);
  const bodyText = (r) => String(r.reviewBody || r.review || r.review_content || '').trim();
  const excluded = (r) => /^(true|yes|1)$/i.test(String(r.ingest_is_excluded || r.is_excluded || ''));

  /** aggregateRating + review list from the review rows for one slug (null when it has no rated review). */
  function ratingFromReviews(rows) {
    const rated = rows.filter((r) => !excluded(r) && stars(r) >= 1 && stars(r) <= 5);
    if (!rated.length) return null;
    const avg = rated.reduce((a, r) => a + stars(r), 0) / rated.length;
    const listed = rated.filter((r) => bodyText(r)).sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, MAX_LISTED_REVIEWS);
    return {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: String(Math.round(avg * 10) / 10), reviewCount: rated.length, bestRating: '5', worstRating: '1' },
      review: listed.map((r) => ({ '@type': 'Review', author: { '@type': 'Person', name: String(r.reviewer || r.review_username || 'Anonymous').trim() },
        reviewBody: bodyText(r), reviewRating: { '@type': 'Rating', ratingValue: String(stars(r)), bestRating: '5', worstRating: '1' },
        datePublished: String(r.date || '').slice(0, 10), publisher: { '@type': 'Organization', name: r.source || 'Google' } }))
    };
  }

  function sellingNode(graph, pageUrl, cfg, docs) {
    const id = `${pageUrl}#${cfg.node}`;
    let node = graph.find((n) => n && n['@id'] === id);
    if (!node && cfg.node === 'product') {
      const p = productNode(docs(cfg.offers.products[0]));
      if (!p) return null;
      node = { '@type': 'Product', '@id': id, name: p.name, description: p.description, image: p.image, brand: p.brand, url: pageUrl };
      graph.push(node);
    }
    return node || null;
  }

  /**
   * Selling page (SELLING_PAGES): offers / rating / reviews from live sources. sources: { products(fileName) → doc,
   * reviews(slug) → rows, html, year }. Returns [{ page, field, source }] — source 'missing' when no live source answered.
   */
  function applyLiveSelling(graph, pageUrl, sources) {
    const cfg = SELLING_PAGES[pageSlug(pageUrl)];
    if (!cfg) return [];
    const node = sellingNode(graph, pageUrl, cfg, sources.products);
    const page = pageSlug(pageUrl);
    if (!node) return [{ page, field: `#${cfg.node} node`, source: 'missing' }];
    const out = [];
    if (cfg.types) node['@type'] = [...new Set([...[].concat(node['@type'] || []), ...cfg.types])];
    if (cfg.offers) {
      const offers = cfg.offers.plan ? offerFromPlan(sources.html, pageUrl, sources.year) : offersFromProducts(cfg.offers, sources.products);
      if (offers) { node.offers = offers; out.push({ page, field: 'offers', source: cfg.offers.plan ? 'page membership plan' : `live product (${cfg.offers.products.length} product file${cfg.offers.products.length > 1 ? 's' : ''})` }); } else out.push({ page, field: 'offers', source: 'missing' });
    }
    if (cfg.reviews) {
      const rating = ratingFromReviews(sources.reviews(cfg.reviews));
      if (rating) { Object.assign(node, rating); out.push({ page, field: 'aggregateRating, review', source: `review DB (${rating.aggregateRating.reviewCount} rated)` }); } else out.push({ page, field: 'aggregateRating, review', source: 'missing' });
    } else {
      out.push({ page, field: 'aggregateRating, review', source: 'none — the page has no genuine reviews of its own' });
      delete node.aggregateRating;
      delete node.review;
    }
    return out;
  }

  return { buildItemList, summaryItems, storeItems, buildBreadcrumbList, youtubeIds, watchPageFields, buildVideoObjects,
    squarespaceWebSite, applyWebSiteFields, stripBusinessRating, businessRatingNodes, carryForwardSelling,
    applyLiveSelling, ratingFromReviews, offerFromPlan, SELLING_PAGES, REQUIRED_VIDEO_FIELDS };
});
