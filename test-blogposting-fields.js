// Test to verify BlogPosting includes all required fields
// Simulates what buildEnrichedBlogPosting would create

// Inline validation function
function validateBlogPosting(post) {
  const REQUIRED_FIELDS = [
    '@type', '@id', 'headline', 'alternativeHeadline', 'description', 'url', 'mainEntityOfPage',
    'datePublished', 'dateCreated', 'dateModified', 'inLanguage', 'articleBody', 'wordCount',
    'timeRequired', 'readingTime', 'genre', 'articleSection', 'keywords', 'learningResourceType',
    'educationalLevel', 'proficiencyLevel', 'typicalAgeRange', 'estimatedCost',
    'audience', 'educationalAlignment', 'about', 'mentions', 'image', 'thumbnailUrl',
    'primaryImageOfPage', 'speakable', 'discussionUrl', 'author', 'publisher', 'isPartOf',
    'copyrightHolder', 'copyrightYear', 'sameAs', 'relatedLink', 'subjectOf', 'isRelatedTo',
    'interactionStatistic', 'commentCount', 'funding'
  ];
  
  const OPTIONAL_FIELDS = ['hasPart', 'citation', 'backstory', 'educationalUse'];
  
  const missing = [];
  const empty = [];
  
  REQUIRED_FIELDS.forEach(field => {
    if (!(field in post)) {
      missing.push(field);
    } else if (post[field] === undefined || post[field] === null || post[field] === '') {
      empty.push(field);
    } else if (Array.isArray(post[field]) && post[field].length === 0) {
      if (field !== 'about' && field !== 'mentions') {
        empty.push(field);
      }
    }
  });
  
  return { missing, empty };
}

// Simulate a BlogPosting object as it would be created
const sampleBlogPosting = {
  '@type': 'BlogPosting',
  '@id': 'https://www.alanranger.com/blog-on-photography/test#blogposting',
  headline: 'Test Post',
  alternativeHeadline: 'Test Post | Alan Ranger Photography',
  description: 'Test description',
  url: 'https://www.alanranger.com/blog-on-photography/test',
  mainEntityOfPage: { '@id': 'https://www.alanranger.com/blog-on-photography/test#webpage' },
  datePublished: '2025-01-01T00:00:00+00:00',
  dateCreated: '2025-01-01T00:00:00+00:00',
  dateModified: '2025-01-01T00:00:00+00:00',
  inLanguage: 'en-GB',
  articleBody: 'Clean article body content here',
  wordCount: 100,
  timeRequired: 'PT5M',
  readingTime: '5M',
  genre: 'Photography Guide',
  articleSection: 'Technical Foundations',
  keywords: ['test', 'photography'],
  learningResourceType: 'Tutorial',
  educationalLevel: 'Beginner',
  proficiencyLevel: 'Beginner',
  typicalAgeRange: '18-99',
  educationalUse: undefined, // Only for assignments
  estimatedCost: {
    '@type': 'MonetaryAmount',
    currency: 'GBP',
    value: '0'
  },
  audience: {
    '@type': 'EducationalAudience',
    educationalRole: 'Photographer',
    audienceType: 'Student'
  },
  educationalAlignment: {
    '@type': 'AlignmentObject',
    alignmentType: 'educationalFramework',
    educationalFramework: 'Photography Skills',
    targetName: 'Beginner'
  },
  about: [
    { '@type': 'Thing', name: 'Photography' }
  ],
  mentions: [
    { '@type': 'Thing', name: 'Camera' }
  ],
  hasPart: undefined, // Only for assignments
  image: {
    '@type': 'ImageObject',
    url: 'https://example.com/image.jpg',
    width: 1200,
    height: 800,
    caption: 'Test Post'
  },
  thumbnailUrl: 'https://example.com/image.jpg',
  primaryImageOfPage: { '@id': 'https://www.alanranger.com/blog-on-photography/test#webpage' },
  speakable: {
    '@type': 'SpeakableSpecification',
    xpath: ['/html/head/title', '//h1'],
    cssSelector: ['h1', '.intro']
  },
  discussionUrl: 'https://www.alanranger.com/blog-on-photography/test#comments',
  author: {
    '@type': 'Person',
    name: 'Alan Ranger',
    url: 'https://www.alanranger.com/about-alan-ranger',
    jobTitle: 'Photographer & Photography Educator',
    sameAs: [
      'https://www.alanranger.com',
      'https://www.linkedin.com/in/alanrangerphotography'
    ]
  },
  publisher: { '@id': 'https://www.alanranger.com#organization' },
  isPartOf: { '@id': 'https://www.alanranger.com/blog-on-photography#blog' },
  copyrightHolder: {
    '@type': 'Organization',
    '@id': 'https://www.alanranger.com#organization',
    name: 'Alan Ranger Photography'
  },
  copyrightYear: 2025,
  sameAs: ['https://www.alanranger.com/blog-on-photography'],
  relatedLink: [
    {
      '@type': 'WebPage',
      url: 'https://www.alanranger.com/blog-on-photography'
    }
  ],
  subjectOf: {
    '@type': 'Blog',
    '@id': 'https://www.alanranger.com/blog-on-photography#blog'
  },
  isRelatedTo: [
    {
      '@type': 'WebPage',
      url: 'https://www.alanranger.com/blog-on-photography'
    }
  ],
  interactionStatistic: {
    '@type': 'InteractionCounter',
    interactionType: 'https://schema.org/CommentAction',
    userInteractionCount: 0
  },
  commentCount: 0,
  funding: {
    '@type': 'MonetaryGrant',
    funder: {
      '@type': 'Organization',
      name: 'Alan Ranger Photography'
    }
  }
};

console.log('Testing sample BlogPosting object...\n');
const validation = validateBlogPosting(sampleBlogPosting);

// Also check what fields are actually in the sample
console.log('\n=== FIELDS IN SAMPLE BLOGPOSTING ===');
const fieldsInSample = Object.keys(sampleBlogPosting);
console.log(`Total fields: ${fieldsInSample.length}`);
console.log('Fields:', fieldsInSample.sort().join(', '));

// Check validation results
console.log('\n=== VALIDATION RESULTS ===');
if (validation.missing.length > 0) {
  console.log(`❌ Missing fields: ${validation.missing.join(', ')}`);
} else {
  console.log('✅ All required fields are present');
}

if (validation.empty.length > 0) {
  console.log(`⚠️  Empty fields: ${validation.empty.join(', ')}`);
} else {
  console.log('✅ All fields have values');
}

if (validation.missing.length === 0 && validation.empty.length === 0) {
  console.log('\n✅ BLOGPOSTING STRUCTURE IS COMPLETE');
} else {
  console.log('\n❌ BLOGPOSTING STRUCTURE IS INCOMPLETE');
}

