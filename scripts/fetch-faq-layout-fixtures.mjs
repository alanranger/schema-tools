/**
 * Pull article HTML for FAQ layout fixtures.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, '..', 'test', 'fixtures', 'faq-layouts');
mkdirSync(outDir, { recursive: true });

const slugs = process.argv.slice(2);
if (!slugs.length) {
  slugs.push('black-and-white-when-to-convert', 'uk-street-photography-ethics-guide');
}

function articleHtml(html) {
  const m = String(html).match(/<article\b[^>]*>[\s\S]*?<\/article>/i);
  return m ? m[0] : html;
}

for (const slug of slugs) {
  const url = `https://www.alanranger.com/blog-on-photography/${slug}`;
  const res = await fetch(url, {
    headers: { 'user-agent': 'SchemaToolsFaqFixture/1.0', accept: 'text/html' }
  });
  if (!res.ok) throw new Error(`${slug} HTTP ${res.status}`);
  const html = articleHtml(await res.text());
  const dest = join(outDir, `${slug}.html`);
  writeFileSync(dest, html, 'utf8');
  console.log(`wrote ${dest} (${html.length} chars)`);
}
