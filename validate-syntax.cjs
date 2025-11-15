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
    
    // Try to parse the error location from the stack
    const stackLines = e.stack.split('\n');
    for (const stackLine of stackLines) {
      const lineMatch = stackLine.match(/eval:(\d+):(\d+)/);
      if (lineMatch) {
        const lineNum = parseInt(lineMatch[1]) - 1;
        const colNum = parseInt(lineMatch[2]);
        console.log(`   Error at line ${lineNum + 1}, column ${colNum} in script block:`);
        for (let i = Math.max(0, lineNum - 3); i < Math.min(lines.length, lineNum + 4); i++) {
          const marker = i === lineNum ? '>>>' : '   ';
          const line = lines[i] || '';
          console.log(`${marker} ${i + 1}: ${line}`);
          if (i === lineNum && colNum) {
            console.log(`    ${' '.repeat(colNum + 4)}^`);
          }
        }
        break;
      }
    }
    
    // If we couldn't find the line, show context
    if (!e.stack.match(/eval:\d+:\d+/)) {
      console.log(`   Error message: ${e.message}`);
      console.log(`   First 1000 chars of script block:`);
      console.log(script.substring(0, 1000));
    }
  }
});

