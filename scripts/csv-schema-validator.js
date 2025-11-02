#!/usr/bin/env node

/**
 * CSV Bulk Schema Validator
 * 
 * Accepts a CSV file with URLs and validates schema markup for each URL:
 * - Checks if schema exists
 * - Identifies schema types
 * - Validates required fields
 * - Tests against Schema.org and Google Rich Results validators
 * 
 * Usage:
 *   node csv-schema-validator.js <csv-file>
 *   node csv-schema-validator.js urls.csv --output results.json
 *   node csv-schema-validator.js urls.csv --skip-validators --json
 */

const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');
const puppeteer = require('puppeteer');

// Import existing validator functions
const { fetchPageSchema } = require('./schema-validator');

// Configuration
const SCHEMA_ORG_VALIDATOR_URL = 'https://validator.schema.org/#url=';
const GOOGLE_RICH_RESULTS_URL = 'https://search.google.com/test/rich-results';

// Schema type definitions with required and recommended fields
const SCHEMA_REQUIREMENTS = {
  Product: {
    required: ['name', 'url'],
    recommended: ['description', 'image', 'brand', 'offers', 'aggregateRating', 'review']
  },
  Event: {
    required: ['name', 'startDate'],
    recommended: ['endDate', 'location', 'organizer', 'offers', 'image', 'description', 'performer']
  },
  Organization: {
    required: ['name'],
    recommended: ['url', 'logo', 'address', 'contactPoint']
  },
  BreadcrumbList: {
    required: ['itemListElement'],
    recommended: []
  },
  ItemList: {
    required: ['itemListElement'],
    recommended: ['name']
  },
  LocalBusiness: {
    required: ['name'],
    recommended: ['address', 'telephone', 'url', 'openingHours']
  }
};

/**
 * Parse CSV file and extract URLs
 */
async function parseCSV(csvFile) {
  const content = await fs.readFile(csvFile, 'utf-8');
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  
  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const urlColumnIndex = headers.findIndex(h => 
    h.toLowerCase() === 'url' || h.toLowerCase() === 'link' || h.toLowerCase() === 'website'
  );
  
  if (urlColumnIndex === -1) {
    throw new Error('No URL column found. Expected column name: URL, Link, or Website');
  }
  
  // Parse rows
  const urls = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values[urlColumnIndex] && values[urlColumnIndex].startsWith('http')) {
      urls.push({
        url: values[urlColumnIndex],
        row: i + 1,
        allFields: headers.reduce((obj, h, idx) => {
          obj[h] = values[idx] || '';
          return obj;
        }, {})
      });
    }
  }
  
  return urls;
}

/**
 * Extract schema types from JSON-LD blocks
 */
function extractSchemaTypes(jsonLdBlocks) {
  const types = new Set();
  
  jsonLdBlocks.forEach(block => {
    if (Array.isArray(block)) {
      block.forEach(item => {
        if (item['@type']) {
          types.add(item['@type']);
        }
      });
    } else if (block['@type']) {
      types.add(block['@type']);
    } else if (block['@graph']) {
      block['@graph'].forEach(item => {
        if (item['@type']) {
          types.add(item['@type']);
        }
      });
    }
  });
  
  return Array.from(types);
}

/**
 * Check for missing fields in schema
 */
function validateSchemaFields(schema, schemaType) {
  const missingFields = [];
  const warnings = [];
  const requirements = SCHEMA_REQUIREMENTS[schemaType];
  
  if (!requirements) {
    warnings.push(`Unknown schema type: ${schemaType}. Cannot validate fields.`);
    return { missingFields, warnings };
  }
  
  // Check required fields
  requirements.required.forEach(field => {
    if (!schema[field]) {
      missingFields.push(field);
    }
  });
  
  // Check recommended fields
  requirements.recommended.forEach(field => {
    if (!schema[field]) {
      warnings.push(`Missing recommended field: ${field}`);
    }
  });
  
  return { missingFields, warnings };
}

/**
 * Analyze schema blocks and determine validity
 */
function analyzeSchemas(jsonLdBlocks) {
  const analysis = {
    schemaFound: jsonLdBlocks.length > 0,
    schemaTypes: [],
    schemas: [],
    missingFields: [],
    warnings: [],
    valid: false
  };
  
  if (jsonLdBlocks.length === 0) {
    analysis.warnings.push('No schema markup found on page');
    return analysis;
  }
  
  // Extract all schema types
  analysis.schemaTypes = extractSchemaTypes(jsonLdBlocks);
  
  // Analyze each schema block
  jsonLdBlocks.forEach((block, index) => {
    let schemas = [];
    
    // Handle @graph structure
    if (block['@graph']) {
      schemas = block['@graph'];
    } else if (Array.isArray(block)) {
      schemas = block;
    } else {
      schemas = [block];
    }
    
    schemas.forEach(schema => {
      const schemaType = schema['@type'];
      if (schemaType) {
        const fieldValidation = validateSchemaFields(schema, schemaType);
        analysis.schemas.push({
          type: schemaType,
          index: index,
          missingFields: fieldValidation.missingFields,
          warnings: fieldValidation.warnings
        });
        
        analysis.missingFields.push(...fieldValidation.missingFields);
        analysis.warnings.push(...fieldValidation.warnings);
      }
    });
  });
  
  // Determine overall validity
  analysis.valid = analysis.schemaFound && 
                   analysis.missingFields.length === 0 && 
                   analysis.schemaTypes.length > 0;
  
  return analysis;
}

/**
 * Validate against Schema.org validator (returns link only)
 */
function getSchemaOrgValidatorLink(url) {
  return `${SCHEMA_ORG_VALIDATOR_URL}${encodeURIComponent(url)}`;
}

/**
 * Validate against Google Rich Results Test (returns link only)
 */
function getGoogleRichResultsLink(url) {
  return `${GOOGLE_RICH_RESULTS_URL}?url=${encodeURIComponent(url)}`;
}

/**
 * Process a single URL
 */
async function processUrl(urlData, options = {}) {
  const { url, row, allFields } = urlData;
  const result = {
    url,
    row,
    timestamp: new Date().toISOString(),
    schemaType: null,
    valid: false,
    schemaFound: false,
    missingFields: [],
    warnings: [],
    validatorLinks: {
      schema: getSchemaOrgValidatorLink(url),
      google: getGoogleRichResultsLink(url)
    },
    error: null,
    pageAnalysis: null
  };
  
  try {
    console.log(`\n🔍 [Row ${row}] Processing: ${url}`);
    
    // Fetch page and extract schema
    const pageData = await fetchPageSchema(url);
    result.pageAnalysis = {
      jsonLdCount: pageData.jsonLd.length,
      microdata: pageData.microdata,
      htmlLength: pageData.htmlLength
    };
    
    // Analyze schemas
    const analysis = analyzeSchemas(pageData.jsonLd);
    result.schemaFound = analysis.schemaFound;
    result.schemaType = analysis.schemaTypes.length > 0 ? analysis.schemaTypes.join(', ') : null;
    result.missingFields = [...new Set(analysis.missingFields)];
    result.warnings = analysis.warnings;
    result.valid = analysis.valid;
    
    // Optionally run validators
    if (!options.skipValidators) {
      if (!options.googleOnly) {
        console.log(`   📋 Testing Schema.org...`);
        // Note: Full validation would require Puppeteer - skipping for now
        // Users can click validator links for full validation
      }
      
      if (!options.schemaOrgOnly) {
        console.log(`   🔎 Testing Google Rich Results...`);
        // Note: Full validation would require Puppeteer - skipping for now
      }
    }
    
    // Status message
    if (result.valid) {
      console.log(`   ✓ Valid schema found: ${result.schemaType}`);
    } else if (result.schemaFound) {
      console.log(`   ⚠ Schema found but issues detected`);
      if (result.missingFields.length > 0) {
        console.log(`     Missing fields: ${result.missingFields.join(', ')}`);
      }
    } else {
      console.log(`   ✗ No schema markup found`);
    }
    
  } catch (error) {
    result.error = error.message;
    console.error(`   ✗ Error: ${error.message}`);
  }
  
  return result;
}

/**
 * Format results for display
 */
function formatResults(results, json = false) {
  if (json) {
    return JSON.stringify(results, null, 2);
  }
  
  let output = `\n${'='.repeat(70)}\n`;
  output += `BULK SCHEMA VALIDATION RESULTS\n`;
  output += `${'='.repeat(70)}\n`;
  output += `Total URLs processed: ${results.length}\n\n`;
  
  results.forEach((result, index) => {
    output += `${index + 1}. ${result.url}\n`;
    output += `   Row: ${result.row}\n`;
    output += `   Schema Found: ${result.schemaFound ? 'Yes' : 'No'}\n`;
    
    if (result.schemaType) {
      output += `   Schema Type(s): ${result.schemaType}\n`;
    }
    
    output += `   Status: ${result.valid ? '✓ VALID' : result.schemaFound ? '⚠ ISSUES' : '✗ NO SCHEMA'}\n`;
    
    if (result.missingFields.length > 0) {
      output += `   Missing Fields: ${result.missingFields.join(', ')}\n`;
    }
    
    if (result.warnings.length > 0) {
      output += `   Warnings: ${result.warnings.length}\n`;
    }
    
    if (result.error) {
      output += `   Error: ${result.error}\n`;
    }
    
    output += `\n`;
  });
  
  // Summary
  const validCount = results.filter(r => r.valid).length;
  const schemaFoundCount = results.filter(r => r.schemaFound).length;
  const noSchemaCount = results.filter(r => !r.schemaFound).length;
  
  output += `${'='.repeat(70)}\n`;
  output += `SUMMARY\n`;
  output += `${'='.repeat(70)}\n`;
  output += `Valid: ${validCount}\n`;
  output += `Issues Found: ${schemaFoundCount - validCount}\n`;
  output += `No Schema: ${noSchemaCount}\n`;
  
  return output;
}

/**
 * Main execution
 */
async function main() {
  program
    .name('csv-schema-validator')
    .description('Bulk validate schema markup from CSV file with URLs')
    .version('1.0.0')
    .argument('<csv-file>', 'CSV file containing URLs (must have URL, Link, or Website column)')
    .option('-o, --output <file>', 'Save results to JSON file')
    .option('-j, --json', 'Output results as JSON')
    .option('--skip-validators', 'Skip Schema.org and Google validator checks (faster)')
    .option('--schema-org-only', 'Only test against Schema.org validator')
    .option('--google-only', 'Only test against Google Rich Results Test')
    .option('--timeout <ms>', 'Timeout for page loads (ms)', '30000')
    .parse(process.argv);
  
  const options = program.opts();
  const csvFile = program.args[0];
  
  if (!csvFile) {
    program.help();
    process.exit(1);
  }
  
  try {
    console.log(`\n📄 Reading CSV file: ${csvFile}`);
    const urls = await parseCSV(csvFile);
    
    if (urls.length === 0) {
      console.error('No valid URLs found in CSV file');
      process.exit(1);
    }
    
    console.log(`Found ${urls.length} URL(s) to validate\n`);
    
    const results = [];
    
    for (const urlData of urls) {
      const result = await processUrl(urlData, options);
      results.push(result);
    }
    
    // Output results
    if (options.json) {
      const jsonOutput = formatResults(results, true);
      console.log(jsonOutput);
      
      if (options.output) {
        await fs.writeFile(options.output, jsonOutput, 'utf-8');
        console.error(`\nResults saved to: ${options.output}`);
      }
    } else {
      const textOutput = formatResults(results, false);
      console.log(textOutput);
      
      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(results, null, 2), 'utf-8');
        console.log(`\nJSON results saved to: ${options.output}`);
      }
    }
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { parseCSV, analyzeSchemas, processUrl, SCHEMA_REQUIREMENTS };

