// Validate blog-schema-test.json before deployment
// Run this after generating the test version to ensure it's ready for production
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 VALIDATING TEST SCHEMA BEFORE DEPLOYMENT');
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

console.log(`\n📁 Testing file: ${testSchemaPath}\n`);

let errors = 0;
let warnings = 0;

// Test 1: JSON Validity
console.log('=== TEST 1: JSON VALIDITY ===');
try {
  const content = fs.readFileSync(testSchemaPath, 'utf8');
  
  // Check for HTML encoding (should not be present)
  if (content.includes('&quot;')) {
    console.error('❌ ERROR: File contains HTML-encoded quotes (&quot;)');
    console.error('   This will cause Google Rich Results Test to fail!');
    errors++;
  }
  
  if (content.includes('&lt;') || content.includes('&gt;')) {
    console.error('❌ ERROR: File contains HTML-encoded characters');
    errors++;
  }
  
  // Check for spaces in @type values
  const typeWithSpaces = content.match(/"@type"\s*:\s*"\s+[^"]+"/g);
  if (typeWithSpaces) {
    console.error('❌ ERROR: Found @type values with leading/trailing spaces:');
    typeWithSpaces.slice(0, 5).forEach(match => {
      console.error(`   ${match}`);
    });
    errors++;
  }
  
  const schema = JSON.parse(content);
  console.log('✅ JSON parses successfully');
  
  // Test 2: Structure
  console.log('\n=== TEST 2: STRUCTURE ===');
  if (!schema['@context'] || schema['@context'] !== 'https://schema.org') {
    console.error('❌ ERROR: Missing or invalid @context');
    errors++;
  } else {
    console.log('✅ @context is correct');
  }
  
  if (!schema['@graph'] || !Array.isArray(schema['@graph'])) {
    console.error('❌ ERROR: Missing or invalid @graph');
    errors++;
  } else {
    console.log(`✅ @graph is valid array (${schema['@graph'].length} items)`);
  }
  
  const blogPostings = schema['@graph'].filter(obj => obj && obj['@type'] === 'BlogPosting');
  console.log(`✅ Found ${blogPostings.length} BlogPosting objects`);
  
  // Test 3: Sample BlogPosting
  if (blogPostings.length > 0) {
    console.log('\n=== TEST 3: SAMPLE BLOGPOSTING ===');
    const sample = blogPostings[0];
    const requiredFields = ['@id', '@type', 'headline', 'description', 'articleBody', 'publisher', 'author'];
    const missing = requiredFields.filter(field => !(field in sample));
    
    if (missing.length > 0) {
      console.error(`❌ ERROR: Sample BlogPosting missing fields: ${missing.join(', ')}`);
      errors++;
    } else {
      console.log('✅ Sample BlogPosting has all required fields');
    }
    
    // Check publisher is full object
    if (sample.publisher) {
      if (typeof sample.publisher === 'string' || (sample.publisher['@id'] && !sample.publisher['@type'])) {
        console.error('❌ ERROR: Publisher is @id reference, must be full Organization object');
        errors++;
      } else if (sample.publisher['@type'] !== 'Organization') {
        console.error(`❌ ERROR: Publisher @type is "${sample.publisher['@type']}", expected "Organization"`);
        errors++;
      } else {
        console.log('✅ Publisher is full Organization object');
      }
    }
  }
  
  // Test 4: No HTML encoding in JSON string
  console.log('\n=== TEST 4: NO HTML ENCODING ===');
  const jsonString = JSON.stringify(schema, null, 2);
  if (jsonString.includes('&quot;') || jsonString.includes('&lt;') || jsonString.includes('&gt;')) {
    console.error('❌ ERROR: JSON string contains HTML-encoded characters');
    console.error('   This will cause parsing errors in Google Rich Results Test');
    errors++;
  } else {
    console.log('✅ No HTML encoding found in JSON');
  }
  
  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('=== VALIDATION SUMMARY ===');
  console.log(`Errors: ${errors}`);
  console.log(`Warnings: ${warnings}`);
  
  if (errors === 0) {
    console.log('\n✅ VALIDATION PASSED - Schema is ready for Google Rich Results Test');
    console.log('\n📋 Next steps:');
    console.log('   1. Open blog-schema-test.json in a text editor');
    console.log('   2. Copy the entire JSON (Ctrl+A, Ctrl+C)');
    console.log('   3. Go to https://search.google.com/test/rich-results');
    console.log('   4. Click "CODE" tab');
    console.log('   5. Paste the JSON');
    console.log('   6. Verify it passes validation');
    console.log('   7. Only then use "Export JSON & Deploy to GitHub"');
    process.exit(0);
  } else {
    console.log(`\n❌ VALIDATION FAILED - ${errors} error(s) found`);
    console.log('\n⚠️  DO NOT deploy until all errors are fixed!');
    process.exit(1);
  }
  
} catch (e) {
  console.error(`\n❌ FATAL ERROR: ${e.message}`);
  if (e.message.includes('position')) {
    const match = e.message.match(/position (\d+)/);
    if (match) {
      const pos = parseInt(match[1]);
      const content = fs.readFileSync(testSchemaPath, 'utf8');
      const start = Math.max(0, pos - 200);
      const end = Math.min(content.length, pos + 200);
      console.error('\nContext around error:');
      console.error(content.substring(start, end));
    }
  }
  process.exit(1);
}

