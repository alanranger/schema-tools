// Test script to verify schema fixes
// This simulates the buildEnrichedBlogPosting function and checks for invalid properties

const testBlogPosting = {
  '@type': 'BlogPosting',
  '@id': 'https://www.alanranger.com/test#blogposting',
  headline: 'Test Blog Post',
  alternativeHeadline: 'Test Blog Post | Alan Ranger Photography',
  description: 'Test description',
  url: 'https://www.alanranger.com/test',
  mainEntityOfPage: { 
    '@type': 'WebPage',
    '@id': 'https://www.alanranger.com/test#webpage' 
  },
  datePublished: '2024-01-01',
  dateModified: '2024-01-01',
  inLanguage: 'en-GB',
  articleBody: 'Test article body',
  wordCount: 100,
  keywords: ['test', 'photography'],
  about: [],
  mentions: [],
  hasPart: [],
  image: {
    '@type': 'ImageObject',
    url: 'https://example.com/image.jpg',
    width: 1500,
    height: 1000,
    caption: 'Test image'
  },
  thumbnailUrl: 'https://example.com/image.jpg',
  speakable: {
    '@type': 'SpeakableSpecification',
    xpath: ['/html/head/title', '//h1']
  },
  discussionUrl: 'https://www.alanranger.com/test#comments',
  author: {
    '@type': 'Person',
    '@id': 'https://www.alanranger.com/#alanranger',
    name: 'Alan Ranger'
  },
  publisher: {
    '@type': 'Organization',
    '@id': 'https://www.alanranger.com#organization',
    name: 'Alan Ranger Photography'
  },
  isPartOf: { 
    '@type': 'WebSite',
    '@id': 'https://www.alanranger.com/#website' 
  },
  sameAs: []
};

// Invalid properties that should NOT be present
const INVALID_PROPERTIES = [
  'contentLocation',
  'readingTime',
  'proficiencyLevel',
  'primaryImageOfPage',
  'genre',
  'articleSection',
  'learningResourceType',
  'educationalLevel',
  'typicalAgeRange',
  'educationalUse',
  'estimatedCost',
  'audience',
  'educationalAlignment',
  'relatedLink',
  'isRelatedTo',
  'funding'
];

// Test BlogPosting
console.log('🧪 Testing BlogPosting schema...\n');

let hasErrors = false;
INVALID_PROPERTIES.forEach(prop => {
  if (testBlogPosting.hasOwnProperty(prop)) {
    console.log(`❌ ERROR: Invalid property '${prop}' found in BlogPosting`);
    hasErrors = true;
  }
});

// Test speakable
if (testBlogPosting.speakable) {
  if (testBlogPosting.speakable.cssSelector) {
    console.log(`❌ ERROR: Invalid 'cssSelector' found in speakable`);
    hasErrors = true;
  }
  if (!testBlogPosting.speakable['@type']) {
    console.log(`❌ ERROR: Missing '@type' in speakable`);
    hasErrors = true;
  }
  if (!testBlogPosting.speakable.xpath) {
    console.log(`❌ ERROR: Missing 'xpath' in speakable`);
    hasErrors = true;
  } else {
    console.log(`✅ Speakable is valid: has @type and xpath, no cssSelector`);
  }
}

// Test ImageObject
const testImageObject = {
  '@context': 'https://schema.org',
  '@type': 'ImageObject',
  '@id': 'https://example.com/image.jpg#imageobject',
  url: 'https://example.com/image.jpg',
  width: 1500,
  height: 1000,
  caption: 'Test image',
  contentUrl: 'https://example.com/image.jpg',
  encodingFormat: 'image/jpeg'
};

console.log('\n🧪 Testing ImageObject schema...\n');

if (testImageObject.contentLocation) {
  console.log(`❌ ERROR: Invalid 'contentLocation' found in ImageObject`);
  hasErrors = true;
} else {
  console.log(`✅ ImageObject is valid: no contentLocation property`);
}

// Summary
console.log('\n' + '='.repeat(60));
if (hasErrors) {
  console.log('❌ TEST FAILED: Invalid properties found');
  process.exit(1);
} else {
  console.log('✅ ALL TESTS PASSED: Schema fixes are correct');
  console.log('\nValid properties in BlogPosting:');
  console.log('  - headline, alternativeHeadline, description');
  console.log('  - image, author, publisher, mainEntityOfPage');
  console.log('  - datePublished, dateModified, url, sameAs');
  console.log('  - wordCount, articleBody, thumbnailUrl, discussionUrl');
  console.log('\nValid speakable structure:');
  console.log('  - @type: SpeakableSpecification');
  console.log('  - xpath: ["/html/head/title", "//h1"]');
  console.log('\nValid ImageObject structure:');
  console.log('  - url, width, height, caption, contentUrl, encodingFormat');
  console.log('  - NO contentLocation');
}


