// Test script to validate ALL patch plan requirements
// Run this after generating blog-schema-test.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 TESTING ALL PATCH PLAN REQUIREMENTS');
console.log('='.repeat(60));

const testSchemaPath = path.join(__dirname, 'outputs', 'blog-schema-test.json');

if (!fs.existsSync(testSchemaPath)) {
  console.error(`❌ Test schema not found: ${testSchemaPath}`);
  console.error('\n📋 Steps:');
  console.error('   1. Generate blog schema in the tool');
  console.error('   2. Click "🧪 Save TEST Version" button');
  console.error('   3. Run this validation script');
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
  const schema = JSON.parse(content);
  
  const blogPostings = schema['@graph'].filter(obj => obj && obj['@type'] === 'BlogPosting');
  console.log(`\n📊 Testing ${blogPostings.length} BlogPosting objects\n`);
  
  // Test each requirement
  let passedTests = 0;
  let failedTests = 0;
  
  // 🔥 1. mainEntityOfPage must be WebPage object
  console.log('=== TEST 1: mainEntityOfPage ===');
  let mainEntityPass = 0;
  let mainEntityFail = 0;
  blogPostings.forEach((post, idx) => {
    if (!post.mainEntityOfPage) {
      if (mainEntityFail < 5) error(`Post ${idx + 1} (${post.url}): Missing mainEntityOfPage`);
      mainEntityFail++;
    } else if (typeof post.mainEntityOfPage === 'string') {
      if (mainEntityFail < 5) error(`Post ${idx + 1} (${post.url}): mainEntityOfPage is string, must be object`);
      mainEntityFail++;
    } else if (post.mainEntityOfPage['@type'] !== 'WebPage') {
      if (mainEntityFail < 5) error(`Post ${idx + 1} (${post.url}): mainEntityOfPage missing @type: "WebPage"`);
      mainEntityFail++;
    } else if (!post.mainEntityOfPage['@id']) {
      if (mainEntityFail < 5) error(`Post ${idx + 1} (${post.url}): mainEntityOfPage missing @id`);
      mainEntityFail++;
    } else {
      mainEntityPass++;
    }
  });
  if (mainEntityFail === 0) {
    info(`All ${mainEntityPass} posts have correct mainEntityOfPage (WebPage object)`);
    passedTests++;
  } else {
    error(`${mainEntityFail}/${blogPostings.length} posts failed mainEntityOfPage test`);
    failedTests++;
  }
  
  // 🔥 2. isPartOf must point to WebSite
  console.log('\n=== TEST 2: isPartOf ===');
  let isPartOfPass = 0;
  let isPartOfFail = 0;
  blogPostings.forEach((post, idx) => {
    if (!post.isPartOf) {
      if (isPartOfFail < 5) error(`Post ${idx + 1} (${post.url}): Missing isPartOf`);
      isPartOfFail++;
    } else if (typeof post.isPartOf === 'string') {
      if (isPartOfFail < 5) error(`Post ${idx + 1} (${post.url}): isPartOf is string, must be object`);
      isPartOfFail++;
    } else if (post.isPartOf['@type'] !== 'WebSite') {
      if (isPartOfFail < 5) error(`Post ${idx + 1} (${post.url}): isPartOf @type is "${post.isPartOf['@type']}", expected "WebSite"`);
      isPartOfFail++;
    } else if (!post.isPartOf['@id'] || !post.isPartOf['@id'].includes('#website')) {
      if (isPartOfFail < 5) error(`Post ${idx + 1} (${post.url}): isPartOf @id should end with #website`);
      isPartOfFail++;
    } else {
      isPartOfPass++;
    }
  });
  if (isPartOfFail === 0) {
    info(`All ${isPartOfPass} posts have correct isPartOf (WebSite object)`);
    passedTests++;
  } else {
    error(`${isPartOfFail}/${blogPostings.length} posts failed isPartOf test`);
    failedTests++;
  }
  
  // 🔥 3. Image must be ImageObject (not string)
  console.log('\n=== TEST 3: Image Object ===');
  let imagePass = 0;
  let imageFail = 0;
  blogPostings.forEach((post, idx) => {
    if (!post.image) {
      if (imageFail < 5) error(`Post ${idx + 1} (${post.url}): Missing image`);
      imageFail++;
    } else if (typeof post.image === 'string') {
      if (imageFail < 5) error(`Post ${idx + 1} (${post.url}): image is string, must be ImageObject`);
      imageFail++;
    } else if (post.image['@type'] !== 'ImageObject') {
      if (imageFail < 5) error(`Post ${idx + 1} (${post.url}): image missing @type: "ImageObject"`);
      imageFail++;
    } else if (!post.image.width || !post.image.height) {
      if (imageFail < 5) error(`Post ${idx + 1} (${post.url}): image missing width or height`);
      imageFail++;
    } else {
      imagePass++;
    }
  });
  if (imageFail === 0) {
    info(`All ${imagePass} posts have correct image (ImageObject with width/height)`);
    passedTests++;
  } else {
    error(`${imageFail}/${blogPostings.length} posts failed image test`);
    failedTests++;
  }
  
  // 🔥 4. thumbnailUrl
  console.log('\n=== TEST 4: thumbnailUrl ===');
  let thumbnailPass = 0;
  let thumbnailFail = 0;
  blogPostings.forEach((post, idx) => {
    if (!post.thumbnailUrl || post.thumbnailUrl === '') {
      if (thumbnailFail < 5) warn(`Post ${idx + 1} (${post.url}): Missing thumbnailUrl`);
      thumbnailFail++;
    } else {
      thumbnailPass++;
    }
  });
  if (thumbnailFail === 0) {
    info(`All ${thumbnailPass} posts have thumbnailUrl`);
    passedTests++;
  } else {
    warn(`${thumbnailFail}/${blogPostings.length} posts missing thumbnailUrl`);
  }
  
  // 🔥 5. inLanguage
  console.log('\n=== TEST 5: inLanguage ===');
  let langPass = 0;
  let langFail = 0;
  blogPostings.forEach((post, idx) => {
    if (!post.inLanguage || post.inLanguage !== 'en-GB') {
      if (langFail < 5) error(`Post ${idx + 1} (${post.url}): inLanguage is "${post.inLanguage}", expected "en-GB"`);
      langFail++;
    } else {
      langPass++;
    }
  });
  if (langFail === 0) {
    info(`All ${langPass} posts have correct inLanguage (en-GB)`);
    passedTests++;
  } else {
    error(`${langFail}/${blogPostings.length} posts failed inLanguage test`);
    failedTests++;
  }
  
  // 🔥 6. discussionUrl
  console.log('\n=== TEST 6: discussionUrl ===');
  let discussionPass = 0;
  let discussionFail = 0;
  blogPostings.forEach((post, idx) => {
    if (!post.discussionUrl || !post.discussionUrl.endsWith('#comments')) {
      if (discussionFail < 5) error(`Post ${idx + 1} (${post.url}): discussionUrl missing or doesn't end with #comments`);
      discussionFail++;
    } else {
      discussionPass++;
    }
  });
  if (discussionFail === 0) {
    info(`All ${discussionPass} posts have correct discussionUrl`);
    passedTests++;
  } else {
    error(`${discussionFail}/${blogPostings.length} posts failed discussionUrl test`);
    failedTests++;
  }
  
  // 🔥 7. keywords
  console.log('\n=== TEST 7: keywords ===');
  let keywordsPass = 0;
  let keywordsFail = 0;
  blogPostings.forEach((post, idx) => {
    if (!post.keywords || !Array.isArray(post.keywords)) {
      if (keywordsFail < 5) warn(`Post ${idx + 1} (${post.url}): keywords missing or not array`);
      keywordsFail++;
    } else {
      keywordsPass++;
    }
  });
  if (keywordsFail === 0) {
    info(`All ${keywordsPass} posts have keywords array`);
    passedTests++;
  } else {
    warn(`${keywordsFail}/${blogPostings.length} posts missing keywords`);
  }
  
  // 🔥 8. wordCount
  console.log('\n=== TEST 8: wordCount ===');
  let wordCountPass = 0;
  let wordCountFail = 0;
  blogPostings.forEach((post, idx) => {
    if (post.wordCount === undefined || post.wordCount === null || typeof post.wordCount !== 'number') {
      if (wordCountFail < 5) error(`Post ${idx + 1} (${post.url}): wordCount missing or not a number`);
      wordCountFail++;
    } else {
      wordCountPass++;
    }
  });
  if (wordCountFail === 0) {
    info(`All ${wordCountPass} posts have wordCount`);
    passedTests++;
  } else {
    error(`${wordCountFail}/${blogPostings.length} posts failed wordCount test`);
    failedTests++;
  }
  
  // 🔥 9. about
  console.log('\n=== TEST 9: about ===');
  let aboutPass = 0;
  let aboutFail = 0;
  blogPostings.forEach((post, idx) => {
    if (!post.about || !Array.isArray(post.about)) {
      if (aboutFail < 5) warn(`Post ${idx + 1} (${post.url}): about missing or not array`);
      aboutFail++;
    } else {
      aboutPass++;
    }
  });
  if (aboutFail === 0) {
    info(`All ${aboutPass} posts have about array`);
    passedTests++;
  } else {
    warn(`${aboutFail}/${blogPostings.length} posts missing about`);
  }
  
  // 🔥 10. mentions
  console.log('\n=== TEST 10: mentions ===');
  let mentionsPass = 0;
  let mentionsFail = 0;
  blogPostings.forEach((post, idx) => {
    if (!post.mentions || !Array.isArray(post.mentions)) {
      if (mentionsFail < 5) warn(`Post ${idx + 1} (${post.url}): mentions missing or not array`);
      mentionsFail++;
    } else {
      mentionsPass++;
    }
  });
  if (mentionsFail === 0) {
    info(`All ${mentionsPass} posts have mentions array`);
    passedTests++;
  } else {
    warn(`${mentionsFail}/${blogPostings.length} posts missing mentions`);
  }
  
  // 🔥 11. Assignments need teaches + learningResourceType
  console.log('\n=== TEST 11: Assignments (teaches + learningResourceType) ===');
  const assignments = blogPostings.filter(post => 
    post.learningResourceType === 'Practice Assignment' || 
    /assignment/i.test(post.url || '')
  );
  let assignmentPass = 0;
  let assignmentFail = 0;
  assignments.forEach((post, idx) => {
    if (!post.teaches || post.teaches === '') {
      if (assignmentFail < 5) error(`Assignment ${idx + 1} (${post.url}): Missing teaches field`);
      assignmentFail++;
    } else if (post.learningResourceType !== 'Practice Assignment') {
      if (assignmentFail < 5) error(`Assignment ${idx + 1} (${post.url}): learningResourceType is "${post.learningResourceType}", expected "Practice Assignment"`);
      assignmentFail++;
    } else {
      assignmentPass++;
    }
  });
  if (assignmentFail === 0 && assignments.length > 0) {
    info(`All ${assignmentPass} assignments have teaches and correct learningResourceType`);
    passedTests++;
  } else if (assignments.length === 0) {
    warn('No assignments found to test');
  } else {
    error(`${assignmentFail}/${assignments.length} assignments failed test`);
    failedTests++;
  }
  
  // 🔥 12. articleSection
  console.log('\n=== TEST 12: articleSection ===');
  let sectionPass = 0;
  let sectionFail = 0;
  blogPostings.forEach((post, idx) => {
    if (!post.articleSection || post.articleSection === '') {
      if (sectionFail < 5) warn(`Post ${idx + 1} (${post.url}): Missing articleSection`);
      sectionFail++;
    } else {
      sectionPass++;
    }
  });
  if (sectionFail === 0) {
    info(`All ${sectionPass} posts have articleSection`);
    passedTests++;
  } else {
    warn(`${sectionFail}/${blogPostings.length} posts missing articleSection`);
  }
  
  // 🔥 13. URL normalization (no trailing slash)
  console.log('\n=== TEST 13: URL Normalization ===');
  let urlPass = 0;
  let urlFail = 0;
  blogPostings.forEach((post, idx) => {
    if (post.url && post.url.endsWith('/')) {
      if (urlFail < 5) error(`Post ${idx + 1}: URL has trailing slash: ${post.url}`);
      urlFail++;
    } else {
      urlPass++;
    }
  });
  if (urlFail === 0) {
    info(`All ${urlPass} posts have normalized URLs (no trailing slash)`);
    passedTests++;
  } else {
    error(`${urlFail}/${blogPostings.length} posts have trailing slashes`);
    failedTests++;
  }
  
  // 🔥 14. Author must have @id
  console.log('\n=== TEST 14: Author @id ===');
  let authorPass = 0;
  let authorFail = 0;
  blogPostings.forEach((post, idx) => {
    if (!post.author || !post.author['@id']) {
      if (authorFail < 5) error(`Post ${idx + 1} (${post.url}): Author missing @id`);
      authorFail++;
    } else {
      authorPass++;
    }
  });
  if (authorFail === 0) {
    info(`All ${authorPass} posts have author with @id`);
    passedTests++;
  } else {
    error(`${authorFail}/${blogPostings.length} posts failed author @id test`);
    failedTests++;
  }
  
  // 🔥 15. Publisher logo must have width/height
  console.log('\n=== TEST 15: Publisher Logo ===');
  let logoPass = 0;
  let logoFail = 0;
  blogPostings.forEach((post, idx) => {
    if (!post.publisher || !post.publisher.logo) {
      if (logoFail < 5) error(`Post ${idx + 1} (${post.url}): Publisher missing logo`);
      logoFail++;
    } else if (!post.publisher.logo.width || !post.publisher.logo.height) {
      if (logoFail < 5) error(`Post ${idx + 1} (${post.url}): Publisher logo missing width or height`);
      logoFail++;
    } else {
      logoPass++;
    }
  });
  if (logoFail === 0) {
    info(`All ${logoPass} posts have publisher logo with width/height`);
    passedTests++;
  } else {
    error(`${logoFail}/${blogPostings.length} posts failed publisher logo test`);
    failedTests++;
  }
  
  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('=== FINAL SUMMARY ===');
  console.log(`Passed Tests: ${passedTests}`);
  console.log(`Failed Tests: ${failedTests}`);
  console.log(`Total Errors: ${errors}`);
  console.log(`Total Warnings: ${warnings}`);
  
  if (errors === 0 && failedTests === 0) {
    console.log('\n✅ ALL PATCH PLAN REQUIREMENTS PASSED!');
    console.log('\n📋 Schema is ready for Google Rich Results Test');
    process.exit(0);
  } else {
    console.log(`\n❌ VALIDATION FAILED - ${errors} error(s), ${failedTests} test(s) failed`);
    console.log('\n⚠️  DO NOT deploy until all errors are fixed!');
    process.exit(1);
  }
  
} catch (e) {
  console.error(`\n❌ FATAL ERROR: ${e.message}`);
  process.exit(1);
}

