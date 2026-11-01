/**
 * Stale-file clean-up for the alanranger-schema repo, shared by the desktop app (main.js deploys) and the BAU Monthly
 * runner. Products and events: files a deploy no longer produces. Blog posts: posts no longer on the site.
 */
import fs from 'node:fs';
import path from 'node:path';

export function isLikelyProductSchemaJson(filePath) {
  try {
    const graph = JSON.parse(fs.readFileSync(filePath, 'utf-8'))?.['@graph'];
    return (Array.isArray(graph) ? graph : []).some((node) => [].concat(node?.['@type']).includes('Product') && !!node?.offers);
  } catch {
    return false;
  }
}

export function removeStaleEventSchemaFiles(schemaRepoPath, keepNames) {
  const keepSet = new Set(keepNames);
  const deleted = [];
  for (const fileName of fs.readdirSync(schemaRepoPath)) {
    if (!fileName.endsWith('_event_schema.json') && !fileName.endsWith('_event_faq.json')) continue;
    if (keepSet.has(fileName)) continue;
    fs.unlinkSync(path.join(schemaRepoPath, fileName));
    deleted.push(fileName);
    console.log(`🧹 Removed stale event schema file: ${fileName}`);
  }
  return deleted;
}

/** The FAQ beside a product schema goes when the schema goes, or when the deploy no longer includes it (FAQ dropped). */
function removeProductFaq(schemaRepoPath, schemaName, keepSet, deleted) {
  const faq = schemaName.replace(/_schema\.json$/, '_faq.json');
  if (keepSet.has(faq) || !fs.existsSync(path.join(schemaRepoPath, faq))) return;
  fs.unlinkSync(path.join(schemaRepoPath, faq));
  deleted.push(faq);
  console.log(`🧹 Removed stale product FAQ file: ${faq}`);
}

/** Files products-manifest.json points at (e.g. a FAQ kept because its fetch failed) are never removed. */
function manifestFiles(schemaRepoPath) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(schemaRepoPath, 'products-manifest.json'), 'utf-8'));
    return (m.entries || []).flatMap((e) => [e.schemaFileName, e.faqFileName]).filter(Boolean);
  } catch {
    return [];
  }
}

export function removeStaleProductSchemaFiles(schemaRepoPath, keepNames) {
  const keepSet = new Set([...keepNames, ...manifestFiles(schemaRepoPath)]);
  const deleted = [];
  const productSchemas = fs.readdirSync(schemaRepoPath)
    .filter((n) => n.endsWith('_schema.json') && !n.endsWith('_event_schema.json') && !n.endsWith('_landing_schema.json'))
    .filter((n) => isLikelyProductSchemaJson(path.join(schemaRepoPath, n)));
  for (const fileName of productSchemas) {
    if (!keepSet.has(fileName)) {
      fs.unlinkSync(path.join(schemaRepoPath, fileName));
      deleted.push(fileName);
      console.log(`🧹 Removed stale product schema file: ${fileName}`);
    }
    removeProductFaq(schemaRepoPath, fileName, keepSet, deleted);
  }
  return deleted;
}

// ---------- deleted blog posts ----------
export const BLOG_POST_SUFFIXES = ['_schema.json', '_blogposting.json', '_breadcrumb.json', '_image.json', '_faq.json', '_howto.json'];
export const MAX_DELETED_POSTS_PER_RUN = 5;

/** Posts with files in the repo (every post has a _blogposting.json) that are in neither the blog feed nor the sitemap. */
export function deletedBlogPosts(repoFiles, feedSlugs, sitemapSlugs) {
  const live = new Set([...feedSlugs, ...sitemapSlugs]);
  return [...new Set(repoFiles.filter((f) => f.endsWith('_blogposting.json')).map((f) => f.slice(0, -'_blogposting.json'.length)))]
    .filter((slug) => !live.has(slug)).sort();
}

/** At most MAX per run are removed; the rest go to Needs Alan. */
export function planDeletedPostCleanup(slugs, max = MAX_DELETED_POSTS_PER_RUN) {
  return { remove: slugs.slice(0, max), needsAlan: slugs.slice(max) };
}

export function removeBlogPostFiles(schemaRepoPath, slug) {
  const removed = BLOG_POST_SUFFIXES.map((s) => `${slug}${s}`).filter((f) => fs.existsSync(path.join(schemaRepoPath, f)));
  removed.forEach((f) => fs.unlinkSync(path.join(schemaRepoPath, f)));
  return removed;
}
