// Comprehensive validation of the blog schema output
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
  console.log('✅ JSON is valid and parseable\n');
} catch (e) {
  console.error('❌ JSON parse error:', e.message);
  process.exit(1);
}

const graph = schema['@graph'] || [];
const blogPostings = graph.filter(obj => obj && obj['@type'] === 'BlogPosting');

console.log(`=== COMPREHENSIVE VALIDATION ===\n`);
console.log(`Total BlogPosting objects: ${blogPostings.length}\n`);

// 1. Check for duplicates
const urlSet = new Set();
const idSet = new Set();
const duplicateUrls = [];
const duplicateIds = [];

blogPostings.forEach(post => {
  if (post.url) {
    if (urlSet.has(post.url)) {
      duplicateUrls.push(post.url);
    } else {
      urlSet.add(post.url);
    }
  }
  if (post['@id']) {
    if (idSet.has(post['@id'])) {
      duplicateIds.push(post['@id']);
    } else {
      idSet.add(post['@id']);
    }
  }
});

console.log('1. DUPLICATE CHECK:');
if (duplicateUrls.length > 0) {
  console.log(`   ❌ Found ${duplicateUrls.length} duplicate URLs`);
  duplicateUrls.slice(0, 5).forEach(url => console.log(`      ${url}`));
} else {
  console.log(`   ✅ No duplicate URLs (${urlSet.size} unique URLs)`);
}

if (duplicateIds.length > 0) {
  console.log(`   ❌ Found ${duplicateIds.length} duplicate @ids`);
  duplicateIds.slice(0, 5).forEach(id => console.log(`      ${id}`));
} else {
  console.log(`   ✅ No duplicate @ids (${idSet.size} unique @ids)`);
}

// 2. Check structure consistency
let invalidMainEntity = 0;
let invalidReadingTime = 0;
let invalidIsPartOf = 0;
let missingFields = 0;

const REQUIRED_FIELDS = ['@id', 'headline', 'url', 'datePublished', 'articleBody', 'description', 
                         'wordCount', 'timeRequired', 'readingTime', 'mainEntityOfPage', 
                         'publisher', 'author', 'isPartOf', 'alternativeHeadline', 'inLanguage',
                         'thumbnailUrl', 'primaryImageOfPage', 'speakable', 'learningResourceType',
                         'educationalLevel', 'educationalUse', 'audience', 'educationalAlignment'];

blogPostings.forEach((post, idx) => {
  // Check mainEntityOfPage structure
  if (post.mainEntityOfPage) {
    if (typeof post.mainEntityOfPage === 'string' || !post.mainEntityOfPage['@id']) {
      invalidMainEntity++;
      if (idx < 5) {
        console.log(`   Post ${idx + 1} (${post.url}): Invalid mainEntityOfPage`);
      }
    }
  } else {
    invalidMainEntity++;
  }
  
  // Check readingTime format
  if (post.readingTime && !post.readingTime.match(/^PT\d+[MH]$/)) {
    invalidReadingTime++;
    if (idx < 5) {
      console.log(`   Post ${idx + 1} (${post.url}): Invalid readingTime "${post.readingTime}"`);
    }
  }
  
  // Check isPartOf structure
  if (post.isPartOf) {
    if (typeof post.isPartOf === 'string' || !post.isPartOf['@id']) {
      invalidIsPartOf++;
      if (idx < 5) {
        console.log(`   Post ${idx + 1} (${post.url}): Invalid isPartOf`);
      }
    }
  } else {
    invalidIsPartOf++;
  }
  
  // Check required fields
  const missing = REQUIRED_FIELDS.filter(field => !(field in post) || !post[field]);
  if (missing.length > 0) {
    missingFields++;
    if (idx < 5) {
      console.log(`   Post ${idx + 1} (${post.url}): Missing ${missing.join(', ')}`);
    }
  }
});

console.log('\n2. STRUCTURE CONSISTENCY:');
console.log(`   mainEntityOfPage: ${invalidMainEntity === 0 ? '✅' : '❌'} ${blogPostings.length - invalidMainEntity}/${blogPostings.length} valid`);
console.log(`   readingTime: ${invalidReadingTime === 0 ? '✅' : '❌'} ${blogPostings.length - invalidReadingTime}/${blogPostings.length} valid`);
console.log(`   isPartOf: ${invalidIsPartOf === 0 ? '✅' : '❌'} ${blogPostings.length - invalidIsPartOf}/${blogPostings.length} valid`);
console.log(`   Required fields: ${missingFields === 0 ? '✅' : '❌'} ${blogPostings.length - missingFields}/${blogPostings.length} complete`);

// 3. Check for pollution in articleBody
let pollutedCount = 0;
const pollutionMarkers = ['/Cart', 'Sign In My Account', '[/cart]', 'Back photography', 'Cart 0'];

blogPostings.forEach((post, idx) => {
  if (post.articleBody) {
    const hasPollution = pollutionMarkers.some(marker => post.articleBody.includes(marker));
    if (hasPollution) {
      pollutedCount++;
      if (idx < 5) {
        console.log(`   Post ${idx + 1} (${post.url}): Contains pollution`);
      }
    }
  }
});

console.log('\n3. CONTENT QUALITY:');
console.log(`   articleBody pollution: ${pollutedCount === 0 ? '✅' : '❌'} ${blogPostings.length - pollutedCount}/${blogPostings.length} clean`);

// 4. Check JSON validity
try {
  const jsonString = JSON.stringify(schema);
  JSON.parse(jsonString);
  console.log(`\n4. JSON VALIDITY:`);
  console.log(`   ✅ Valid JSON (${(jsonString.length / 1024 / 1024).toFixed(2)} MB)`);
} catch (e) {
  console.log(`\n4. JSON VALIDITY:`);
  console.log(`   ❌ Invalid JSON: ${e.message}`);
}

// Final summary
console.log('\n=== FINAL SUMMARY ===');
const allPassed = duplicateUrls.length === 0 && 
                  duplicateIds.length === 0 && 
                  invalidMainEntity === 0 && 
                  invalidReadingTime === 0 && 
                  invalidIsPartOf === 0 && 
                  missingFields === 0 && 
                  pollutedCount === 0;

if (allPassed) {
  console.log('✅ ALL VALIDATIONS PASSED');
  console.log(`   - ${blogPostings.length} unique BlogPosting objects`);
  console.log(`   - All fields present and correctly structured`);
  console.log(`   - No duplicates, no pollution, valid JSON`);
  process.exit(0);
} else {
  console.log('❌ VALIDATION FAILED');
  console.log(`   - Duplicate URLs: ${duplicateUrls.length}`);
  console.log(`   - Duplicate @ids: ${duplicateIds.length}`);
  console.log(`   - Invalid mainEntityOfPage: ${invalidMainEntity}`);
  console.log(`   - Invalid readingTime: ${invalidReadingTime}`);
  console.log(`   - Invalid isPartOf: ${invalidIsPartOf}`);
  console.log(`   - Missing fields: ${missingFields}`);
  console.log(`   - Polluted articleBody: ${pollutedCount}`);
  process.exit(1);
}

