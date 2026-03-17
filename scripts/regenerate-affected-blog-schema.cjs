const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SCHEMA_DIR = path.join(ROOT, 'alanranger-schema');
const SHARED_BLOG_SCHEMA = path.join(ROOT, '..', 'alan-shared-resources', 'outputs', 'schema', 'blog', 'blog-schema.json');

function stripSocialShareNoise(text) {
  if (!text) return '';
  return String(text)
    .replace(/([A-Za-z])(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/gi, '$1 $2')
    .replace(/(\d{4})([A-Za-z])/g, '$1 $2')
    .replace(/\b(Facebook|LinkedIn|Pinterest|Tumblr|Twitter|Reddit)\s*0\b/gi, ' ')
    .replace(/\b(Facebook|LinkedIn|Pinterest|Tumblr|Twitter|Reddit)\b/gi, ' ')
    .replace(/\bAlan\s+Ranger\s*\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi, ' ')
    .replace(/\b(?:field\s+)?checklist\b/gi, ' ')
    .replace(/\b0\s*Likes?\b/gi, ' ')
    .replace(/\b(?:share|shares?)\b/gi, ' ')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' ')
    .replace(/%2F|%3A|%3F|%26|%3D|%5B|%5D/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDescription(value) {
  if (!value || typeof value !== 'string') return value;
  let text = stripSocialShareNoise(value);
  text = text.replace(/^[\-\s,.;:!?]+/, '').replace(/[\s,.;:!?]+$/, '');
  if (text && !/[.!?]$/.test(text)) text += '.';
  if (text.length > 160) {
    const cut = text.slice(0, 160);
    const lastSpace = cut.lastIndexOf(' ');
    text = (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim();
    if (!/[.!?]$/.test(text)) text += '.';
  }
  return text;
}

function cleanArticleBody(value) {
  if (!value || typeof value !== 'string') return value;
  return stripSocialShareNoise(value).replace(/\s+/g, ' ').trim();
}

function containsJunk(value) {
  if (!value || typeof value !== 'string') return false;
  return /(linkedin(?:\s*0)?|pinterest(?:\s*0)?|reddit(?:\s*0)?|facebook(?:\s*0)?|tumblr|twitter|0\s*likes?|%2f|%3a|composition checklist)/i.test(value);
}

function visitAndClean(node, stats) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((item) => visitAndClean(item, stats));
    return;
  }

  if (typeof node.description === 'string' && containsJunk(node.description)) {
    const before = node.description;
    const after = cleanDescription(before);
    const fallback = String(node.headline || node.name || '').trim();
    const final = (after && after.length >= 20) ? after : (fallback ? `${fallback.replace(/[.!?]+$/, '')}.` : after);
    if (final && final !== before) {
      node.description = final;
      stats.descriptionFixes += 1;
    }
  }

  if (typeof node.articleBody === 'string' && containsJunk(node.articleBody)) {
    const before = node.articleBody;
    const after = cleanArticleBody(before);
    if (after && after !== before) {
      node.articleBody = after;
      stats.articleBodyFixes += 1;
    }
  }

  for (const key of Object.keys(node)) {
    visitAndClean(node[key], stats);
  }
}

function processJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(raw);
  const stats = { descriptionFixes: 0, articleBodyFixes: 0 };
  visitAndClean(json, stats);
  if (stats.descriptionFixes || stats.articleBodyFixes) {
    fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  }
  return stats;
}

function isBlogSchemaFile(fileName) {
  return fileName === 'blog-schema.json' || fileName.endsWith('_schema.json') || fileName.endsWith('_blogposting.json');
}

function main() {
  if (!fs.existsSync(SCHEMA_DIR)) {
    throw new Error(`Schema directory not found: ${SCHEMA_DIR}`);
  }

  let filesTouched = 0;
  let totalDescFixes = 0;
  let totalBodyFixes = 0;

  const files = fs.readdirSync(SCHEMA_DIR).filter(isBlogSchemaFile);
  files.forEach((fileName) => {
    const full = path.join(SCHEMA_DIR, fileName);
    try {
      const stats = processJsonFile(full);
      if (stats.descriptionFixes || stats.articleBodyFixes) {
        filesTouched += 1;
        totalDescFixes += stats.descriptionFixes;
        totalBodyFixes += stats.articleBodyFixes;
        console.log(`Updated ${fileName}: description=${stats.descriptionFixes}, articleBody=${stats.articleBodyFixes}`);
      }
    } catch (error) {
      console.warn(`Skipped ${fileName}: ${error.message}`);
    }
  });

  if (fs.existsSync(SHARED_BLOG_SCHEMA)) {
    try {
      const stats = processJsonFile(SHARED_BLOG_SCHEMA);
      if (stats.descriptionFixes || stats.articleBodyFixes) {
        filesTouched += 1;
        totalDescFixes += stats.descriptionFixes;
        totalBodyFixes += stats.articleBodyFixes;
        console.log(`Updated shared blog-schema.json: description=${stats.descriptionFixes}, articleBody=${stats.articleBodyFixes}`);
      }
    } catch (error) {
      console.warn(`Skipped shared blog-schema.json: ${error.message}`);
    }
  }

  console.log(`Done. Files touched: ${filesTouched}, description fixes: ${totalDescFixes}, articleBody fixes: ${totalBodyFixes}`);
}

main();
