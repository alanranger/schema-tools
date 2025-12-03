#!/usr/bin/env node

/**
 * FAQ Detection Test Script
 * 
 * Tests FAQ detection logic against real blog post URLs from Supabase
 * Validates which posts have FAQ sections and whether detection works correctly
 * 
 * Usage:
 *   node scripts/test-faq-detection.js
 *   node scripts/test-faq-detection.js --limit 50
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
function stripHtmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * FAQ Detection Logic (extracted from index.html)
 */
function hasExistingFAQBlock(articleBody, html, debugLog = null) {
  if (!articleBody && !html) {
    if (debugLog) debugLog('No articleBody or HTML provided');
    return false;
  }
  
  const rawHtml = html || '';
  
  // Extract text from raw HTML
  let rawHtmlText = '';
  if (rawHtml) {
    try {
      // Use a simple HTML parser (jsdom would be better, but keeping it simple)
      rawHtmlText = stripHtmlToText(rawHtml);
    } catch (e) {
      rawHtmlText = rawHtml.replace(/<[^>]+>/g, ' ');
    }
  }
  
  // Combine all text sources
  const rawText = (articleBody || '').toLowerCase();
  const htmlText = rawHtmlText.toLowerCase();
  const combinedText = (rawText + ' ' + htmlText).toLowerCase();
  
  // FAQ markers
  const faqMarkers = [
    'faq',
    'faqs',
    'frequently asked questions',
    'common questions',
    'question:',
    'q:',
    'q –',
    'q.',
    'questions and answers',
    'q&a',
    'q and a'
  ];
  
  // Check for FAQ markers in combined text
  for (const marker of faqMarkers) {
    if (combinedText.includes(marker.toLowerCase())) {
      if (debugLog) debugLog(`Found marker "${marker}" in text`);
      return true;
    }
  }
  
  // Check for numbered questions pattern
  const numberedQuestionPattern = /\d+\.\s+(how|what|why|when|where|who|which|can|should|will|does|is|are|do|did|would|could|may)\s+/i;
  if (numberedQuestionPattern.test(combinedText)) {
    const numberedMatches = combinedText.match(/\d+\.\s+(how|what|why|when|where|who|which|can|should|will|does|is|are|do|did|would|could|may)\s+/gi);
    if (numberedMatches && numberedMatches.length >= 2) {
      if (debugLog) debugLog(`Found ${numberedMatches.length} numbered questions`);
      return true;
    }
  }
  
  // Check for FAQ in raw HTML string (heading patterns)
  if (rawHtml) {
    const rawHtmlLower = rawHtml.toLowerCase();
    
    // Check for FAQ markers in HTML
    for (const marker of faqMarkers) {
      if (rawHtmlLower.includes(marker.toLowerCase())) {
        if (debugLog) debugLog(`Found marker "${marker}" in raw HTML`);
        return true;
      }
    }
    
    // Check for "FAQs -" or "FAQ -" pattern in HTML headings
    if (/<h[1-6][^>]*>.*faqs?\s*[-–—:]/i.test(rawHtml)) {
      if (debugLog) debugLog(`Found "FAQs -" pattern in HTML heading`);
      return true;
    }
    
    // Check for headings with FAQ/Question
    const headingMatches = rawHtml.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi);
    if (headingMatches) {
      for (const heading of headingMatches) {
        const headingText = heading.toLowerCase();
        if (headingText.includes('faq') || headingText.includes('faqs') || headingText.includes('question')) {
          if (debugLog) debugLog(`Found FAQ/Question in heading: ${heading.substring(0, 80)}`);
          return true;
        }
      }
    }
  }
  
  if (debugLog) debugLog('No FAQ markers found');
  return false;
}

/**
 * Fetch HTML for a URL from Supabase
 */
async function fetchPageHtml(url) {
  try {
    // Try with trailing slash
    let { data, error } = await supabase
      .from('page_html')
      .select('html_content')
      .eq('url', url)
      .limit(1)
      .maybeSingle();
    
    // If not found, try with trailing slash
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
    
    // If still not found, try without trailing slash
    if (!data && url.endsWith('/')) {
      const result = await supabase
        .from('page_html')
        .select('html_content')
        .eq('url', url.slice(0, -1))
        .limit(1)
        .maybeSingle();
      data = result.data;
      error = result.error;
    }
    
    if (error) {
      console.warn(`  ⚠️  Error fetching HTML for ${url}: ${error.message}`);
      return null;
    }
    
    return data && data.html_content ? data.html_content : null;
  } catch (error) {
    console.warn(`  ⚠️  Exception fetching HTML for ${url}: ${error.message}`);
    return null;
  }
}

/**
 * Test FAQ detection for a single URL
 */
async function testURL(url) {
  const debugLogs = [];
  const debugLog = (msg) => debugLogs.push(msg);
  
  // Fetch HTML
  const html = await fetchPageHtml(url);
  
  if (!html) {
    return {
      url,
      hasHTML: false,
      detected: false,
      reason: 'No HTML found in database'
    };
  }
  
  // Extract article body (simplified - matching what generator does)
  let articleBody = stripHtmlToText(html);
  
  // Simulate the cleaning that happens in the generator
  // (This is a simplified version - the actual cleanFullArticleBody is more complex)
  articleBody = articleBody.replace(/\[\/[^\]]+\]/g, '');
  articleBody = articleBody.replace(/\/Cart\s+\d+/gi, '');
  articleBody = articleBody.replace(/Sign In My Account/gi, '');
  
  // Test detection with both cleaned articleBody AND raw HTML
  const detected = hasExistingFAQBlock(articleBody, html, debugLog);
  
  // Also check if FAQ schema file already exists in repo
  const slug = url.split('/').filter(Boolean).pop();
  const faqSchemaFile = `${slug}_faq.json`;
  
  return {
    url,
    slug,
    hasHTML: true,
    detected,
    htmlLength: html.length,
    articleBodyLength: articleBody.length,
    debugLogs,
    faqSchemaFile
  };
}

/**
 * Main test function
 */
async function main() {
  const args = process.argv.slice(2);
  let limit = 50;
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }
  
  console.log('🧪 FAQ Detection Test Script');
  console.log('='.repeat(60));
  console.log(`Testing up to ${limit} blog post URLs from Supabase\n`);
  
  try {
    // Fetch blog post URLs from page_html table
    console.log('📡 Fetching blog post URLs from Supabase...');
    const { data: htmlData, error: htmlError } = await supabase
      .from('page_html')
      .select('url')
      .like('url', '%/blog-on-photography/%')
      .neq('url', 'https://www.alanranger.com/blog-on-photography')
      .neq('url', 'https://www.alanranger.com/blog-on-photography/');
    
    if (htmlError) {
      console.error(`❌ Error fetching URLs: ${htmlError.message}`);
      process.exit(1);
    }
    
    if (!htmlData || htmlData.length === 0) {
      console.error('❌ No blog post URLs found');
      process.exit(1);
    }
    
    // Get distinct URLs and filter out index page
    const urlSet = new Set();
    htmlData.forEach(row => {
      const url = row.url;
      // Only include URLs that are actual blog posts (have a slug after /blog-on-photography/)
      if (url && url.includes('/blog-on-photography/') && url !== 'https://www.alanranger.com/blog-on-photography' && url !== 'https://www.alanranger.com/blog-on-photography/') {
        // Remove trailing slash for consistency
        const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        urlSet.add(cleanUrl);
      }
    });
    
    const urls = Array.from(urlSet).slice(0, limit);
    console.log(`✅ Found ${urls.length} blog post URLs\n`);
    
    // Test specific URLs first (the ones user reported as problematic)
    const specificURLs = [
      'https://www.alanranger.com/blog-on-photography/what-is-iso-in-photography',
      'https://www.alanranger.com/blog-on-photography/what-is-framing-in-photography',
      'https://www.alanranger.com/blog-on-photography/the-art-of-storytelling-photography'
    ];
    
    console.log('🔍 Testing specific problematic URLs first...\n');
    for (const url of specificURLs) {
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
    
    // Test each URL
    console.log('🔍 Testing FAQ detection...\n');
    const results = [];
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const slug = url.substring(url.lastIndexOf('/') + 1);
      const isSpecific = specificURLs.includes(url);
      
      if (isSpecific) {
        console.log(`\n🎯 TESTING SPECIFIC URL: ${slug}`);
        console.log('='.repeat(60));
      } else {
        process.stdout.write(`[${i + 1}/${urls.length}] Testing: ${slug}... `);
      }
      
      const result = await testURL(url);
      results.push(result);
      
      if (isSpecific) {
        console.log(`\nResult: ${result.detected ? '✅ FAQ DETECTED' : '❌ FAQ NOT DETECTED'}`);
        console.log(`HTML length: ${result.htmlLength || 0}`);
        console.log(`ArticleBody length: ${result.articleBodyLength || 0}`);
        if (result.debugLogs && result.debugLogs.length > 0) {
          console.log('\nDebug logs:');
          result.debugLogs.forEach(log => console.log(`  - ${log}`));
        }
        console.log('='.repeat(60) + '\n');
      } else {
        if (result.detected) {
          console.log('✅ FAQ DETECTED');
        } else if (!result.hasHTML) {
          console.log('⚠️  NO HTML');
        } else {
          console.log('❌ NOT DETECTED');
        }
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Generate report
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    const detected = results.filter(r => r.detected);
    const notDetected = results.filter(r => !r.detected && r.hasHTML);
    const noHTML = results.filter(r => !r.hasHTML);
    
    console.log(`\n✅ FAQ Detected: ${detected.length} URLs`);
    console.log(`❌ FAQ NOT Detected: ${notDetected.length} URLs`);
    console.log(`⚠️  No HTML Available: ${noHTML.length} URLs`);
    console.log(`📊 Total Tested: ${results.length} URLs`);
    
    // Check which URLs have existing FAQ schema files (should NOT have them if FAQ detected)
    const fs = await import('fs');
    const schemaRepoPath = path.resolve(__dirname, '../../alanranger-schema');
    const existingFAQFiles = new Set();
    
    if (fs.existsSync(schemaRepoPath)) {
      try {
        const files = fs.readdirSync(schemaRepoPath);
        files.forEach(file => {
          if (file.endsWith('_faq.json')) {
            existingFAQFiles.add(file);
          }
        });
      } catch (e) {
        console.warn(`  ⚠️  Could not read schema repo: ${e.message}`);
      }
    }
    
    // Show URLs where FAQ was NOT detected (potential issues)
    if (notDetected.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('⚠️  URLs WHERE FAQ WAS NOT DETECTED (May need investigation):');
      console.log('='.repeat(60));
      notDetected.forEach((result, idx) => {
        const hasExistingFile = result.faqSchemaFile && existingFAQFiles.has(result.faqSchemaFile);
        console.log(`\n${idx + 1}. ${result.url}`);
        console.log(`   HTML length: ${result.htmlLength}`);
        console.log(`   ArticleBody length: ${result.articleBodyLength}`);
        if (hasExistingFile) {
          console.log(`   ⚠️  WARNING: FAQ schema file exists: ${result.faqSchemaFile}`);
          console.log(`      This means FAQ was generated even though FAQ section exists!`);
        }
        if (result.debugLogs.length > 0) {
          console.log(`   Debug logs:`);
          result.debugLogs.forEach(log => console.log(`     - ${log}`));
        }
      });
    }
    
    // Show URLs where FAQ WAS detected but schema file exists (shouldn't happen)
    const detectedWithFiles = detected.filter(r => {
      if (!r.faqSchemaFile) return false;
      return existingFAQFiles.has(r.faqSchemaFile);
    });
    
    if (detectedWithFiles.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('🚨 CRITICAL: URLs WHERE FAQ WAS DETECTED BUT SCHEMA FILE EXISTS:');
      console.log('='.repeat(60));
      console.log('These should NOT have FAQ schema files!');
      detectedWithFiles.forEach((result, idx) => {
        console.log(`\n${idx + 1}. ${result.url}`);
        console.log(`   FAQ schema file: ${result.faqSchemaFile}`);
        console.log(`   ⚠️  This file should be deleted - FAQ was correctly detected!`);
      });
    }
    
    // Show sample of detected URLs
    if (detected.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('✅ Sample URLs WHERE FAQ WAS DETECTED (First 5):');
      console.log('='.repeat(60));
      detected.slice(0, 5).forEach((result, idx) => {
        console.log(`${idx + 1}. ${result.url}`);
      });
    }
    
    // Save detailed report to file
    const reportPath = path.resolve(__dirname, '../outputs/faq-detection-test-report.json');
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      totalTested: results.length,
      detected: detected.length,
      notDetected: notDetected.length,
      noHTML: noHTML.length,
      results: results.map(r => ({
        url: r.url,
        detected: r.detected,
        hasHTML: r.hasHTML,
        htmlLength: r.htmlLength,
        articleBodyLength: r.articleBodyLength,
        debugLogs: r.debugLogs
      }))
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Exit with error code if detection failed for any URLs
    if (notDetected.length > 0) {
      console.log(`\n⚠️  WARNING: ${notDetected.length} URLs had HTML but FAQ was not detected!`);
      console.log('   This may indicate detection logic needs improvement.');
      process.exit(1);
    }
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

