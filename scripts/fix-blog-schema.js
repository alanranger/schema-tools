import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the blog schema file
const schemaPath = path.join(__dirname, '..', 'alanranger-schema', 'blog-schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

// Fix 1: Add width and height to publisher logo
if (schema.publisher && schema.publisher.logo) {
  schema.publisher.logo.width = 800;
  schema.publisher.logo.height = 800;
}

// Fix 2-6: Update all BlogPosting/NewsArticle items
if (schema.mainEntity && schema.mainEntity.itemListElement) {
  schema.mainEntity.itemListElement.forEach((listItem) => {
    if (listItem.item) {
      const item = listItem.item;
      
      // Fix 2: Convert datePublished and dateModified to ISO-8601 with timezone
      if (item.datePublished && item.datePublished.match(/^\d{4}-\d{2}-\d{2}$/)) {
        item.datePublished = `${item.datePublished}T00:00:00+00:00`;
      }
      if (item.dateModified && item.dateModified.match(/^\d{4}-\d{2}-\d{2}$/)) {
        item.dateModified = `${item.dateModified}T00:00:00+00:00`;
      }
      
      // Fix 3: Add author.url if missing
      if (item.author && item.author['@type'] === 'Person') {
        if (!item.author.url) {
          item.author.url = 'https://www.alanranger.com/about-alan-ranger';
        }
      }
      
      // Fix 4: Convert mainEntityOfPage from string to WebPage object
      if (typeof item.mainEntityOfPage === 'string') {
        item.mainEntityOfPage = {
          '@type': 'WebPage',
          '@id': item.mainEntityOfPage
        };
      }
      
      // Fix 5: Add inLanguage if missing
      if (!item.inLanguage) {
        item.inLanguage = 'en-GB';
      }
    }
  });
}

// Write the updated schema back
fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), 'utf-8');
console.log('✅ Successfully updated blog-schema.json with all validation fixes!');
console.log(`   - Fixed ${schema.mainEntity.itemListElement.length} blog posts`);
console.log('   - Updated dates to ISO-8601 format');
console.log('   - Added author.url to all posts');
console.log('   - Converted mainEntityOfPage to WebPage objects');
console.log('   - Added inLanguage to all posts');
console.log('   - Added logo width/height');

