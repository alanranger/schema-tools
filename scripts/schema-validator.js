#!/usr/bin/env node

/**
 * Schema Validator Agent
 * 
 * Automated tool to test URLs against:
 * - https://validator.schema.org
 * - https://search.google.com/test/rich-results
 * 
 * Usage:
 *   node schema-validator.js <url>
 *   node schema-validator.js --batch urls.txt
 *   node schema-validator.js <url> --json
 */

const puppeteer = require('puppeteer');
const { program } = require('commander');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const SCHEMA_ORG_VALIDATOR_URL = 'https://validator.schema.org/#url=';
const GOOGLE_RICH_RESULTS_URL = 'https://search.google.com/test/rich-results';

program
  .name('schema-validator')
  .description('Validate schema markup on live URLs')
  .version('1.0.0')
  .argument('[url]', 'URL to validate')
  .option('-b, --batch <file>', 'Process multiple URLs from a text file (one URL per line)')
  .option('-j, --json', 'Output results as JSON')
  .option('-o, --output <file>', 'Save results to a file')
  .option('--schema-org-only', 'Only test against Schema.org validator')
  .option('--google-only', 'Only test against Google Rich Results Test')
  .option('--timeout <ms>', 'Timeout for page loads (ms)', '30000')
  .parse(process.argv);

/**
 * Fetch and parse page content, extracting schema markup
 */
async function fetchPageSchema(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: parseInt(program.opts().timeout) });
    
    // Extract all JSON-LD scripts
    const jsonLdScripts = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      return scripts.map(script => {
        try {
          return JSON.parse(script.textContent);
        } catch (e) {
          return null;
        }
      }).filter(Boolean);
    });
    
    // Extract Microdata (if any)
    const microdata = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[itemscope]'));
      return items.length > 0 ? 'Microdata detected' : null;
    });
    
    // Get page HTML for validation
    const htmlContent = await page.content();
    
    await browser.close();
    
    return {
      url,
      jsonLd: jsonLdScripts,
      microdata: microdata !== null,
      htmlLength: htmlContent.length,
      schemaFound: jsonLdScripts.length > 0 || microdata !== null
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

/**
 * Validate against Schema.org validator
 */
async function validateSchemaOrg(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    const validatorUrl = `${SCHEMA_ORG_VALIDATOR_URL}${encodeURIComponent(url)}`;
    await page.goto(validatorUrl, { waitUntil: 'networkidle2', timeout: parseInt(program.opts().timeout) });
    
    // Wait for validation to complete
    await page.waitForTimeout(5000);
    
    // Try to extract validation results
    const results = await page.evaluate(() => {
      const result = {
        valid: false,
        errors: [],
        warnings: [],
        schemasFound: []
      };
      
      // Look for error messages
      const errorElements = document.querySelectorAll('.error, .alert-danger, [class*="error"]');
      errorElements.forEach(el => {
        const text = el.textContent.trim();
        if (text) result.errors.push(text);
      });
      
      // Look for warning messages
      const warningElements = document.querySelectorAll('.warning, .alert-warning, [class*="warning"]');
      warningElements.forEach(el => {
        const text = el.textContent.trim();
        if (text) result.warnings.push(text);
      });
      
      // Look for success indicators
      const successElements = document.querySelectorAll('.success, .alert-success, [class*="success"]');
      if (successElements.length > 0) {
        result.valid = true;
      }
      
      // Look for detected schema types
      const schemaElements = document.querySelectorAll('[class*="schema"], [class*="type"]');
      schemaElements.forEach(el => {
        const text = el.textContent.trim();
        if (text && text.length < 100) result.schemasFound.push(text);
      });
      
      // Check page title for validation status
      const title = document.title.toLowerCase();
      if (title.includes('valid') || title.includes('success')) {
        result.valid = true;
      }
      
      return result;
    });
    
    await browser.close();
    
    // If no explicit valid/invalid detected, check if errors array is empty
    if (results.errors.length === 0 && results.warnings.length === 0) {
      results.valid = true;
    }
    
    return {
      validator: 'Schema.org',
      url: validatorUrl,
      ...results
    };
  } catch (error) {
    await browser.close();
    return {
      validator: 'Schema.org',
      url: validatorUrl,
      valid: false,
      errors: [`Failed to validate: ${error.message}`],
      warnings: [],
      schemasFound: []
    };
  }
}

/**
 * Validate against Google Rich Results Test
 */
async function validateGoogleRichResults(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(GOOGLE_RICH_RESULTS_URL, { waitUntil: 'networkidle2', timeout: parseInt(program.opts().timeout) });
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Find URL input and submit
    try {
      await page.waitForSelector('input[type="url"], input[name="url"], input[placeholder*="URL"]', { timeout: 5000 });
      await page.type('input[type="url"], input[name="url"], input[placeholder*="URL"]', url);
      
      // Find and click test button
      await page.waitForTimeout(1000);
      // Try to find submit button using XPath
      const buttons = await page.$x('//button[contains(text(), "Test") or contains(text(), "TEST") or @type="submit"]');
      if (buttons.length > 0) {
        await buttons[0].click();
      } else {
        // Try pressing Enter as fallback
        await page.keyboard.press('Enter');
      }
      
      // Wait for results
      await page.waitForTimeout(8000);
      
      // Extract results
      const results = await page.evaluate(() => {
        const result = {
          valid: false,
          errors: [],
          warnings: [],
          richResults: [],
          eligible: false
        };
        
        // Look for success indicators
        const successElements = document.querySelectorAll('[class*="success"], [class*="valid"], [class*="eligible"]');
        successElements.forEach(el => {
          const text = el.textContent.trim();
          if (text.toLowerCase().includes('eligible') || text.toLowerCase().includes('valid')) {
            result.valid = true;
            result.eligible = true;
          }
        });
        
        // Look for error messages
        const errorElements = document.querySelectorAll('[class*="error"], [class*="invalid"], [class*="issue"]');
        errorElements.forEach(el => {
          const text = el.textContent.trim();
          if (text && text.length < 200) {
            if (text.toLowerCase().includes('error') || text.toLowerCase().includes('invalid')) {
              result.errors.push(text);
            } else {
              result.warnings.push(text);
            }
          }
        });
        
        // Look for detected rich result types
        const richResultElements = document.querySelectorAll('[class*="rich"], [class*="result"], [class*="type"]');
        richResultElements.forEach(el => {
          const text = el.textContent.trim();
          if (text && text.length < 100 && !result.richResults.includes(text)) {
            result.richResults.push(text);
          }
        });
        
        // Check page title
        const title = document.title.toLowerCase();
        if (title.includes('eligible') || title.includes('valid')) {
          result.valid = true;
          result.eligible = true;
        }
        
        return result;
      });
      
      await browser.close();
      
      return {
        validator: 'Google Rich Results Test',
        url: GOOGLE_RICH_RESULTS_URL,
        ...results
      };
    } catch (submitError) {
      // If automation fails, return manual instruction
      await browser.close();
      return {
        validator: 'Google Rich Results Test',
        url: GOOGLE_RICH_RESULTS_URL,
        valid: false,
        errors: [`Automation failed. Please test manually at: ${GOOGLE_RICH_RESULTS_URL}?url=${encodeURIComponent(url)}`],
        warnings: [],
        richResults: [],
        eligible: false,
        manualUrl: `${GOOGLE_RICH_RESULTS_URL}?url=${encodeURIComponent(url)}`
      };
    }
  } catch (error) {
    await browser.close();
    return {
      validator: 'Google Rich Results Test',
      url: GOOGLE_RICH_RESULTS_URL,
      valid: false,
      errors: [`Failed to validate: ${error.message}`],
      warnings: [],
      richResults: [],
      eligible: false
    };
  }
}

/**
 * Process a single URL
 */
async function validateUrl(url) {
  const results = {
    url,
    timestamp: new Date().toISOString(),
    pageAnalysis: null,
    validations: []
  };
  
  try {
    console.log(`\n🔍 Analyzing: ${url}`);
    
    // Fetch and analyze page
    results.pageAnalysis = await fetchPageSchema(url);
    console.log(`   ✓ Found ${results.pageAnalysis.jsonLd.length} JSON-LD script(s)`);
    if (results.pageAnalysis.microdata) {
      console.log(`   ✓ Microdata detected`);
    }
    
    // Validate against Schema.org
    if (!program.opts().googleOnly) {
      console.log(`\n📋 Testing against Schema.org validator...`);
      const schemaOrgResult = await validateSchemaOrg(url);
      results.validations.push(schemaOrgResult);
      
      if (schemaOrgResult.valid) {
        console.log(`   ✓ Schema.org: VALID`);
      } else {
        console.log(`   ✗ Schema.org: INVALID`);
        if (schemaOrgResult.errors.length > 0) {
          console.log(`     Errors: ${schemaOrgResult.errors.length}`);
        }
      }
    }
    
    // Validate against Google Rich Results
    if (!program.opts().schemaOrgOnly) {
      console.log(`\n🔎 Testing against Google Rich Results Test...`);
      const googleResult = await validateGoogleRichResults(url);
      results.validations.push(googleResult);
      
      if (googleResult.valid) {
        console.log(`   ✓ Google: ELIGIBLE`);
      } else {
        console.log(`   ✗ Google: Not eligible or errors found`);
        if (googleResult.errors.length > 0) {
          console.log(`     Errors: ${googleResult.errors.length}`);
        }
      }
    }
    
    return results;
  } catch (error) {
    results.error = error.message;
    console.error(`   ✗ Error: ${error.message}`);
    return results;
  }
}

/**
 * Format results for display
 */
function formatResults(results, json = false) {
  if (json) {
    return JSON.stringify(results, null, 2);
  }
  
  let output = `\n${'='.repeat(60)}\n`;
  output += `VALIDATION RESULTS\n`;
  output += `${'='.repeat(60)}\n`;
  output += `URL: ${results.url}\n`;
  output += `Timestamp: ${results.timestamp}\n\n`;
  
  if (results.pageAnalysis) {
    output += `PAGE ANALYSIS:\n`;
    output += `  Schema Found: ${results.pageAnalysis.schemaFound ? 'Yes' : 'No'}\n`;
    output += `  JSON-LD Scripts: ${results.pageAnalysis.jsonLd.length}\n`;
    output += `  Microdata: ${results.pageAnalysis.microdata ? 'Yes' : 'No'}\n\n`;
  }
  
  results.validations.forEach(validation => {
    output += `${validation.validator}:\n`;
    output += `  Status: ${validation.valid ? '✓ VALID' : '✗ INVALID'}\n`;
    
    if (validation.richResults && validation.richResults.length > 0) {
      output += `  Rich Results Detected: ${validation.richResults.join(', ')}\n`;
    }
    
    if (validation.errors.length > 0) {
      output += `  Errors:\n`;
      validation.errors.forEach(err => {
        output += `    - ${err}\n`;
      });
    }
    
    if (validation.warnings.length > 0) {
      output += `  Warnings:\n`;
      validation.warnings.forEach(warn => {
        output += `    - ${warn}\n`;
      });
    }
    
    output += `\n`;
  });
  
  if (results.error) {
    output += `ERROR: ${results.error}\n`;
  }
  
  return output;
}

/**
 * Main execution
 */
async function main() {
  const options = program.opts();
  const url = program.args[0];
  
  let urls = [];
  
  if (options.batch) {
    // Read URLs from file
    try {
      const fileContent = await fs.readFile(options.batch, 'utf-8');
      urls = fileContent.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && (line.startsWith('http://') || line.startsWith('https://')));
      
      if (urls.length === 0) {
        console.error('No valid URLs found in batch file');
        process.exit(1);
      }
      
      console.log(`Found ${urls.length} URL(s) to validate\n`);
    } catch (error) {
      console.error(`Error reading batch file: ${error.message}`);
      process.exit(1);
    }
  } else if (url) {
    urls = [url];
  } else {
    program.help();
    process.exit(1);
  }
  
  const allResults = [];
  
  for (const urlToValidate of urls) {
    const result = await validateUrl(urlToValidate);
    allResults.push(result);
    
    if (!options.json) {
      console.log(formatResults(result));
    }
  }
  
  // Output results
  if (options.json) {
    const jsonOutput = JSON.stringify(allResults, null, 2);
    console.log(jsonOutput);
    
    if (options.output) {
      await fs.writeFile(options.output, jsonOutput, 'utf-8');
      console.error(`\nResults saved to: ${options.output}`);
    }
  } else if (options.output) {
    const textOutput = allResults.map(r => formatResults(r)).join('\n');
    await fs.writeFile(options.output, textOutput, 'utf-8');
    console.log(`\nResults saved to: ${options.output}`);
  }
  
  // Summary
  if (!options.json && urls.length > 1) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`SUMMARY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total URLs: ${urls.length}`);
    const validCount = allResults.filter(r => 
      r.validations.every(v => v.valid)
    ).length;
    console.log(`Valid: ${validCount}`);
    console.log(`Invalid: ${urls.length - validCount}`);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { validateUrl, fetchPageSchema, validateSchemaOrg, validateGoogleRichResults };

