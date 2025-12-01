const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf-8');

// Extract all script blocks
const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
const scripts = [];
let match;
while ((match = scriptRegex.exec(content)) !== null) {
  scripts.push(match[1]);
}

console.log(`Found ${scripts.length} script blocks`);

// Validate each script block
scripts.forEach((script, idx) => {
  try {
    new Function(script);
    console.log(`✅ Script block ${idx + 1}: Valid`);
  } catch (e) {
    console.log(`❌ Script block ${idx + 1}: ${e.message}`);
    const lines = script.split('\n');
    const lineMatch = e.stack.match(/eval:(\d+)/);
    if (lineMatch) {
      const lineNum = parseInt(lineMatch[1]) - 1;
      console.log(`   Error around line ${lineNum + 1} in script block:`);
      for (let i = Math.max(0, lineNum - 2); i < Math.min(lines.length, lineNum + 3); i++) {
        const marker = i === lineNum ? '>>>' : '   ';
        console.log(`${marker} ${i + 1}: ${lines[i]}`);
      }
    }
  }
});


