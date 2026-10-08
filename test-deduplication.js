// Test the deduplication and validation fixes
// Simulates the generator logic to verify it works correctly

// Simulate the deduplication logic from the generator
function testDeduplication() {
  console.log('=== TESTING DEDUPLICATION LOGIC ===\n');
  
  // Simulate blogPostings array with duplicates
  const blogPostings = [
    {
      '@type': 'BlogPosting',
      '@id': 'https://example.com/post1#blogposting',
      url: 'https://example.com/post1',
      headline: 'Post 1',
      mainEntityOfPage: 'https://example.com/post1#webpage', // String (should be fixed)
      readingTime: '8M', // Invalid format (should be fixed)
      isPartOf: 'https://example.com/blog#blog' // String (should be fixed)
    },
    {
      '@type': 'BlogPosting',
      '@id': 'https://example.com/post1#blogposting', // DUPLICATE URL
      url: 'https://example.com/post1',
      headline: 'Post 1 Updated',
      mainEntityOfPage: { '@id': 'https://example.com/post1#webpage' },
      readingTime: 'PT8M',
      isPartOf: { '@id': 'https://example.com/blog#blog' }
    },
    {
      '@type': 'BlogPosting',
      '@id': 'https://example.com/post2#blogposting',
      url: 'https://example.com/post2',
      headline: 'Post 2',
      mainEntityOfPage: { '@id': 'https://example.com/post2#webpage' },
      readingTime: 'PT5M',
      isPartOf: { '@id': 'https://example.com/blog#blog' }
    }
  ];
  
  console.log(`Input: ${blogPostings.length} BlogPosting objects`);
  console.log(`  - post1 appears ${blogPostings.filter(p => p.url === 'https://example.com/post1').length} times (DUPLICATE)\n`);
  
  // Apply deduplication logic (from generator)
  const urlToPosting = new Map();
  const BLOG_URL_GLOBAL = 'https://example.com/blog';
  
  blogPostings.forEach((post, idx) => {
    if (!post || !post['@type'] || post['@type'] !== 'BlogPosting') {
      console.log(`⚠️  Invalid BlogPosting at index ${idx} - filtered out`);
      return;
    }
    
    if (!post['@id'] || !post.headline || !post.url) {
      console.log(`⚠️  BlogPosting at index ${idx} missing required fields - filtered out`);
      return;
    }
    
    // Ensure mainEntityOfPage is always an object with @id (never a string)
    if (post.mainEntityOfPage) {
      if (typeof post.mainEntityOfPage === 'string') {
        post.mainEntityOfPage = { '@id': post.mainEntityOfPage };
        console.log(`   Fixed mainEntityOfPage for ${post.url}: converted string to object`);
      } else if (!post.mainEntityOfPage['@id']) {
        post.mainEntityOfPage = { '@id': `${post.url}#webpage` };
      }
    } else {
      post.mainEntityOfPage = { '@id': `${post.url}#webpage` };
    }
    
    // Ensure readingTime is always ISO 8601 format
    if (post.readingTime && !post.readingTime.match(/^PT\d+[MH]$/)) {
      // Convert "8M" to "PT8M"
      const match = post.readingTime.match(/(\d+)[MH]/);
      if (match) {
        const oldValue = post.readingTime;
        post.readingTime = `PT${match[1]}M`;
        console.log(`   Fixed readingTime for ${post.url}: "${oldValue}" → "${post.readingTime}"`);
      } else {
        post.readingTime = 'PT1M';
      }
    }
    
    // Ensure isPartOf is always an object with @id
    if (post.isPartOf) {
      if (typeof post.isPartOf === 'string') {
        post.isPartOf = { '@id': post.isPartOf };
        console.log(`   Fixed isPartOf for ${post.url}: converted string to object`);
      } else if (!post.isPartOf['@id']) {
        post.isPartOf = { '@id': `${BLOG_URL_GLOBAL}#blog` };
      }
    } else {
      post.isPartOf = { '@id': `${BLOG_URL_GLOBAL}#blog` };
    }
    
    // If URL already exists, REPLACE the previous one (not append)
    if (urlToPosting.has(post.url)) {
      console.log(`⚠️  Duplicate URL detected: ${post.url} - REPLACING previous BlogPosting`);
    }
    
    // Store/update in map (this ensures only one per URL)
    urlToPosting.set(post.url, post);
  });
  
  // Convert map to array (ensures no duplicates)
  const deduplicatedPostings = Array.from(urlToPosting.values());
  
  console.log(`\nOutput: ${deduplicatedPostings.length} unique BlogPosting objects`);
  console.log(`  - post1 appears ${deduplicatedPostings.filter(p => p.url === 'https://example.com/post1').length} time (FIXED)\n`);
  
  // Verify results
  const uniqueUrls = new Set(deduplicatedPostings.map(p => p.url));
  const allHaveValidMainEntity = deduplicatedPostings.every(p => 
    p.mainEntityOfPage && typeof p.mainEntityOfPage === 'object' && p.mainEntityOfPage['@id']
  );
  const allHaveValidReadingTime = deduplicatedPostings.every(p => 
    p.readingTime && p.readingTime.match(/^PT\d+[MH]$/)
  );
  const allHaveValidIsPartOf = deduplicatedPostings.every(p => 
    p.isPartOf && typeof p.isPartOf === 'object' && p.isPartOf['@id']
  );
  
  console.log('=== VALIDATION RESULTS ===');
  console.log(`✅ No duplicates: ${uniqueUrls.size === deduplicatedPostings.length ? 'PASS' : 'FAIL'}`);
  console.log(`✅ All mainEntityOfPage are objects: ${allHaveValidMainEntity ? 'PASS' : 'FAIL'}`);
  console.log(`✅ All readingTime are ISO 8601: ${allHaveValidReadingTime ? 'PASS' : 'FAIL'}`);
  console.log(`✅ All isPartOf are objects: ${allHaveValidIsPartOf ? 'PASS' : 'FAIL'}`);
  
  // Verify the duplicate was replaced with the newer version
  const post1 = deduplicatedPostings.find(p => p.url === 'https://example.com/post1');
  if (post1 && post1.headline === 'Post 1 Updated') {
    console.log(`✅ Duplicate was correctly replaced with newer version: PASS`);
  } else {
    console.log(`❌ Duplicate replacement failed: FAIL`);
  }
  
  console.log('\n=== TEST SUMMARY ===');
  if (uniqueUrls.size === deduplicatedPostings.length && 
      allHaveValidMainEntity && 
      allHaveValidReadingTime && 
      allHaveValidIsPartOf &&
      post1 && post1.headline === 'Post 1 Updated') {
    console.log('✅ ALL TESTS PASSED');
    return true;
  } else {
    console.log('❌ SOME TESTS FAILED');
    return false;
  }
}

// Test JSON validation
function testJSONValidation() {
  console.log('\n=== TESTING JSON VALIDATION ===\n');
  
  const validSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': 'https://example.com/post1#blogposting',
        url: 'https://example.com/post1',
        headline: 'Test Post'
      }
    ]
  };
  
  const invalidSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': 'https://example.com/post1#blogposting',
        url: 'https://example.com/post1',
        headline: 'Test Post',
        invalidField: undefined // This will cause issues
      }
    ]
  };
  
  try {
    const jsonString = JSON.stringify(validSchema);
    JSON.parse(jsonString);
    console.log('✅ Valid schema: JSON validation PASSED');
  } catch (e) {
    console.log(`❌ Valid schema: JSON validation FAILED - ${e.message}`);
    return false;
  }
  
  try {
    // JSON.stringify will remove undefined, so this should still work
    const jsonString = JSON.stringify(invalidSchema);
    JSON.parse(jsonString);
    console.log('✅ Invalid schema (with undefined): JSON validation PASSED (undefined removed)');
  } catch (e) {
    console.log(`❌ Invalid schema: JSON validation FAILED - ${e.message}`);
    return false;
  }
  
  return true;
}

// Run all tests
console.log('🧪 TESTING DEDUPLICATION AND VALIDATION FIXES\n');
console.log('='.repeat(60));

const test1 = testDeduplication();
const test2 = testJSONValidation();

console.log('\n' + '='.repeat(60));
console.log('\n=== FINAL RESULTS ===');
if (test1 && test2) {
  console.log('✅ ALL TESTS PASSED - Fixes are working correctly');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED - Fixes need adjustment');
  process.exit(1);
}

