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

  return { buildItemList, summaryItems, storeItems, buildBreadcrumbList, youtubeIds, watchPageFields, buildVideoObjects,
    squarespaceWebSite, applyWebSiteFields, stripBusinessRating, businessRatingNodes, REQUIRED_VIDEO_FIELDS };
});
