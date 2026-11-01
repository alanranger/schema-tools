import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deletedBlogPosts, planDeletedPostCleanup, removeBlogPostFiles, removeStaleProductSchemaFiles } from './lib/stale-schema-cleanup.mjs';

const PRODUCT = JSON.stringify({ '@graph': [{ '@type': 'Product', offers: { price: '1' } }] });
const BLOG = JSON.stringify({ '@type': 'WebPage' });

function repo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-'));
  for (const [f, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), body);
  return dir;
}

test('a renamed product loses its old _schema.json AND its _faq.json; a dropped FAQ is removed; manifest-referenced files are kept', () => {
  const dir = repo({
    'walk-23-29-oct_schema.json': PRODUCT, 'walk-23-29-oct_faq.json': '{}',
    'walk-23-31-oct_schema.json': PRODUCT, 'walk-23-31-oct_faq.json': '{}',
    'tripod_schema.json': PRODUCT, 'tripod_faq.json': '{}',
    'kept_schema.json': PRODUCT, 'kept_faq.json': '{}',
    'a-blog-post_schema.json': BLOG, 'a-blog-post_faq.json': '{}',
    'products-manifest.json': JSON.stringify({ entries: [{ schemaFileName: 'kept_schema.json', faqFileName: 'kept_faq.json' }] })
  });
  const deleted = removeStaleProductSchemaFiles(dir, ['walk-23-31-oct_schema.json', 'walk-23-31-oct_faq.json', 'tripod_schema.json', 'kept_schema.json']);
  assert.deepEqual(deleted.sort(), ['tripod_faq.json', 'walk-23-29-oct_faq.json', 'walk-23-29-oct_schema.json']);
  for (const f of ['walk-23-31-oct_faq.json', 'kept_faq.json', 'a-blog-post_schema.json', 'a-blog-post_faq.json']) assert.ok(fs.existsSync(path.join(dir, f)), `${f} kept`);
});

test('deleted blog posts: posts in neither the feed nor the sitemap; at most 5 removed per run, the rest to Needs Alan; all 6 files go', () => {
  const files = ['live_blogposting.json', 'gone-a_blogposting.json', 'gone-a_schema.json', 'gone-a_faq.json', 'only-sitemap_blogposting.json'];
  assert.deepEqual(deletedBlogPosts(files, ['live'], ['only-sitemap']), ['gone-a']);
  const plan = planDeletedPostCleanup(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  assert.deepEqual(plan.remove, ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(plan.needsAlan, ['f', 'g']);
  const dir = repo({ 'gone_schema.json': '{}', 'gone_blogposting.json': '{}', 'gone_breadcrumb.json': '{}', 'gone_image.json': '{}', 'gone_faq.json': '{}', 'gone_howto.json': '{}', 'other_schema.json': '{}' });
  assert.equal(removeBlogPostFiles(dir, 'gone').length, 6);
  assert.deepEqual(fs.readdirSync(dir), ['other_schema.json']);
});
