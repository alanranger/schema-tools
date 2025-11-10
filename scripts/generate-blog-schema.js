#!/usr/bin/env node

/**
 * Blog Schema Generator
 * 
 * Generates a unified Blog + ItemList JSON-LD schema from CSV for the blog index page.
 * 
 * Usage:
 *   node scripts/generate-blog-schema.js
 *   node scripts/generate-blog-schema.js --input "path/to/blog.csv" --output "output/blog-schema.json"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DEFAULT_INPUT_CSV = path.resolve(__dirname, '../inputs-files/workflow/01-Alan Ranger Blog On Photography - Tips, Offers and News-CSV.csv');
const DEFAULT_OUTPUT_JSON = path.resolve(__dirname, '../outputs/blog-schema.json');
const BLOG_URL = 'https://www.alanranger.com/blog-on-photography';
const BLOG_NAME = 'Alan Ranger Blog on Photography – Tips, Offers & News';
const BLOG_DESCRIPTION = 'Photography tips, creative projects, case studies, and news by Alan Ranger. Covering composition, exposure, field techniques, editing, and real workshop insights.';

// Publisher and Author constants
const PUBLISHER = {
  "@type": "Organization",
  "name": "Alan Ranger Photography",
  "url": "https://www.alanranger.com",
  "logo": {
    "@type": "ImageObject",
    "url": "https://images.squarespace-cdn.com/content/v1/5013f4b2c4aaa4752ac69b17/b859ad2b-1442-4595-b9a4-410c32299bf8/ALAN+RANGER+photography+LOGO+BLACK.+switched+small.png?format=1500w"
  },
  "sameAs": [
    "https://www.facebook.com/alanrangerphotography",
    "https://www.instagram.com/alanrangerphoto",
    "https://www.youtube.com/@AlanRangerPhotography",
    "https://www.threads.net/@alanrangerphoto"
  ]
};

const AUTHOR = {
  "@type": "Person",
  "name": "Alan Ranger",
  "url": "https://www.alanranger.com/about-alan-ranger",
  "jobTitle": "Photographer & Educator",
  "affiliation": { 
    "@type": "Organization", 
    "name": "Alan Ranger Photography" 
  },
  "sameAs": [
    "https://www.alanranger.com",
    "https://www.linkedin.com/in/alanrangerphotography"
  ]
};

/**
 * Simple CSV parser - handles quoted fields and basic escaping
 */
function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  // Parse header
  const headers = parseCSVLine(lines[0]);
  
  // Parse rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index] ? values[index].trim() : '';
    });
    rows.push(row);
  }
  
  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  values.push(current);
  return values;
}

/**
 * Format date to ISO 8601 format
 */
function formatDate(dateStr) {
  if (!dateStr) return null;
  
  // Handle YYYY-MM-DD format
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    return dateMatch[0]; // Already ISO format
  }
  
  // Try to parse other formats
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
    console.warn(`Warning: Could not parse date: ${dateStr}`);
  }
  
  return null;
}

/**
 * Truncate text to max length
 */
function truncate(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Determine schema type based on category
 */
function getSchemaType(categories) {
  if (!categories) return 'BlogPosting';
  const cats = categories.toLowerCase();
  if (cats.includes('news')) {
    return 'NewsArticle';
  }
  return 'BlogPosting';
}

/**
 * Generate BlogPosting/NewsArticle schema from CSV row
 */
function generateBlogPosting(row, position) {
  const headline = row['Title'] || '';
  const url = row['Full Url'] || '';
  const image = row['Image'] || '';
  const datePublished = formatDate(row['Publish On']);
  const categories = row['Categories'] || '';
  const tags = row['Tags'] || '';
  
  // Extract first category as articleSection
  const articleSection = categories ? categories.split(';')[0].trim() : '';
  
  // Join tags as keywords
  const keywords = tags ? tags.split(';').map(t => t.trim()).join(', ') : '';
  
  // Generate description (truncate title if needed)
  const description = truncate(headline, 110);
  
  const schemaType = getSchemaType(categories);
  
  const blogPosting = {
    "@type": schemaType,
    "headline": headline,
    "url": url,
    "datePublished": datePublished || new Date().toISOString().split('T')[0],
    "dateModified": datePublished || new Date().toISOString().split('T')[0],
    "description": description,
    "author": {
      "@type": "Person",
      "name": "Alan Ranger"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Alan Ranger Photography"
    },
    "mainEntityOfPage": url,
    "isPartOf": BLOG_URL,
    "copyrightHolder": {
      "@type": "Organization",
      "name": "Alan Ranger Photography"
    }
  };
  
  // Add image if available
  if (image) {
    blogPosting.image = {
      "@type": "ImageObject",
      "url": image,
      "caption": headline
    };
    blogPosting.thumbnailUrl = image;
  }
  
  // Add articleSection if available
  if (articleSection) {
    blogPosting.articleSection = articleSection;
  }
  
  // Add keywords if available
  if (keywords) {
    blogPosting.keywords = keywords;
  }
  
  return {
    "@type": "ListItem",
    "position": position,
    "item": blogPosting
  };
}

/**
 * Generate main Blog schema
 */
function generateBlogSchema(blogPostings) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${BLOG_URL}#blog`,
    "url": BLOG_URL,
    "name": BLOG_NAME,
    "description": BLOG_DESCRIPTION,
    "publisher": PUBLISHER,
    "author": AUTHOR,
    "inLanguage": "en-GB",
    "mainEntity": {
      "@type": "ItemList",
      "itemListOrder": "Descending",
      "itemListElement": blogPostings
    }
  };
  
  return schema;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let inputPath = DEFAULT_INPUT_CSV;
  let outputPath = DEFAULT_OUTPUT_JSON;
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      inputPath = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputPath = path.resolve(args[i + 1]);
      i++;
    }
  }
  
  console.log('📝 Blog Schema Generator');
  console.log('='.repeat(50));
  console.log(`Input CSV: ${inputPath}`);
  console.log(`Output JSON: ${outputPath}`);
  console.log('');
  
  // Read CSV file
  let csvContent;
  try {
    csvContent = fs.readFileSync(inputPath, 'utf-8');
  } catch (error) {
    console.error(`❌ Error reading CSV file: ${error.message}`);
    process.exit(1);
  }
  
  // Parse CSV
  console.log('📖 Parsing CSV...');
  const rows = parseCSV(csvContent);
  console.log(`✅ Found ${rows.length} blog posts`);
  
  if (rows.length === 0) {
    console.error('❌ No blog posts found in CSV');
    process.exit(1);
  }
  
  // Generate blog postings
  console.log('🔨 Generating blog postings...');
  const blogPostings = [];
  const seenUrls = new Set();
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const url = row['Full Url'] || '';
    
    // Skip duplicates
    if (url && seenUrls.has(url)) {
      console.warn(`⚠️  Skipping duplicate URL: ${url}`);
      continue;
    }
    
    if (url) {
      seenUrls.add(url);
    }
    
    const position = blogPostings.length + 1;
    const blogPosting = generateBlogPosting(row, position);
    blogPostings.push(blogPosting);
  }
  
  console.log(`✅ Generated ${blogPostings.length} blog postings`);
  
  // Generate main Blog schema
  console.log('🔨 Generating Blog schema...');
  const blogSchema = generateBlogSchema(blogPostings);
  
  // Add generation metadata as comment in JSON
  const generationDate = new Date().toISOString().split('T')[0];
  const version = '1.0';
  const schemaWithComment = {
    ...blogSchema,
    _meta: {
      generated: generationDate,
      version: version,
      postCount: blogPostings.length
    }
  };
  
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Write JSON file
  const jsonContent = JSON.stringify(blogSchema, null, 2);
  const fileSizeKB = (Buffer.byteLength(jsonContent, 'utf8') / 1024).toFixed(2);
  
  try {
    fs.writeFileSync(outputPath, jsonContent, 'utf-8');
    console.log(`✅ Schema written to: ${outputPath}`);
    console.log(`📊 File size: ${fileSizeKB} KB`);
  } catch (error) {
    console.error(`❌ Error writing JSON file: ${error.message}`);
    process.exit(1);
  }
  
  // Validate size
  if (parseFloat(fileSizeKB) > 1000) {
    console.warn(`⚠️  Warning: File size exceeds 1 MB (${fileSizeKB} KB)`);
  }
  
  // Output HTML script tag format
  console.log('');
  console.log('📋 HTML Script Tag Format:');
  console.log('='.repeat(50));
  console.log('<script type="application/ld+json">');
  console.log(jsonContent);
  console.log('</script>');
  console.log('='.repeat(50));
  
  // Summary
  console.log('');
  console.log('✅ Generation Complete!');
  console.log(`   - Total posts: ${blogPostings.length}`);
  console.log(`   - File size: ${fileSizeKB} KB`);
  console.log(`   - Output: ${outputPath}`);
  console.log('');
  console.log('📝 Next steps:');
  console.log('   1. Validate schema at: https://validator.schema.org/');
  console.log('   2. Test at: https://search.google.com/test/rich-results');
  console.log('   3. Add to Squarespace Blog Index Page Header:');
  console.log(`      <script type="application/ld+json" src="https://schema.alanranger.com/blog-schema.json"></script>`);
}

// Run main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

