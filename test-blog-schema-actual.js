// Test the actual blog-schema (1).json file
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let totalErrors = 0;
let totalWarnings = 0;

function error(message) {
  console.error(`❌ ERROR: ${message}`);
  totalErrors++;
}

function warn(message) {
  console.warn(`⚠️  WARNING: ${message}`);
  totalWarnings++;
}

function info(message) {
  console.log(`ℹ️  ${message}`);
}

// Test 1: JSON Validity
function testJSONValidity(schemaPath) {
  console.log('\n=== TEST 1: JSON VALIDITY ===');
  
  const content = fs.readFileSync(schemaPath, 'utf8');
  
  // Check for stray text/HTML
  if (content.includes('<html') || content.includes('<!DOCTYPE')) {
    error('File contains HTML markup');
  }
  
  // Extract JSON from script tags if present
  let jsonText = content;
  if (content.includes('<script')) {
    const match = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (match) {
      jsonText = match[1].trim();
    } else {
      error('File contains <script> tag but no closing tag');
      return null;
    }
  }
  
  // Check for common JSON issues
  if (jsonText.includes('undefined')) {
    error('JSON contains "undefined" (should be removed)');
  }
  
  let schema;
  try {
    schema = JSON.parse(jsonText);
    info('JSON parses successfully');
  } catch (e) {
    error(`JSON parse failed: ${e.message}`);
    // Try to find the error position
    if (e.message.includes('position')) {
      const match = e.message.match(/position (\d+)/);
      if (match) {
        const pos = parseInt(match[1]);
        const start = Math.max(0, pos - 100);
        const end = Math.min(jsonText.length, pos + 100);
        console.error(`Context around error: ${jsonText.substring(start, end)}`);
      }
    }
    return null;
  }
  
  // Check structure
  if (!schema['@context'] || schema['@context'] !== 'https://schema.org') {
    error('Missing or invalid @context (must be "https://schema.org")');
  }
  
  if (!schema['@graph'] || !Array.isArray(schema['@graph'])) {
    error('Missing or invalid @graph (must be an array)');
  }
  
  return schema;
}

// Test 2: Graph Structure
function testGraphStructure(schema) {
  console.log('\n=== TEST 2: GRAPH STRUCTURE ===');
  
  const graph = schema['@graph'] || [];
  
  const websites = graph.filter(obj => obj && obj['@type'] === 'WebSite');
  const organizations = graph.filter(obj => obj && obj['@type'] === 'Organization');
  const blogs = graph.filter(obj => obj && obj['@type'] === 'Blog');
  const itemLists = graph.filter(obj => obj && obj['@type'] === 'ItemList');
  const blogPostings = graph.filter(obj => obj && obj['@type'] === 'BlogPosting');
  
  if (websites.length !== 1) {
    error(`Expected 1 WebSite, found ${websites.length}`);
  } else {
    info(`WebSite: ✅ (1 found)`);
  }
  
  if (organizations.length !== 1) {
    error(`Expected 1 Organization, found ${organizations.length}`);
  } else {
    info(`Organization: ✅ (1 found)`);
  }
  
  if (blogs.length !== 1) {
    error(`Expected 1 Blog, found ${blogs.length}`);
  } else {
    info(`Blog: ✅ (1 found)`);
  }
  
  if (itemLists.length !== 1) {
    error(`Expected 1 ItemList, found ${itemLists.length}`);
  } else {
    info(`ItemList: ✅ (1 found)`);
  }
  
  info(`BlogPosting: ${blogPostings.length} found`);
  
  return { websites, organizations, blogs, itemLists, blogPostings };
}

// Test 4: All Required Fields Exist
function testRequiredFields(blogPostings) {
  console.log('\n=== TEST 4: REQUIRED FIELDS ===');
  
  const REQUIRED_FIELDS = [
    '@id',
    '@type',
    'headline',
    'alternativeHeadline',
    'description',
    'articleBody',
    'wordCount',
    'timeRequired',
    'readingTime',
    'datePublished',
    'dateModified',
    'dateCreated',
    'mainEntityOfPage',
    'url',
    'inLanguage',
    'genre',
    'articleSection',
    'keywords',
    'about',
    'mentions',
    'image',
    'thumbnailUrl',
    'primaryImageOfPage',
    'discussionUrl',
    'isPartOf',
    'publisher',
    'author',
    'learningResourceType',
    'educationalLevel',
    'educationalUse',
    'audience',
    'educationalAlignment',
    'copyrightYear',
    'copyrightHolder',
    'speakable'
  ];
  
  let postsWithAllFields = 0;
  let postsMissingFields = 0;
  
  blogPostings.forEach((post, idx) => {
    const missing = [];
    const empty = [];
    const wrongType = [];
    
    REQUIRED_FIELDS.forEach(field => {
      if (!(field in post)) {
        missing.push(field);
      } else {
        const value = post[field];
        
        // Check for empty/null
        if (value === null || value === undefined) {
          empty.push(field);
        } else if (value === '') {
          empty.push(field);
        } else if (Array.isArray(value) && value.length === 0 && ['keywords', 'about', 'mentions'].includes(field)) {
          // Arrays can be empty for these fields
        } else if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
          empty.push(field);
        }
        
        // Type checks
        if (field === '@type' && value !== 'BlogPosting') {
          wrongType.push(`${field} (expected "BlogPosting", got "${value}")`);
        }
        if (field === 'inLanguage' && value !== 'en-GB') {
          wrongType.push(`${field} (expected "en-GB", got "${value}")`);
        }
        if (field === 'wordCount' && typeof value !== 'number') {
          wrongType.push(`${field} (expected number, got ${typeof value})`);
        }
        if (field === 'keywords' && !Array.isArray(value)) {
          wrongType.push(`${field} (expected array, got ${typeof value})`);
        }
        if (field === 'about' && !Array.isArray(value)) {
          wrongType.push(`${field} (expected array, got ${typeof value})`);
        }
        if (field === 'mentions' && !Array.isArray(value)) {
          wrongType.push(`${field} (expected array, got ${typeof value})`);
        }
      }
    });
    
    if (missing.length > 0 || empty.length > 0 || wrongType.length > 0) {
      postsMissingFields++;
      if (idx < 10) { // Only show first 10 errors
        if (missing.length > 0) {
          error(`Post ${idx + 1} (${post.url || 'no URL'}): Missing fields: ${missing.join(', ')}`);
        }
        if (empty.length > 0) {
          error(`Post ${idx + 1} (${post.url || 'no URL'}): Empty fields: ${empty.join(', ')}`);
        }
        if (wrongType.length > 0) {
          error(`Post ${idx + 1} (${post.url || 'no URL'}): Wrong type: ${wrongType.join(', ')}`);
        }
      }
    } else {
      postsWithAllFields++;
    }
  });
  
  if (postsMissingFields > 0) {
    error(`${postsMissingFields}/${blogPostings.length} posts missing required fields or have empty/wrong-type values`);
  } else {
    info(`✅ All ${blogPostings.length} posts have all required fields with valid values`);
  }
  
  return postsWithAllFields === blogPostings.length;
}

// Test 8: Publisher/Author Objects
function testPublisherAuthorObjects(blogPostings) {
  console.log('\n=== TEST 8: PUBLISHER/AUTHOR OBJECTS ===');
  
  let validPublishers = 0;
  let invalidPublishers = 0;
  let validAuthors = 0;
  let invalidAuthors = 0;
  
  blogPostings.forEach((post, idx) => {
    // Check publisher
    if (!post.publisher) {
      error(`Post ${idx + 1} (${post.url || 'no URL'}): Missing publisher`);
      invalidPublishers++;
    } else if (typeof post.publisher === 'string' || (post.publisher['@id'] && !post.publisher['@type'])) {
      error(`Post ${idx + 1} (${post.url || 'no URL'}): publisher is @id reference, must be full Organization object`);
      invalidPublishers++;
    } else if (post.publisher['@type'] !== 'Organization') {
      error(`Post ${idx + 1} (${post.url || 'no URL'}): publisher @type must be "Organization"`);
      invalidPublishers++;
    } else if (!post.publisher.name) {
      error(`Post ${idx + 1} (${post.url || 'no URL'}): publisher missing name`);
      invalidPublishers++;
    } else {
      validPublishers++;
    }
    
    // Check author
    if (!post.author) {
      error(`Post ${idx + 1} (${post.url || 'no URL'}): Missing author`);
      invalidAuthors++;
    } else if (typeof post.author === 'string' || (post.author['@id'] && !post.author['@type'])) {
      error(`Post ${idx + 1} (${post.url || 'no URL'}): author is @id reference, must be full Person object`);
      invalidAuthors++;
    } else if (post.author['@type'] !== 'Person') {
      error(`Post ${idx + 1} (${post.url || 'no URL'}): author @type must be "Person"`);
      invalidAuthors++;
    } else if (!post.author.name) {
      error(`Post ${idx + 1} (${post.url || 'no URL'}): author missing name`);
      invalidAuthors++;
    } else {
      validAuthors++;
    }
  });
  
  if (invalidPublishers > 0) {
    error(`${invalidPublishers}/${blogPostings.length} posts have invalid publisher objects`);
  } else {
    info(`✅ All ${blogPostings.length} posts have valid publisher objects`);
  }
  
  if (invalidAuthors > 0) {
    error(`${invalidAuthors}/${blogPostings.length} posts have invalid author objects`);
  } else {
    info(`✅ All ${blogPostings.length} posts have valid author objects`);
  }
  
  return invalidPublishers === 0 && invalidAuthors === 0;
}

// Main test runner
function runAllTests() {
  console.log('🧪 TESTING blog-schema (1).json');
  console.log('='.repeat(60));
  
  const schemaPath = path.join(__dirname, 'outputs', 'blog-schema (1).json');
  
  if (!fs.existsSync(schemaPath)) {
    error(`Schema file not found: ${schemaPath}`);
    process.exit(1);
  }
  
  // Test 1: JSON Validity
  const schema = testJSONValidity(schemaPath);
  if (!schema) {
    console.error('\n❌ Cannot continue - JSON is invalid');
    process.exit(1);
  }
  
  // Test 2: Graph Structure
  const { blogPostings } = testGraphStructure(schema);
  
  // Test 4: Required Fields
  testRequiredFields(blogPostings);
  
  // Test 8: Publisher/Author Objects
  testPublisherAuthorObjects(blogPostings);
  
  // Final Summary
  console.log('\n' + '='.repeat(60));
  console.log('=== FINAL SUMMARY ===');
  console.log(`Total Errors: ${totalErrors}`);
  console.log(`Total Warnings: ${totalWarnings}`);
  
  if (totalErrors === 0) {
    console.log('\n✅ ALL TESTS PASSED - Schema is valid and complete');
    process.exit(0);
  } else {
    console.log(`\n❌ TESTS FAILED - ${totalErrors} error(s) found`);
    process.exit(1);
  }
}

// Run tests
runAllTests();

