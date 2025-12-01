// Validate the actual output file to ensure all required fields are present
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REQUIRED_FIELDS = [
  '@type',
  '@id',
  'headline',
  'alternativeHeadline',
  'description',
  'url',
  'mainEntityOfPage',
  'datePublished',
  'dateCreated',
  'dateModified',
  'inLanguage',
  'articleBody',
  'wordCount',
  'timeRequired',
  'readingTime',
  'genre',
  'articleSection',
  'keywords',
  'learningResourceType',
  'educationalLevel',
  'proficiencyLevel',
  'typicalAgeRange',
  'educationalUse',
  'estimatedCost',
  'audience',
  'educationalAlignment',
  'about',
  'mentions',
  'hasPart',
  'image',
  'thumbnailUrl',
  'primaryImageOfPage',
  'speakable',
  'discussionUrl',
  'author',
  'publisher',
  'isPartOf',
  'copyrightHolder',
  'copyrightYear',
  'sameAs',
  'relatedLink',
  'subjectOf',
  'isRelatedTo',
  'interactionStatistic',
  'commentCount',
  'funding'
];

function validateBlogPosting(post, index) {
  const errors = [];
  const warnings = [];
  const missing = [];
  
  REQUIRED_FIELDS.forEach(field => {
    if (!(field in post)) {
      missing.push(field);
      errors.push(`Missing: ${field}`);
    } else {
      const value = post[field];
      
      // Check for undefined/null
      if (value === undefined || value === null) {
        errors.push(`${field} is undefined or null`);
      }
      
      // Specific validations
      if (field === 'inLanguage' && value !== 'en-GB') {
        errors.push(`${field} must be "en-GB", got: ${value}`);
      }
      
      if (field === 'readingTime' && !value.match(/^PT\d+[MH]$/)) {
        errors.push(`${field} must be ISO 8601 format (PT4M), got: ${value}`);
      }
      
      if (field === 'author' && (!value['@type'] || value['@type'] !== 'Person')) {
        errors.push(`${field} must be full Person object`);
      }
      
      if (field === 'primaryImageOfPage' && (!value['@id'])) {
        errors.push(`${field} must have @id reference`);
      }
      
      if (field === 'isPartOf' && (!value['@id'])) {
        errors.push(`${field} must have @id reference`);
      }
      
      // Check arrays are arrays
      if (['keywords', 'about', 'mentions', 'hasPart', 'sameAs', 'relatedLink', 'isRelatedTo'].includes(field)) {
        if (!Array.isArray(value)) {
          errors.push(`${field} must be an array, got: ${typeof value}`);
        }
      }
    }
  });
  
  return { errors, warnings, missing, fieldCount: Object.keys(post).length };
}

// Read and parse the schema file
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

console.log('=== VALIDATING BLOG SCHEMA OUTPUT ===\n');

// Get all BlogPosting objects
const graph = schema['@graph'] || [];
const blogPostings = graph.filter(obj => obj && obj['@type'] === 'BlogPosting');

console.log(`Found ${blogPostings.length} BlogPosting objects\n`);

if (blogPostings.length === 0) {
  console.error('❌ No BlogPosting objects found!');
  process.exit(1);
}

// Validate first 10 posts in detail
const postsToValidate = blogPostings.slice(0, 10);
let totalErrors = 0;
let totalMissing = 0;
let postsWithAllFields = 0;

postsToValidate.forEach((post, idx) => {
  const validation = validateBlogPosting(post, idx);
  
  if (validation.errors.length === 0 && validation.missing.length === 0) {
    postsWithAllFields++;
  } else {
    console.log(`Post ${idx + 1} (${post.url || 'no URL'}):`);
    if (validation.missing.length > 0) {
      console.log(`  ❌ Missing fields: ${validation.missing.join(', ')}`);
      totalMissing += validation.missing.length;
    }
    if (validation.errors.length > 0) {
      validation.errors.slice(0, 5).forEach(err => console.log(`  ❌ ${err}`));
      if (validation.errors.length > 5) {
        console.log(`  ... and ${validation.errors.length - 5} more errors`);
      }
      totalErrors += validation.errors.length;
    }
    console.log(`  Fields: ${validation.fieldCount}/${REQUIRED_FIELDS.length}`);
    console.log('');
  }
});

// Quick check on all posts for critical fields
let postsMissingCritical = 0;
const criticalFields = ['@id', 'headline', 'url', 'datePublished', 'articleBody', 'description', 
                       'wordCount', 'timeRequired', 'readingTime', 'mainEntityOfPage', 
                       'publisher', 'author', 'alternativeHeadline', 'inLanguage', 
                       'thumbnailUrl', 'primaryImageOfPage', 'speakable', 'learningResourceType',
                       'educationalLevel', 'educationalUse', 'audience', 'educationalAlignment',
                       'isPartOf'];

blogPostings.forEach(post => {
  const missingCritical = criticalFields.filter(field => !(field in post));
  if (missingCritical.length > 0) {
    postsMissingCritical++;
  }
});

console.log('=== VALIDATION SUMMARY ===');
console.log(`Posts validated in detail: ${postsToValidate.length}`);
console.log(`Posts with all required fields: ${postsWithAllFields}/${postsToValidate.length}`);
console.log(`Total errors found: ${totalErrors}`);
console.log(`Total missing fields: ${totalMissing}`);
console.log(`\nAll ${blogPostings.length} posts - Critical fields check:`);
console.log(`Posts missing critical fields: ${postsMissingCritical}/${blogPostings.length}`);

// Check readingTime format across all posts
const readingTimeIssues = [];
blogPostings.forEach((post, idx) => {
  if (post.readingTime && !post.readingTime.match(/^PT\d+[MH]$/)) {
    readingTimeIssues.push({ index: idx + 1, url: post.url, value: post.readingTime });
  }
});

if (readingTimeIssues.length > 0) {
  console.log(`\n❌ readingTime format issues: ${readingTimeIssues.length}`);
  readingTimeIssues.slice(0, 5).forEach(issue => {
    console.log(`   Post ${issue.index}: "${issue.value}" (should be PT4M format)`);
  });
} else {
  console.log(`\n✅ All readingTime values are in ISO 8601 format (PT4M)`);
}

// Final verdict
if (totalErrors === 0 && totalMissing === 0 && postsMissingCritical === 0 && readingTimeIssues.length === 0) {
  console.log('\n✅ VALIDATION PASSED - All required fields are present and correct!');
  process.exit(0);
} else {
  console.log('\n❌ VALIDATION FAILED - Issues found');
  process.exit(1);
}

