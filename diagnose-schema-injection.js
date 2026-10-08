/**
 * Schema Injection Diagnostic Script
 * 
 * Run this in the browser console on the blog post page to diagnose:
 * 1. What JSON-LD scripts are actually in the DOM
 * 2. Check for BOM/hidden characters
 * 3. Verify scripts aren't merging
 * 
 * Usage: Copy and paste this entire script into the browser console
 */

(function() {
  console.log('='.repeat(80));
  console.log('SCHEMA INJECTION DIAGNOSTIC REPORT');
  console.log('='.repeat(80));
  
  // QUESTION 1: Find all JSON-LD script tags and show their contents
  console.log('\n📋 QUESTION 1: What JSON-LD scripts are in the DOM?');
  console.log('-'.repeat(80));
  
  const allScripts = document.querySelectorAll('script[type="application/ld+json"]');
  console.log(`Found ${allScripts.length} JSON-LD script tag(s)`);
  
  allScripts.forEach((script, index) => {
    console.log(`\n--- Script ${index + 1} ---`);
    console.log(`ID: ${script.id || '(no ID)'}`);
    console.log(`Source: ${script.src || '(inline)'}`);
    console.log(`Parent: ${script.parentElement?.tagName || 'unknown'}`);
    
    const content = script.textContent || script.innerHTML || '';
    const firstChar = content.trim().charAt(0);
    const firstCharCode = firstChar.charCodeAt(0);
    
    console.log(`Content length: ${content.length} characters`);
    console.log(`First character: "${firstChar}" (Unicode: U+${firstCharCode.toString(16).toUpperCase().padStart(4, '0')})`);
    
    // QUESTION 2: Check for BOM or hidden characters
    if (firstCharCode === 0xFEFF) {
      console.log('⚠️  BOM DETECTED! First character is BOM (U+FEFF)');
    } else if (firstCharCode < 32 && firstCharCode !== 9 && firstCharCode !== 10 && firstCharCode !== 13) {
      console.log(`⚠️  HIDDEN CHARACTER DETECTED! First character is control character (U+${firstCharCode.toString(16).toUpperCase().padStart(4, '0')})`);
    } else if (firstChar !== '{') {
      console.log(`⚠️  UNEXPECTED FIRST CHARACTER! Expected "{", got "${firstChar}"`);
    } else {
      console.log('✅ First character is "{" (correct)');
    }
    
    // Show first 200 chars and last 100 chars
    const preview = content.trim();
    console.log(`\nFirst 200 characters:`);
    console.log(preview.substring(0, 200));
    if (preview.length > 200) {
      console.log(`\n... (${preview.length - 200} more characters) ...`);
      console.log(`\nLast 100 characters:`);
      console.log(preview.substring(preview.length - 100));
    }
    
    // Try to parse JSON
    try {
      const parsed = JSON.parse(content.trim());
      console.log(`✅ JSON is valid`);
      console.log(`   @type: ${parsed['@type'] || parsed['@graph']?.[0]?.['@type'] || 'unknown'}`);
      console.log(`   @id: ${parsed['@id'] || parsed['@graph']?.[0]?.['@id'] || 'none'}`);
    } catch (e) {
      console.log(`❌ JSON PARSE ERROR: ${e.message}`);
      console.log(`   Error at position: ${e.message.match(/position (\d+)/)?.[1] || 'unknown'}`);
    }
  });
  
  // QUESTION 3: Check for merging/concatenation issues
  console.log('\n\n📋 QUESTION 3: Are scripts merging or missing closing tags?');
  console.log('-'.repeat(80));
  
  // Get all script tags (not just JSON-LD) to check for structural issues
  const allScriptTags = document.querySelectorAll('script');
  const jsonLdScripts = Array.from(allScriptTags).filter(s => 
    s.type === 'application/ld+json' || 
    s.getAttribute('type') === 'application/ld+json'
  );
  
  console.log(`Total script tags on page: ${allScriptTags.length}`);
  console.log(`JSON-LD script tags: ${jsonLdScripts.length}`);
  
  // Check HTML source for unclosed tags
  const htmlSource = document.documentElement.outerHTML;
  const jsonLdPattern = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>/gi;
  const closingPattern = /<\/script>/gi;
  
  const openingMatches = htmlSource.match(jsonLdPattern) || [];
  const closingMatches = htmlSource.match(closingPattern) || [];
  
  console.log(`\nHTML source analysis:`);
  console.log(`   Opening <script type="application/ld+json"> tags: ${openingMatches.length}`);
  console.log(`   Closing </script> tags: ${closingMatches.length}`);
  
  if (openingMatches.length !== closingMatches.length) {
    console.log(`⚠️  MISMATCH! Opening and closing tags don't match`);
  } else {
    console.log(`✅ Opening and closing tags match`);
  }
  
  // Check for adjacent JSON-LD scripts that might be merging
  jsonLdScripts.forEach((script, index) => {
    const nextSibling = script.nextSibling;
    if (nextSibling && nextSibling.nodeType === 1 && nextSibling.tagName === 'SCRIPT') {
      const nextType = nextSibling.type || nextSibling.getAttribute('type');
      if (nextType === 'application/ld+json') {
        console.log(`⚠️  Script ${index + 1} is immediately followed by another JSON-LD script`);
        console.log(`   This could indicate merging if there's no closing tag between them`);
      }
    }
  });
  
  // Check for specific storytelling files
  console.log('\n\n📋 SPECIFIC FILE CHECK: storytelling-narrative-photography-assignment');
  console.log('-'.repeat(80));
  
  const storytellingScripts = Array.from(jsonLdScripts).filter(script => {
    const content = (script.textContent || script.innerHTML || '').trim();
    try {
      const parsed = JSON.parse(content);
      const id = parsed['@id'] || '';
      return id.includes('storytelling-narrative-photography-assignment');
    } catch (e) {
      return false;
    }
  });
  
  console.log(`Found ${storytellingScripts.length} storytelling-related JSON-LD script(s)`);
  
  storytellingScripts.forEach((script, index) => {
    const content = (script.textContent || script.innerHTML || '').trim();
    try {
      const parsed = JSON.parse(content);
      console.log(`\n--- Storytelling Script ${index + 1} ---`);
      console.log(`@type: ${parsed['@type']}`);
      console.log(`@id: ${parsed['@id']}`);
      
      // Check for mainEntity/mainEntityOfPage
      if (parsed['mainEntity']) {
        console.log(`mainEntity: ${JSON.stringify(parsed['mainEntity'])}`);
      }
      if (parsed['mainEntityOfPage']) {
        console.log(`mainEntityOfPage: ${JSON.stringify(parsed['mainEntityOfPage'])}`);
      }
    } catch (e) {
      console.log(`❌ Could not parse: ${e.message}`);
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSTIC COMPLETE');
  console.log('='.repeat(80));
})();

