/**
 * Read-only fetch of the live Squarespace collection feeds + sitemap.
 * Paced 6s between requests; 45s back-off on 429.
 */
import fs from 'node:fs';
import path from 'node:path';
import { FEEDS, ORIGIN, fetchText, sleep } from './lib.mjs';

const GAP = 6000;

async function getJson(url) {
  const text = await fetchText(url);
  await sleep(GAP);
  return JSON.parse(text);
}

async function fetchBlog() {
  const items = [];
  let url = `${ORIGIN}/blog-on-photography?format=json`;
  let pages = 0;
  while (url) {
    const j = await getJson(url);
    pages += 1;
    items.push(...(j.items || []));
    const next = j.pagination?.nextPage ? j.pagination.nextPageUrl : null;
    url = next ? `${ORIGIN}${next}${next.includes('?') ? '&' : '?'}format=json` : null;
  }
  return { pages, items };
}

async function fetchCollection(slug) {
  const j = await getJson(`${ORIGIN}/${slug}?format=json`);
  return {
    collection: { id: j.collection?.id, urlId: j.collection?.urlId, title: j.collection?.title },
    items: j.items || [],
    upcoming: j.upcoming || [],
    past: j.past || [],
    pagination: j.pagination || null
  };
}

function save(name, data) {
  fs.writeFileSync(path.join(FEEDS, `${name}.json`), JSON.stringify(data), 'utf8');
  const n = (data.items?.length || 0) + (data.upcoming?.length || 0) + (data.past?.length || 0);
  console.log(`${name}: ${n} records`);
}

fs.mkdirSync(FEEDS, { recursive: true });
save('blog-on-photography', await fetchBlog());
for (const slug of ['beginners-photography-lessons', 'photographic-workshops-near-me', 'photography-services-near-me', 'photo-workshops-uk']) {
  save(slug, await fetchCollection(slug));
}
const sitemap = await fetchText(`${ORIGIN}/sitemap.xml`);
fs.writeFileSync(path.join(FEEDS, 'sitemap.xml'), sitemap, 'utf8');
console.log(`sitemap: ${(sitemap.match(/<loc>/g) || []).length} URLs`);
fs.writeFileSync(path.join(FEEDS, 'FETCHED-AT.txt'), new Date().toISOString(), 'utf8');
