#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertBlogSchemaIndexOnly,
  collectIndividualNodes,
  upsertNodes,
  upsertSlugsIntoBlogSchema
} from './lib/upsert-blog-schema-nodes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.join(root, 'alanranger-schema');
const blogFile = path.join(repo, 'blog-schema.json');
const productSlug = 'beginners-photography-course-3-weekly-evening-classes';
const postSlug = 'student-photo-essay';

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function testGuard() {
  assertBlogSchemaIndexOnly({
    '@context': 'https://schema.org',
    '@graph': [{ '@type': 'Blog', '@id': 'https://www.alanranger.com/blog-on-photography#blog' }]
  });
  for (const t of ['Product', 'Event', 'BlogPosting', 'FAQPage', 'HowTo']) {
    assert.throws(
      () => assertBlogSchemaIndexOnly({ '@graph': [{ '@type': t }] }),
      /REFUSING to write/
    );
  }
  console.log('guard: ok');
}

function dryRun(label, fileNames) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-schema-dry-'));
  fs.copyFileSync(blogFile, path.join(tmp, 'blog-schema.json'));
  for (const name of fileNames) {
    const src = path.join(repo, name);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmp, name));
  }
  const before = sha256(path.join(tmp, 'blog-schema.json'));
  const incoming = collectIndividualNodes(tmp, fileNames[0].replace(/_[a-z0-9]+\.json$/i, ''));
  const bloated = upsertNodes(JSON.parse(fs.readFileSync(path.join(tmp, 'blog-schema.json'), 'utf8'))['@graph'], incoming);
  assert.ok(bloated.upserted > 0, `${label}: old upsert would add nodes`);
  try {
    upsertSlugsIntoBlogSchema(tmp, ['dry-run']);
    throw new Error(`${label}: upsert should have thrown`);
  } catch (e) {
    assert.match(String(e.message), /REFUSING to upsert/);
  }
  const after = sha256(path.join(tmp, 'blog-schema.json'));
  assert.equal(after, before, `${label}: test copy of blog-schema.json must stay byte-identical`);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${label}: ok hash=${before.slice(0, 12)} upsert-would-add=${bloated.upserted}`);
}

testGuard();
dryRun('product-deploy', [`${productSlug}_schema.json`, `${productSlug}_faq.json`]);
dryRun('blog-post-deploy', [`${postSlug}_blogposting.json`]);
console.log('ok');
