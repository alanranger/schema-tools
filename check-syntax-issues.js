import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'outputs', 'blog-schema (1).json');
const content = fs.readFileSync(filePath, 'utf8');

console.log('🔍 Checking for JSON syntax issues...\n');

// Check file end
const last200 = content.substring(Math.max(0, content.length - 200));
console.log('Last 200 characters:');
console.log(last200);
console.log('\n');

// Check for common issues
const issues = [];

// Check for trailing commas (these are invalid in JSON)
const trailingCommaBeforeBrace = content.match(/,\s*}/g);
if (trailingCommaBeforeBrace) {
  issues.push(`Found ${trailingCommaBeforeBrace.length} trailing comma(s) before }`);
}

const trailingCommaBeforeBracket = content.match(/,\s*]/g);
if (trailingCommaBeforeBracket) {
  issues.push(`Found ${trailingCommaBeforeBracket.length} trailing comma(s) before ]`);
}

// Check for invalid values
if (content.includes('undefined')) {
  issues.push('Contains "undefined" (invalid in JSON)');
}
if (content.includes('NaN')) {
  issues.push('Contains "NaN" (invalid in JSON)');
}
if (content.includes('Infinity')) {
  issues.push('Contains "Infinity" (invalid in JSON)');
}

// Check for unclosed strings
const openQuotes = (content.match(/"/g) || []).length;
if (openQuotes % 2 !== 0) {
  issues.push('Unclosed string (odd number of quotes)');
}

// Try to parse
try {
  const parsed = JSON.parse(content);
  console.log('✅ JSON parses successfully');
  console.log(`   @graph length: ${parsed['@graph'] ? parsed['@graph'].length : 'MISSING'}`);
  
  if (issues.length > 0) {
    console.log('\n⚠️  Potential issues found:');
    issues.forEach(issue => console.log(`   - ${issue}`));
  } else {
    console.log('\n✅ No obvious syntax issues found');
  }
} catch (e) {
  console.error('❌ JSON parse error:', e.message);
  if (e.message.includes('position')) {
    const match = e.message.match(/position (\d+)/);
    if (match) {
      const pos = parseInt(match[1]);
      const start = Math.max(0, pos - 100);
      const end = Math.min(content.length, pos + 100);
      console.error('\nContext around error:');
      console.error(content.substring(start, end));
    }
  }
}

console.log(`\nFile size: ${(content.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`Total lines: ${content.split('\n').length}`);

