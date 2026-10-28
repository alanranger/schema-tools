/**
 * Blog index lists a post only when the URL is live on www.alanranger.com.
 * 404s and off-site redirects are skipped. 429 is retried and never treated as dead.
 */

export const BLOG_INDEX_ORG_ID = 'https://www.alanranger.com/#org';
export const BLOG_INDEX_WEBSITE_ID = 'https://www.alanranger.com/#website';
export const BLOG_INDEX_URL = 'https://www.alanranger.com/blog-on-photography';

export function isAlanRangerHost(host) {
  const h = String(host || '').toLowerCase().replace(/\.$/, '');
  return h === 'www.alanranger.com' || h === 'alanranger.com';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveLocation(currentUrl, location) {
  try {
    return new URL(location, currentUrl).toString();
  } catch {
    return '';
  }
}

export async function probeBlogPostLive(url, opts = {}) {
  const fetchFn = opts.fetch || fetch;
  const wait = opts.sleep || sleep;
  let current = String(url || '').trim();
  if (!current) return { live: false, reason: 'empty-url', url };

  for (let hop = 0; hop < 5; hop++) {
    let status = 0;
    let location = '';
    let saw429 = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await fetchFn(current, { method: 'GET', redirect: 'manual', cache: 'no-store' });
        status = res.status;
        location = res.headers.get('location') || '';
        if (status !== 429) break;
        saw429 = true;
        await wait(1000 * 2 ** attempt);
      } catch (err) {
        if (attempt === 4) {
          if (saw429) return { live: true, reason: '429-kept', url: current };
          return { live: false, reason: `fetch-error: ${err.message}`, url: current };
        }
        await wait(1000 * 2 ** attempt);
      }
    }
    if (status === 429) return { live: true, reason: '429-kept', url: current };
    if (status >= 300 && status < 400) {
      const next = resolveLocation(current, location);
      if (!next) return { live: false, reason: `redirect-missing-location (${status})`, url: current };
      let host = '';
      try { host = new URL(next).hostname; } catch { /* ignore */ }
      if (!isAlanRangerHost(host)) {
        return { live: false, reason: `off-site-redirect ${status} ${next}`, url: current };
      }
      current = next;
      continue;
    }
    if (status === 404 || status === 410) {
      return { live: false, reason: `not-found (${status})`, url: current };
    }
    if (status >= 200 && status < 300) {
      let host = '';
      try { host = new URL(current).hostname; } catch { /* ignore */ }
      if (!isAlanRangerHost(host)) {
        return { live: false, reason: `off-site-200 ${current}`, url: current };
      }
      return { live: true, reason: 'ok', url: current.replace(/\/$/, '') };
    }
    return { live: false, reason: `http-${status}`, url: current };
  }
  return { live: false, reason: 'too-many-redirects', url: current };
}

export function buildBlogIndexGraph(livePosts) {
  const posts = Array.isArray(livePosts) ? livePosts : [];
  const sorted = [...posts].sort((a, b) => String(b.datePublished || '').localeCompare(String(a.datePublished || '')));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog',
        '@id': `${BLOG_INDEX_URL}#blog`,
        name: 'Alan Ranger Photography Blog',
        description: 'Photography tutorials, assignments, tips, techniques and case studies.',
        inLanguage: 'en-GB',
        publisher: { '@id': BLOG_INDEX_ORG_ID },
        author: {
          '@type': 'Person',
          name: 'Alan Ranger',
          url: 'https://www.alanranger.com/about-alan-ranger'
        },
        blogPost: posts.map((p) => ({ '@id': p['@id'] }))
      },
      {
        '@type': 'ItemList',
        '@id': `${BLOG_INDEX_URL}#itemlist`,
        itemListOrder: 'Descending',
        itemListElement: sorted.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: p.url
        }))
      },
      {
        '@type': 'WebPage',
        '@id': `${BLOG_INDEX_URL}#webpage`,
        url: BLOG_INDEX_URL,
        name: 'Photography Blog',
        inLanguage: 'en-GB',
        isPartOf: { '@id': BLOG_INDEX_WEBSITE_ID }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${BLOG_INDEX_URL}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.alanranger.com' },
          { '@type': 'ListItem', position: 2, name: 'Photography Blog', item: BLOG_INDEX_URL }
        ]
      }
    ]
  };
}

export function validateBlogIndexSchema(schema, liveCount) {
  const errors = [];
  const graph = Array.isArray(schema && schema['@graph']) ? schema['@graph'] : [];
  const types = graph.map((n) => n && n['@type']);
  if (!schema || schema['@context'] !== 'https://schema.org') errors.push('Missing or invalid @context');
  if (graph.length !== 4) errors.push(`Expected 4 index nodes, got ${graph.length}`);
  ['Blog', 'ItemList', 'WebPage', 'BreadcrumbList'].forEach((t) => {
    if (!types.includes(t)) errors.push(`Missing ${t}`);
  });
  const forbidden = ['BlogPosting', 'Product', 'Event', 'FAQPage', 'HowTo'];
  if (types.some((t) => forbidden.includes(t))) {
    errors.push('Index must not contain BlogPosting/Product/Event/FAQPage/HowTo nodes');
  }
  const blob = JSON.stringify(schema);
  if (blob.includes('#organization') || /alanranger\.com#website(\b|$)/.test(blob)) {
    errors.push('Non-canonical @id (use /#org and /#website)');
  }
  const blogNode = graph.find((n) => n && n['@type'] === 'Blog');
  if ((blogNode && blogNode.publisher && blogNode.publisher['@id']) !== BLOG_INDEX_ORG_ID) {
    errors.push('Blog.publisher must reference /#org');
  }
  const webPage = graph.find((n) => n && n['@type'] === 'WebPage');
  if ((webPage && webPage.isPartOf && webPage.isPartOf['@id']) !== BLOG_INDEX_WEBSITE_ID) {
    errors.push('WebPage.isPartOf must reference /#website');
  }
  const itemList = graph.find((n) => n && n['@type'] === 'ItemList');
  const listed = itemList && Array.isArray(itemList.itemListElement) ? itemList.itemListElement.length : 0;
  if (listed !== liveCount) errors.push(`ItemList count ${listed} !== live posts ${liveCount}`);
  return { valid: errors.length === 0, errors, livePosts: liveCount, itemList: listed, nodes: graph.length };
}
