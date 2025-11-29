// Quick script to copy JSON from blog-schema (3).json to clipboard
// Run: node copy-from-file.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'outputs', 'blog-schema (3).json');

if (!fs.existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');

// Validate JSON
try {
  JSON.parse(content);
  console.log('✅ JSON is valid');
} catch (e) {
  console.error(`❌ JSON parse error: ${e.message}`);
  process.exit(1);
}

// Try to copy to clipboard (Windows)
try {
  // Windows PowerShell command to copy to clipboard
  const command = `powershell -Command "Set-Clipboard -Value (Get-Content '${filePath.replace(/'/g, "''")}' -Raw)"`;
  execSync(command, { stdio: 'inherit' });
  console.log('\n✅ JSON copied to clipboard!');
  console.log('\n📋 Next steps:');
  console.log('   1. Go to https://search.google.com/test/rich-results');
  console.log('   2. Click "CODE" tab');
  console.log('   3. Paste (Ctrl+V)');
  console.log('   4. Click "TEST URL"');
} catch (e) {
  console.log('\n⚠️  Could not copy to clipboard automatically');
  console.log('\n📋 Manual steps:');
  console.log(`   1. Open: ${filePath}`);
  console.log('   2. Select all (Ctrl+A)');
  console.log('   3. Copy (Ctrl+C)');
  console.log('   4. Paste into Google Rich Results Test CODE tab');
}

