// Test the actual file the user saved: blog-schema (3).json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 TESTING blog-schema (3).json');
console.log('='.repeat(60));

const testSchemaPath = path.join(__dirname, 'outputs', 'blog-schema (3).json');

if (!fs.existsSync(testSchemaPath)) {
  console.error(`❌ File not found: ${testSchemaPath}`);
  process.exit(1);
}

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`❌ ERROR: ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`⚠️  WARNING: ${msg}`);
  warnings++;
}

function info(msg) {
  console.log(`✅ ${msg}`);
}

try {
  const content = fs.readFileSync(testSchemaPath, 'utf8');
  
  // Check for HTML encoding
  if (content.includes('&quot;')) {
    error('File contains HTML-encoded quotes (&quot;) - this will cause Google Rich Results Test to fail!');
  }
  
  const schema = JSON.parse(content);
  
  const blogPostings = schema['@graph'].filter(obj => obj && obj['@type'] === 'BlogPosting');
  console.log(`\n📊 Testing ${blogPostings.length} BlogPosting objects\n`);
  
  // Test 1: mainEntityOfPage
  console.log('=== TEST 1: mainEntityOfPage ===');
  let mainEntityFail = 0;
  blogPostings.forEach((post, idx) => {
    if (!post.mainEntityOfPage || typeof post.mainEntityOfPage === 'string' || post.mainEntityOfPage['@type'] !== 'WebPage') {
      if (mainEntityFail < 5) error(`Post ${idx + 1} (${post.url}): mainEntityOfPage must be WebPage object`);
      mainEntityFail++;
    }
  });
  if (mainEntityFail === 0) {
    info(`All ${blogPostings.length} posts have correct mainEntityOfPage`);
  } else {
    error(`${mainEntityFail}/${blogPostings.length} posts failed`);
  }
  
  // Test 2: isPartOf
  console.log('\n=== TEST 2: isPartOf ===');
  let isPartOfFail = 0;
  blogPostings.forEach((post, idx) => {
    if (!post.isPartOf || typeof post.isPartOf === 'string' || post.isPartOf['@type'] !== 'WebSite') {
      if (isPartOfFail < 5) error(`Post ${idx + 1} (${post.url}): isPartOf must be WebSite object`);
      isPartOfFail++;
    }
  });
  if (isPartOfFail === 0) {
    info(`All ${blogPostings.length} posts have correct isPartOf`);
  } else {
    error(`${isPartOfFail}/${blogPostings.length} posts failed`);
  }
  
  // Test 3: Image
  console.log('\n=== TEST 3: Image Object ===');
  let imageFail = 0;
  blogPostings.forEach((post, idx) => {
    if (!post.image || typeof post.image === 'string' || post.image['@type'] !== 'ImageObject') {
      if (imageFail < 5) error(`Post ${idx + 1} (${post.url}): image must be ImageObject`);
      imageFail++;
    }
  });
  if (imageFail === 0) {
    info(`All ${blogPostings.length} posts have correct image`);
  } else {
    error(`${imageFail}/${blogPostings.length} posts failed`);
  }
  
  // Test 4: Author @id
  console.log('\n=== TEST 4: Author @id ===');
  let authorFail = 0;
  blogPostings.forEach((post, idx) => {
    if (!post.author || !post.author['@id']) {
      if (authorFail < 5) error(`Post ${idx + 1} (${post.url}): Author missing @id`);
      authorFail++;
    }
  });
  if (authorFail === 0) {
    info(`All ${blogPostings.length} posts have author @id`);
  } else {
    error(`${authorFail}/${blogPostings.length} posts failed`);
  }
  
  // Test 5: URL normalization
  console.log('\n=== TEST 5: URL Normalization ===');
  let urlFail = 0;
  blogPostings.forEach((post, idx) => {
    if (post.url && post.url.endsWith('/')) {
      if (urlFail < 5) error(`Post ${idx + 1}: URL has trailing slash: ${post.url}`);
      urlFail++;
    }
  });
  if (urlFail === 0) {
    info(`All ${blogPostings.length} posts have normalized URLs`);
  } else {
    error(`${urlFail}/${blogPostings.length} posts have trailing slashes`);
  }
  
  // Test 6: Assignments
  console.log('\n=== TEST 6: Assignments ===');
  const assignments = blogPostings.filter(post => 
    post.learningResourceType === 'Practice Assignment' || /assignment/i.test(post.url || '')
  );
  let assignmentFail = 0;
  assignments.forEach((post, idx) => {
    if (!post.teaches || post.teaches === '') {
      if (assignmentFail < 5) error(`Assignment ${idx + 1} (${post.url}): Missing teaches`);
      assignmentFail++;
    }
  });
  if (assignmentFail === 0 && assignments.length > 0) {
    info(`All ${assignments.length} assignments have teaches`);
  } else if (assignments.length === 0) {
    warn('No assignments found');
  } else {
    error(`${assignmentFail}/${assignments.length} assignments missing teaches`);
  }
  
  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('=== FINAL SUMMARY ===');
  console.log(`Total Errors: ${errors}`);
  console.log(`Total Warnings: ${warnings}`);
  
  if (errors === 0) {
    console.log('\n✅ ALL TESTS PASSED!');
    console.log('\n📋 Next: Copy JSON and paste into Google Rich Results Test');
    process.exit(0);
  } else {
    console.log(`\n❌ VALIDATION FAILED - ${errors} error(s) found`);
    process.exit(1);
  }
  
} catch (e) {
  console.error(`\n❌ FATAL ERROR: ${e.message}`);
  if (e.message.includes('JSON')) {
    console.error('\n⚠️  JSON parse error - file may be corrupted or have syntax errors');
  }
  process.exit(1);
}

