// Verify ALL BlogPosting objects have ALL required fields
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const schemaPath = path.join(__dirname, 'outputs', 'blog-schema.txt');
const content = fs.readFileSync(schemaPath, 'utf8');

// Extract JSON
let jsonText = content;
if (content.includes('<script')) {
  const match = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  if (match) {
    jsonText = match[1].trim();
  }
}

const schema = JSON.parse(jsonText);
const blogPostings = schema['@graph'].filter(obj => obj && obj['@type'] === 'BlogPosting');

console.log(`\n🔍 VERIFYING ALL ${blogPostings.length} BLOGPOSTING OBJECTS\n`);
console.log('='.repeat(60));

let totalMissing = 0;
const missingByField = {};

blogPostings.forEach((post, idx) => {
  const missing = [];
  
  REQUIRED_FIELDS.forEach(field => {
    if (!(field in post)) {
      missing.push(field);
      if (!missingByField[field]) {
        missingByField[field] = [];
      }
      missingByField[field].push(idx + 1);
    }
  });
  
  if (missing.length > 0) {
    totalMissing++;
    if (totalMissing <= 10) {
      console.log(`❌ Post ${idx + 1} (${post.url || 'no URL'}): Missing ${missing.length} fields: ${missing.join(', ')}`);
    }
  }
});

console.log('\n' + '='.repeat(60));
console.log(`\n📊 SUMMARY:`);
console.log(`   Total BlogPostings: ${blogPostings.length}`);
console.log(`   Posts with ALL fields: ${blogPostings.length - totalMissing}`);
console.log(`   Posts missing fields: ${totalMissing}`);

if (totalMissing === 0) {
  console.log(`\n✅ ALL ${blogPostings.length} POSTS HAVE ALL REQUIRED FIELDS!`);
  process.exit(0);
} else {
  console.log(`\n❌ ${totalMissing} POSTS ARE MISSING FIELDS`);
  console.log(`\nMissing fields breakdown:`);
  Object.keys(missingByField).forEach(field => {
    const count = missingByField[field].length;
    const posts = missingByField[field].slice(0, 5).join(', ');
    const more = count > 5 ? ` and ${count - 5} more` : '';
    console.log(`   ${field}: ${count} posts (e.g., posts ${posts}${more})`);
  });
  process.exit(1);
}


