// Comprehensive test to verify all required schema fields and structure
// This tests what SHOULD be in the schema based on requirements

const REQUIRED_BLOGPOSTING_FIELDS = [
  // Core identity
  '@type',
  '@id',
  'headline',
  'alternativeHeadline',
  'description',
  'url',
  'mainEntityOfPage',
  'inLanguage',
  
  // Dates
  'datePublished',
  'dateCreated',
  'dateModified',
  
  // Content
  'articleBody',
  'wordCount',
  'timeRequired',
  'readingTime',
  
  // Classification
  'genre',
  'articleSection',
  'keywords',
  
  // Educational
  'learningResourceType',
  'educationalLevel',
  'proficiencyLevel',
  'typicalAgeRange',
  'educationalUse',
  'estimatedCost',
  'audience',
  'educationalAlignment',
  
  // Entities
  'about',
  'mentions',
  'hasPart', // Optional but should exist for assignments
  
  // Images
  'image',
  'thumbnailUrl',
  'primaryImageOfPage',
  
  // Metadata
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
  'funding',
  'citation', // Optional - only for RPS content
  'backstory', // Optional - only for case studies
];

const REQUIRED_TOP_LEVEL_OBJECTS = [
  'WebSite',
  'Organization',
  'Blog',
  'ItemList',
];

const REQUIRED_PER_POST_OBJECTS = [
  'WebPage',
  'BreadcrumbList',
  'BlogPosting',
];

// Test function to validate a BlogPosting object
function validateBlogPosting(post, index) {
  const errors = [];
  const warnings = [];
  const missing = [];
  
  // Check all required fields
  REQUIRED_BLOGPOSTING_FIELDS.forEach(field => {
    if (!(field in post)) {
      if (field === 'hasPart' || field === 'citation' || field === 'backstory') {
        warnings.push(`Missing optional field: ${field}`);
      } else {
        missing.push(field);
        errors.push(`Missing required field: ${field}`);
      }
    } else {
      // Validate field has value
      const value = post[field];
      if (value === undefined || value === null || value === '') {
        errors.push(`Field ${field} is empty`);
      } else if (Array.isArray(value) && value.length === 0) {
        if (field === 'about' || field === 'mentions') {
          warnings.push(`Field ${field} is empty array`);
        } else {
          errors.push(`Field ${field} is empty array`);
        }
      }
    }
  });
  
  // Check articleBody is not polluted
  if (post.articleBody) {
    const pollutionMarkers = ['/Cart', 'Sign In My Account', '[/cart]', 'Back photography', 'Facebook0', 'LinkedIn0'];
    const hasPollution = pollutionMarkers.some(marker => post.articleBody.includes(marker));
    if (hasPollution) {
      errors.push('articleBody contains navigation pollution');
    }
  }
  
  // Check mainEntityOfPage is @id reference
  if (post.mainEntityOfPage && !post.mainEntityOfPage['@id']) {
    errors.push('mainEntityOfPage must be @id reference');
  }
  
  // Check publisher is @id reference
  if (post.publisher && !post.publisher['@id']) {
    errors.push('publisher must be @id reference');
  }
  
  // Check isPartOf is @id reference
  if (post.isPartOf && !post.isPartOf['@id']) {
    errors.push('isPartOf must be @id reference');
  }
  
  return { errors, warnings, missing };
}

// Test function to validate top-level structure
function validateTopLevelStructure(schema) {
  const errors = [];
  const warnings = [];
  
  if (!schema['@context'] || schema['@context'] !== 'https://schema.org') {
    errors.push('Missing or invalid @context');
  }
  
  if (!schema['@graph'] || !Array.isArray(schema['@graph'])) {
    errors.push('Missing or invalid @graph');
    return { errors, warnings };
  }
  
  const graph = schema['@graph'];
  
  // Check for required top-level objects
  REQUIRED_TOP_LEVEL_OBJECTS.forEach(type => {
    const hasType = graph.some(obj => obj && obj['@type'] === type);
    if (!hasType) {
      errors.push(`Missing required top-level object: ${type}`);
    }
  });
  
  // Count objects
  const blogPostings = graph.filter(obj => obj && obj['@type'] === 'BlogPosting');
  const webPages = graph.filter(obj => obj && obj['@type'] === 'WebPage');
  const breadcrumbs = graph.filter(obj => obj && obj['@type'] === 'BreadcrumbList');
  
  if (blogPostings.length === 0) {
    errors.push('No BlogPosting objects found in @graph');
  }
  
  // Check each BlogPosting has corresponding WebPage and BreadcrumbList
  blogPostings.forEach(post => {
    if (post.url) {
      const webpageId = `${post.url}#webpage`;
      const hasWebPage = webPages.some(wp => wp['@id'] === webpageId);
      if (!hasWebPage) {
        errors.push(`BlogPosting ${post.url} missing corresponding WebPage`);
      }
      
      const breadcrumbId = `${post.url}#breadcrumb`;
      const hasBreadcrumb = breadcrumbs.some(bc => bc['@id'] === breadcrumbId);
      if (!hasBreadcrumb) {
        errors.push(`BlogPosting ${post.url} missing corresponding BreadcrumbList`);
      }
    }
  });
  
  return { errors, warnings, stats: { blogPostings: blogPostings.length, webPages: webPages.length, breadcrumbs: breadcrumbs.length } };
}

// Main test function
function testSchemaCompleteness(schemaJson) {
  console.log('=== SCHEMA COMPLETENESS TEST ===\n');
  
  let schema;
  try {
    schema = typeof schemaJson === 'string' ? JSON.parse(schemaJson) : schemaJson;
  } catch (e) {
    console.error('❌ Invalid JSON:', e.message);
    return false;
  }
  
  // Test top-level structure
  console.log('1. Testing top-level structure...');
  const structureTest = validateTopLevelStructure(schema);
  if (structureTest.errors.length > 0) {
    console.log('❌ Structure errors:');
    structureTest.errors.forEach(err => console.log('   -', err));
  } else {
    console.log('✅ Top-level structure valid');
    if (structureTest.stats) {
      console.log(`   - BlogPostings: ${structureTest.stats.blogPostings}`);
      console.log(`   - WebPages: ${structureTest.stats.webPages}`);
      console.log(`   - Breadcrumbs: ${structureTest.stats.breadcrumbs}`);
    }
  }
  
  // Test BlogPosting objects
  console.log('\n2. Testing BlogPosting objects...');
  const graph = schema['@graph'] || [];
  const blogPostings = graph.filter(obj => obj && obj['@type'] === 'BlogPosting');
  
  if (blogPostings.length === 0) {
    console.log('❌ No BlogPosting objects found');
    return false;
  }
  
  console.log(`   Testing ${blogPostings.length} BlogPosting objects...`);
  
  let totalErrors = 0;
  let totalWarnings = 0;
  let postsWithAllFields = 0;
  const allMissingFields = new Set();
  
  // Test first 5 posts in detail, then sample check all
  const postsToTestInDetail = blogPostings.slice(0, 5);
  const allPosts = blogPostings;
  
  postsToTestInDetail.forEach((post, idx) => {
    const validation = validateBlogPosting(post, idx);
    if (validation.errors.length === 0 && validation.missing.length === 0) {
      postsWithAllFields++;
    } else {
      console.log(`\n   Post ${idx + 1} (${post.url || 'no URL'}):`);
      if (validation.missing.length > 0) {
        console.log(`   ❌ Missing fields: ${validation.missing.join(', ')}`);
        validation.missing.forEach(f => allMissingFields.add(f));
      }
      if (validation.errors.length > 0) {
        validation.errors.forEach(err => console.log(`   ❌ ${err}`));
      }
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warn => console.log(`   ⚠️  ${warn}`));
      }
    }
    totalErrors += validation.errors.length;
    totalWarnings += validation.warnings.length;
  });
  
  // Quick check on all posts for critical fields
  let postsMissingCriticalFields = 0;
  allPosts.forEach(post => {
    const criticalFields = ['@id', 'headline', 'url', 'datePublished', 'articleBody', 'description', 'wordCount', 'timeRequired', 'mainEntityOfPage', 'publisher', 'author'];
    const missingCritical = criticalFields.filter(field => !(field in post) || !post[field]);
    if (missingCritical.length > 0) {
      postsMissingCriticalFields++;
      missingCritical.forEach(f => allMissingFields.add(f));
    } else {
      postsWithAllFields++;
    }
  });
  
  console.log(`\n   Summary:`);
  console.log(`   - Posts with all critical fields: ${allPosts.length - postsMissingCriticalFields}/${allPosts.length}`);
  console.log(`   - Posts with all required fields: ${postsWithAllFields}/${allPosts.length}`);
  console.log(`   - Total errors: ${totalErrors}`);
  console.log(`   - Total warnings: ${totalWarnings}`);
  
  if (allMissingFields.size > 0) {
    console.log(`\n   ❌ Fields missing across posts: ${Array.from(allMissingFields).join(', ')}`);
  }
  
  // Final verdict
  console.log('\n=== TEST RESULTS ===');
  const hasErrors = structureTest.errors.length > 0 || totalErrors > 0 || postsMissingCriticalFields > 0;
  if (hasErrors) {
    console.log('❌ SCHEMA IS INCOMPLETE');
    return false;
  } else {
    console.log('✅ SCHEMA IS COMPLETE');
    return true;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testSchemaCompleteness, validateBlogPosting, validateTopLevelStructure };
}

console.log('Schema completeness test module loaded.');
console.log('Usage: testSchemaCompleteness(schemaObject)');

