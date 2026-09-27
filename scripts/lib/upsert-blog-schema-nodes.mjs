/**
 * Upsert per-URL blog nodes into combined blog-schema.json by canonical @id.
 * Identity key: @id (fallback: url + @type). Never keyed by title.
 */
import fs from 'fs';
import path from 'path';

const TYPE_SUFFIX = {
  WebPage: '#webpage',
  BlogPosting: '#blogposting',
  BreadcrumbList: '#breadcrumb',
  FAQPage: '#faq',
  HowTo: '#howto',
  ImageObject: '#primaryimage'
};

export function normalizeUrl(raw) {
  if (!raw) return '';
  try {
    const u = new URL(String(raw).trim());
    u.hash = '';
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return String(raw).replace(/\/$/, '').split('#')[0];
  }
}

export function nodeKey(node) {
  if (!node || typeof node !== 'object') return '';
  if (node['@id']) return String(node['@id']).replace(/\/#/, '/#');
  const type = Array.isArray(node['@type']) ? node['@type'][0] : node['@type'];
  const url = normalizeUrl(node.url);
  const suffix = TYPE_SUFFIX[type];
  if (url && suffix) return `${url}${suffix}`;
  return '';
}

export function stripContext(node) {
  if (!node || typeof node !== 'object') return node;
  const { '@context': _c, ...rest } = node;
  return rest;
}

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function upsertNodes(graph, incomingNodes) {
  const byId = new Map();
  for (const n of graph) {
    const k = nodeKey(n);
    if (k) byId.set(k, n);
  }
  let upserted = 0;
  for (const raw of incomingNodes) {
    const n = stripContext(raw);
    const k = nodeKey(n);
    if (!k) continue;
    byId.set(k, n);
    upserted += 1;
  }
  return { graph: Array.from(byId.values()), upserted };
}

export function collectIndividualNodes(repoDir, slug) {
  const suffixes = [
    '_schema.json',
    '_blogposting.json',
    '_breadcrumb.json',
    '_faq.json',
    '_howto.json',
    '_image.json'
  ];
  const nodes = [];
  for (const suffix of suffixes) {
    const file = path.join(repoDir, `${slug}${suffix}`);
    if (!fs.existsSync(file)) continue;
    const doc = loadJson(file);
    if (doc['@graph'] && Array.isArray(doc['@graph'])) nodes.push(...doc['@graph']);
    else nodes.push(doc);
  }
  return nodes;
}

export function upsertSlugsIntoBlogSchema(repoDir, slugs) {
  const blogPath = path.join(repoDir, 'blog-schema.json');
  const blog = loadJson(blogPath);
  if (!blog['@graph'] || !Array.isArray(blog['@graph'])) {
    throw new Error('blog-schema.json missing @graph');
  }
  const incoming = [];
  for (const slug of slugs) incoming.push(...collectIndividualNodes(repoDir, slug));
  const { graph, upserted } = upsertNodes(blog['@graph'], incoming);
  blog['@graph'] = graph;
  fs.writeFileSync(blogPath, `${JSON.stringify(blog)}\n`, 'utf8');
  return { upserted, total: graph.length, blogPath };
}
