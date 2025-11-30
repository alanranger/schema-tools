#!/usr/bin/env node

/**
 * HowTo Detection Test Script
 * 
 * Tests HowTo detection logic against a specific URL
 * 
 * Usage:
 *   node scripts/test-howto-detection.js
 *   node scripts/test-howto-detection.js --url "https://www.alanranger.com/blog-on-photography/wildlife-photography-practice-assignment-free-lesson"
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Extract text from HTML (simplified version)
 */
function htmlToPlainText(html) {
  if (!html) return '';
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Simple HowTo Detection Logic (extracted from index.html)
 * Check if HowTo schema exists in HTML
 * - If EXISTS → return false (skip, don't generate)
 * - If DOESN'T exist → return true (generate)
 */
function shouldGenerateHowTo(html, plainText, debugLog = null) {
  if (!html && !plainText) {
    if (debugLog) debugLog('HowTo Detection: No HTML or plain text provided');
    return false; // Can't check, assume exists to be safe
  }
  
  if (debugLog) {
    debugLog('HowTo Detection: Checking if HowTo schema EXISTS');
    debugLog(`  - HTML length: ${html ? html.length : 0}`);
    debugLog(`  - Plain text length: ${plainText ? plainText.length : 0}`);
  }
  
  // Check if HowTo schema EXISTS in HTML
  if (html) {
    // Check for HowTo schema in script tags
    if (/"@type"\s*:\s*"HowTo"/i.test(html) || /@type["\s]*:["\s]*["\']?HowTo/i.test(html)) {
      if (debugLog) debugLog(`  ✅ HowTo EXISTS: Found HowTo schema in HTML`);
      if (debugLog) debugLog(`  → RETURNING FALSE: will SKIP (don't duplicate)`);
      return false; // EXISTS, so don't generate (skip)
    }
  }
  
  // HowTo does NOT exist → GENERATE
  if (debugLog) debugLog(`  ❌ HowTo does NOT exist: No HowTo schema found in HTML`);
  if (debugLog) debugLog(`  → RETURNING TRUE: will GENERATE`);
  return true; // Doesn't exist, so generate
}

/**
 * Fetch HTML for a URL from Supabase
 */
async function fetchPageHtml(url) {
  try {
    let { data, error } = await supabase
      .from('page_html')
      .select('html_content')
      .eq('url', url)
      .limit(1)
      .maybeSingle();
    
    if (!data && !url.endsWith('/')) {
      const result = await supabase
        .from('page_html')
        .select('html_content')
        .eq('url', url + '/')
        .limit(1)
        .maybeSingle();
      data = result.data;
      error = result.error;
    }
    
    if (error) {
      console.warn(`  ⚠️  Error fetching HTML: ${error.message}`);
      return null;
    }
    
    return data && data.html_content ? data.html_content : null;
  } catch (error) {
    console.warn(`  ⚠️  Exception fetching HTML: ${error.message}`);
    return null;
  }
}

/**
 * Test HowTo detection for a URL
 */
async function testURL(url) {
  const debugLogs = [];
  const debugLog = (msg) => {
    debugLogs.push(msg);
    console.log(`  ${msg}`);
  };
  
  console.log(`\n🔍 Testing HowTo Detection for:`);
  console.log(`   ${url}\n`);
  
  const html = await fetchPageHtml(url);
  
  if (!html) {
    console.log('  ❌ No HTML found in database');
    return { url, hasHTML: false, detected: false };
  }
  
  const plainText = htmlToPlainText(html);
  
  console.log('📊 Detection Process:');
  console.log('='.repeat(60));
  const detected = shouldGenerateHowTo(html, plainText, debugLog);
  
  console.log('='.repeat(60));
  console.log(`\n✅ RESULT: ${detected ? 'HOWTO DETECTED - Will GENERATE HowTo' : 'NO HOWTO - Will SKIP HowTo generation'}`);
  
  return {
    url,
    hasHTML: true,
    detected,
    htmlLength: html.length,
    plainTextLength: plainText.length,
    debugLogs
  };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let urlToTest = 'https://www.alanranger.com/blog-on-photography/wildlife-photography-practice-assignment-free-lesson';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      urlToTest = args[i + 1];
      i++;
    }
  }
  
  console.log('🧪 HowTo Detection Test Script');
  console.log('='.repeat(60));
  
  const result = await testURL(urlToTest);
  
  console.log(`\n📊 Summary:`);
  console.log(`   URL: ${result.url}`);
  console.log(`   Has HTML: ${result.hasHTML ? '✅' : '❌'}`);
  console.log(`   HTML Length: ${result.htmlLength || 0}`);
  console.log(`   Plain Text Length: ${result.plainTextLength || 0}`);
  console.log(`   HowTo Detected: ${result.detected ? '✅ YES - Will GENERATE' : '❌ NO - Will SKIP'}`);
  
  if (result.detected) {
    console.log(`\n✅ RESULT: HowTo schema does NOT exist, so will GENERATE HowTo schema.`);
  } else {
    console.log(`\n✅ RESULT: HowTo schema EXISTS, so will SKIP (don't duplicate).`);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

