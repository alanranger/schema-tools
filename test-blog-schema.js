// Comprehensive test suite for blog-schema.txt
// This test MUST fail on ANY issue - no exceptions
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

// Test 3: One BlogPosting per URL
function testOneBlogPostingPerURL(blogPostings, itemList) {
  console.log('\n=== TEST 3: ONE BLOGPOSTING PER URL ===');
  
  const urlToPostings = new Map();
  const idToPostings = new Map();
  
  blogPostings.forEach(post => {
    if (post.url) {
      if (!urlToPostings.has(post.url)) {
        urlToPostings.set(post.url, []);
      }
      urlToPostings.get(post.url).push(post);
    }
    
    if (post['@id']) {
      if (!idToPostings.has(post['@id'])) {
        idToPostings.set(post['@id'], []);
      }
      idToPostings.get(post['@id']).push(post);
    }
  });
  
  // Check for duplicate URLs
  const duplicateUrls = Array.from(urlToPostings.entries()).filter(([url, posts]) => posts.length > 1);
  if (duplicateUrls.length > 0) {
    duplicateUrls.forEach(([url, posts]) => {
      error(`URL "${url}" appears ${posts.length} times (expected 1)`);
    });
  } else {
    info(`✅ No duplicate URLs (${urlToPostings.size} unique URLs)`);
  }
  
  // Check for duplicate @ids
  const duplicateIds = Array.from(idToPostings.entries()).filter(([id, posts]) => posts.length > 1);
  if (duplicateIds.length > 0) {
    duplicateIds.forEach(([id, posts]) => {
      error(`@id "${id}" appears ${posts.length} times (expected 1)`);
    });
  } else {
    info(`✅ No duplicate @ids (${idToPostings.size} unique @ids)`);
  }
  
  // Get expected URLs from ItemList
  const expectedUrls = new Set();
  if (itemList && itemList.itemListElement && Array.isArray(itemList.itemListElement)) {
    itemList.itemListElement.forEach(item => {
      if (item.url) expectedUrls.add(item.url);
    });
  }
  
  // Check if all expected URLs have BlogPostings
  expectedUrls.forEach(url => {
    if (!urlToPostings.has(url)) {
      error(`URL "${url}" in ItemList has no matching BlogPosting`);
    }
  });
  
  // Check if all BlogPosting URLs are in ItemList
  urlToPostings.forEach((posts, url) => {
    if (!expectedUrls.has(url)) {
      warn(`BlogPosting URL "${url}" not found in ItemList`);
    }
  });
  
  return urlToPostings;
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

// Test 5: Image Object Completeness
function testImageCompleteness(blogPostings) {
  console.log('\n=== TEST 5: IMAGE OBJECT COMPLETENESS ===');
  
  let postsWithCompleteImages = 0;
  let postsWithIncompleteImages = 0;
  
  blogPostings.forEach((post, idx) => {
    if (!post.image) {
      error(`Post ${idx + 1} (${post.url || 'no URL'}): Missing image object`);
      postsWithIncompleteImages++;
      return;
    }
    
    const image = post.image;
    const issues = [];
    
    if (image['@type'] !== 'ImageObject') {
      issues.push('@type must be "ImageObject"');
    }
    if (!image.url || image.url === '') {
      issues.push('missing url');
    }
    if (!image.width || typeof image.width !== 'number') {
      issues.push('missing or invalid width (must be number)');
    }
    if (!image.height || typeof image.height !== 'number') {
      issues.push('missing or invalid height (must be number)');
    }
    // caption is optional but recommended
    // representativeOfPage is optional
    
    if (issues.length > 0) {
      postsWithIncompleteImages++;
      if (idx < 10) {
        error(`Post ${idx + 1} (${post.url || 'no URL'}): Image incomplete: ${issues.join(', ')}`);
      }
    } else {
      postsWithCompleteImages++;
    }
    
    // Check thumbnailUrl
    if (!post.thumbnailUrl || post.thumbnailUrl === '') {
      error(`Post ${idx + 1} (${post.url || 'no URL'}): Missing thumbnailUrl`);
    }
    
    // Check primaryImageOfPage
    if (!post.primaryImageOfPage) {
      error(`Post ${idx + 1} (${post.url || 'no URL'}): Missing primaryImageOfPage`);
    } else if (!post.primaryImageOfPage['@id']) {
      error(`Post ${idx + 1} (${post.url || 'no URL'}): primaryImageOfPage must have @id`);
    }
  });
  
  if (postsWithIncompleteImages > 0) {
    error(`${postsWithIncompleteImages}/${blogPostings.length} posts have incomplete image objects`);
  } else {
    info(`✅ All ${blogPostings.length} posts have complete image objects`);
  }
  
  return postsWithIncompleteImages === 0;
}

// Test 6: Valid ISO Durations
function testISODurations(blogPostings) {
  console.log('\n=== TEST 6: VALID ISO DURATIONS ===');
  
  const iso8601Pattern = /^PT[0-9]+M$/;
  let postsWithValidDurations = 0;
  let postsWithInvalidDurations = 0;
  
  blogPostings.forEach((post, idx) => {
    const issues = [];
    
    if (!post.timeRequired) {
      issues.push('timeRequired missing');
    } else if (!iso8601Pattern.test(post.timeRequired)) {
      issues.push(`timeRequired invalid: "${post.timeRequired}" (must match ^PT[0-9]+M$)`);
    }
    
    if (!post.readingTime) {
      issues.push('readingTime missing');
    } else if (!iso8601Pattern.test(post.readingTime)) {
      issues.push(`readingTime invalid: "${post.readingTime}" (must match ^PT[0-9]+M$)`);
    }
    
    // Check for common mistakes
    if (post.timeRequired && post.timeRequired.match(/^\d+M$/)) {
      issues.push(`timeRequired missing "PT" prefix: "${post.timeRequired}"`);
    }
    if (post.readingTime && post.readingTime.match(/^\d+M$/)) {
      issues.push(`readingTime missing "PT" prefix: "${post.readingTime}"`);
    }
    
    if (issues.length > 0) {
      postsWithInvalidDurations++;
      if (idx < 10) {
        error(`Post ${idx + 1} (${post.url || 'no URL'}): ${issues.join(', ')}`);
      }
    } else {
      postsWithValidDurations++;
    }
  });
  
  if (postsWithInvalidDurations > 0) {
    error(`${postsWithInvalidDurations}/${blogPostings.length} posts have invalid ISO 8601 durations`);
  } else {
    info(`✅ All ${blogPostings.length} posts have valid ISO 8601 durations`);
  }
  
  return postsWithInvalidDurations === 0;
}

// Test 7: ArticleBody Cleaning
function testArticleBodyCleaning(blogPostings) {
  console.log('\n=== TEST 7: ARTICLEBODY CLEANING ===');
  
  // Use regex patterns for more precise matching (word boundaries, etc.)
  const pollutionPatterns = [
    { pattern: /Cart\s+0/i, name: 'Cart 0' },
    { pattern: /Cart\s+\d+/i, name: 'Cart number' },
    { pattern: /My Account/i, name: 'My Account' },
    { pattern: /Sign In/i, name: 'Sign In' },
    { pattern: /\/search\b/i, name: '/search' },
    { pattern: /^search\b/i, name: 'search at start' },
    { pattern: /searchBack/i, name: 'searchBack' },
    { pattern: /\bsearch\s+Back/i, name: 'search Back' },
    { pattern: /^Home\b/i, name: 'Home at start' }, // Only "Home" at start (likely navigation)
    { pattern: /Newsletter/i, name: 'Newsletter' },
    // Only flag "Subscribe" at end (likely footer/navigation)
    { pattern: /Subscribe\s*$/i, name: 'Subscribe at end' },
    { pattern: /Cookie/i, name: 'Cookie' },
    { pattern: /GDPR/i, name: 'GDPR' },
    { pattern: /Footer/i, name: 'Footer' },
    { pattern: /related posts/i, name: 'related posts' },
    { pattern: /All posts/i, name: 'All posts' },
    // Only flag "previous post" / "next post" at end (likely navigation)
    { pattern: /previous post\s*$/i, name: 'previous post at end' },
    { pattern: /next post\s*$/i, name: 'next post at end' },
    { pattern: /\/Cart/i, name: '/Cart' },
    { pattern: /\[\/cart\]/i, name: '[/cart]' },
    { pattern: /Back\s+photography/i, name: 'Back photography' }
  ];
  
  let cleanPosts = 0;
  let pollutedPosts = 0;
  
  blogPostings.forEach((post, idx) => {
    if (!post.articleBody || post.articleBody.trim() === '') {
      error(`Post ${idx + 1} (${post.url || 'no URL'}): articleBody is empty`);
      pollutedPosts++;
      return;
    }
    
    const foundPollution = pollutionPatterns.filter(({ pattern }) => 
      pattern.test(post.articleBody)
    ).map(({ name }) => name);
    
    if (foundPollution.length > 0) {
      pollutedPosts++;
      // Always show first 10 errors to help debug
      if (pollutedPosts <= 10) {
        error(`Post ${idx + 1} (${post.url || 'no URL'}): articleBody contains pollution: ${foundPollution.join(', ')}`);
      }
    } else {
      cleanPosts++;
    }
  });
  
  if (pollutedPosts > 0) {
    error(`${pollutedPosts}/${blogPostings.length} posts have polluted articleBody`);
  } else {
    info(`✅ All ${blogPostings.length} posts have clean articleBody`);
  }
  
  return pollutedPosts === 0;
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

// Test 9: BlogPosting Linking
function testBlogPostingLinking(blogPostings) {
  console.log('\n=== TEST 9: BLOGPOSTING LINKING ===');
  
  let validLinks = 0;
  let invalidLinks = 0;
  
  blogPostings.forEach((post, idx) => {
    const issues = [];
    
    // Check mainEntityOfPage
    if (!post.mainEntityOfPage) {
      issues.push('missing mainEntityOfPage');
    } else if (typeof post.mainEntityOfPage === 'string') {
      issues.push('mainEntityOfPage is string, must be WebPage object');
    } else if (!post.mainEntityOfPage['@id']) {
      issues.push('mainEntityOfPage missing @id');
    } else if (!post.mainEntityOfPage['@id'].endsWith('#webpage')) {
      issues.push(`mainEntityOfPage @id should end with "#webpage", got "${post.mainEntityOfPage['@id']}"`);
    }
    
    // Check isPartOf
    if (!post.isPartOf) {
      issues.push('missing isPartOf');
    } else if (typeof post.isPartOf === 'string') {
      issues.push('isPartOf is string, must be Blog object');
    } else if (!post.isPartOf['@id']) {
      issues.push('isPartOf missing @id');
    } else if (!post.isPartOf['@id'].endsWith('#blog')) {
      issues.push(`isPartOf @id should end with "#blog", got "${post.isPartOf['@id']}"`);
    }
    
    // Check discussionUrl
    if (!post.discussionUrl || post.discussionUrl === '') {
      issues.push('missing discussionUrl');
    } else if (!post.discussionUrl.endsWith('#comments')) {
      issues.push(`discussionUrl should end with "#comments", got "${post.discussionUrl}"`);
    }
    
    // Check URL consistency
    if (post.url && post['@id']) {
      const expectedId = `${post.url}#blogposting`;
      if (post['@id'] !== expectedId) {
        issues.push(`@id mismatch: expected "${expectedId}", got "${post['@id']}"`);
      }
    }
    
    if (issues.length > 0) {
      invalidLinks++;
      if (idx < 10) {
        error(`Post ${idx + 1} (${post.url || 'no URL'}): ${issues.join(', ')}`);
      }
    } else {
      validLinks++;
    }
  });
  
  if (invalidLinks > 0) {
    error(`${invalidLinks}/${blogPostings.length} posts have invalid linking`);
  } else {
    info(`✅ All ${blogPostings.length} posts have valid linking`);
  }
  
  return invalidLinks === 0;
}

// Test 10: Google SDTT Mimic Check
function testGoogleSDTT(blogPostings) {
  console.log('\n=== TEST 10: GOOGLE SDTT MIMIC CHECK ===');
  
  let validForGoogle = 0;
  let invalidForGoogle = 0;
  
  blogPostings.forEach((post, idx) => {
    const issues = [];
    
    // @type must be BlogPosting
    if (post['@type'] !== 'BlogPosting') {
      issues.push('@type must be "BlogPosting"');
    }
    
    // Required fields for Google
    if (!post.headline || post.headline.trim() === '') {
      issues.push('headline missing or empty');
    }
    
    if (!post.description || post.description.trim() === '') {
      issues.push('description missing or empty');
    }
    
    if (!post.image || !post.image.url) {
      issues.push('image missing or has no URL');
    }
    
    if (!post.publisher || !post.publisher['@type'] || post.publisher['@type'] !== 'Organization') {
      issues.push('publisher missing or not Organization object');
    }
    
    if (!post.datePublished) {
      issues.push('datePublished missing');
    }
    
    if (issues.length > 0) {
      invalidForGoogle++;
      if (idx < 10) {
        warn(`Post ${idx + 1} (${post.url || 'no URL'}): Google SDTT issues: ${issues.join(', ')}`);
      }
    } else {
      validForGoogle++;
    }
  });
  
  if (invalidForGoogle > 0) {
    warn(`${invalidForGoogle}/${blogPostings.length} posts may fail Google Rich Results validation`);
  } else {
    info(`✅ All ${blogPostings.length} posts pass Google SDTT mimic check`);
  }
  
  return invalidForGoogle === 0;
}

// Main test runner
function runAllTests() {
  console.log('🧪 COMPREHENSIVE BLOG SCHEMA TEST SUITE');
  console.log('='.repeat(60));
  
  const schemaPath = path.join(__dirname, 'outputs', 'blog-schema.txt');
  
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
  const { websites, organizations, blogs, itemLists, blogPostings } = testGraphStructure(schema);
  
  if (itemLists.length === 0) {
    error('No ItemList found - cannot continue');
    process.exit(1);
  }
  
  // Test 3: One BlogPosting per URL
  testOneBlogPostingPerURL(blogPostings, itemLists[0]);
  
  // Test 4: Required Fields
  testRequiredFields(blogPostings);
  
  // Test 5: Image Completeness
  testImageCompleteness(blogPostings);
  
  // Test 6: ISO Durations
  testISODurations(blogPostings);
  
  // Test 7: ArticleBody Cleaning
  testArticleBodyCleaning(blogPostings);
  
  // Test 8: Publisher/Author Objects
  testPublisherAuthorObjects(blogPostings);
  
  // Test 9: BlogPosting Linking
  testBlogPostingLinking(blogPostings);
  
  // Test 10: Google SDTT
  testGoogleSDTT(blogPostings);
  
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
    console.log('The generator must be fixed before the schema can be used.');
    process.exit(1);
  }
}

// Run tests
runAllTests();

