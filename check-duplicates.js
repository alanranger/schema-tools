// Check for duplicate BlogPosting objects in the output
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, 'outputs', 'blog-schema.txt');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

// Extract JSON from script tags if present
let jsonText = schemaContent;
if (schemaContent.includes('<script')) {
  const match = schemaContent.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  if (match) {
    jsonText = match[1].trim();
  }
}

let schema;
try {
  schema = JSON.parse(jsonText);
} catch (e) {
  console.error('❌ Failed to parse JSON:', e.message);
  process.exit(1);
}

const graph = schema['@graph'] || [];
const blogPostings = graph.filter(obj => obj && obj['@type'] === 'BlogPosting');

console.log(`Total BlogPosting objects: ${blogPostings.length}\n`);

// Check for duplicate URLs
const urlCounts = new Map();
const idCounts = new Map();

blogPostings.forEach((post, idx) => {
  const url = post.url;
  const id = post['@id'];
  
  if (url) {
    urlCounts.set(url, (urlCounts.get(url) || 0) + 1);
  }
  if (id) {
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }
});

// Find duplicates
const duplicateUrls = Array.from(urlCounts.entries()).filter(([url, count]) => count > 1);
const duplicateIds = Array.from(idCounts.entries()).filter(([id, count]) => count > 1);

console.log('=== DUPLICATE CHECK ===');
if (duplicateUrls.length > 0) {
  console.log(`❌ Found ${duplicateUrls.length} URLs with multiple BlogPosting objects:`);
  duplicateUrls.forEach(([url, count]) => {
    console.log(`   ${url}: ${count} occurrences`);
  });
} else {
  console.log('✅ No duplicate URLs found');
}

if (duplicateIds.length > 0) {
  console.log(`❌ Found ${duplicateIds.length} @ids with multiple BlogPosting objects:`);
  duplicateIds.forEach(([id, count]) => {
    console.log(`   ${id}: ${count} occurrences`);
  });
} else {
  console.log('✅ No duplicate @ids found');
}

// Check for missing fields
console.log('\n=== FIELD COMPLETENESS CHECK ===');
const REQUIRED_FIELDS = ['description', 'articleBody', 'wordCount', 'timeRequired', 'readingTime', 
                         'inLanguage', 'genre', 'articleSection', 'author', 'publisher', 'isPartOf'];

let missingFields = 0;
let invalidReadingTime = 0;
let invalidMainEntity = 0;
let pollutedArticleBody = 0;

blogPostings.forEach((post, idx) => {
  const missing = REQUIRED_FIELDS.filter(field => !(field in post) || !post[field]);
  if (missing.length > 0) {
    missingFields++;
    if (idx < 5) {
      console.log(`Post ${idx + 1} (${post.url}): Missing ${missing.join(', ')}`);
    }
  }
  
  // Check readingTime format
  if (post.readingTime && !post.readingTime.match(/^PT\d+[MH]$/)) {
    invalidReadingTime++;
    if (idx < 5) {
      console.log(`Post ${idx + 1} (${post.url}): Invalid readingTime "${post.readingTime}"`);
    }
  }
  
  // Check mainEntityOfPage structure
  if (post.mainEntityOfPage) {
    if (typeof post.mainEntityOfPage === 'string' || !post.mainEntityOfPage['@id']) {
      invalidMainEntity++;
      if (idx < 5) {
        console.log(`Post ${idx + 1} (${post.url}): Invalid mainEntityOfPage structure`);
      }
    }
  }
  
  // Check for pollution in articleBody
  if (post.articleBody) {
    const pollutionMarkers = ['/Cart', 'Sign In My Account', '[/cart]', 'Back photography'];
    if (pollutionMarkers.some(marker => post.articleBody.includes(marker))) {
      pollutedArticleBody++;
      if (idx < 5) {
        console.log(`Post ${idx + 1} (${post.url}): articleBody contains navigation pollution`);
      }
    }
  }
});

console.log(`\nSummary:`);
console.log(`Posts missing required fields: ${missingFields}/${blogPostings.length}`);
console.log(`Posts with invalid readingTime format: ${invalidReadingTime}/${blogPostings.length}`);
console.log(`Posts with invalid mainEntityOfPage: ${invalidMainEntity}/${blogPostings.length}`);
console.log(`Posts with polluted articleBody: ${pollutedArticleBody}/${blogPostings.length}`);

if (duplicateUrls.length === 0 && duplicateIds.length === 0 && missingFields === 0 && 
    invalidReadingTime === 0 && invalidMainEntity === 0 && pollutedArticleBody === 0) {
  console.log('\n✅ ALL CHECKS PASSED');
} else {
  console.log('\n❌ ISSUES FOUND');
}

