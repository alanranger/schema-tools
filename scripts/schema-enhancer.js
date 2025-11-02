#!/usr/bin/env node

/**
 * Schema Enhancement Agent
 * 
 * Takes validation results and generates enhanced schema blocks with:
 * - Missing fields filled with placeholders or inferred values
 * - Improved schema structure
 * - Export-ready JSON-LD
 * 
 * Usage:
 *   node schema-enhancer.js validation-results.json
 *   node schema-enhancer.js validation-results.json --output enhanced-schemas.json
 *   node schema-enhancer.js validation-results.json --format html
 */

const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');
const { fetchPageSchema } = require('./schema-validator');
const { SCHEMA_REQUIREMENTS } = require('./csv-schema-validator');

// Default values for missing fields
const DEFAULT_VALUES = {
  Product: {
    brand: { '@type': 'Brand', name: '[REPLACE WITH BRAND NAME]' },
    offers: {
      '@type': 'Offer',
      price: '[REPLACE WITH PRICE]',
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
      url: '[AUTO-INFERRED FROM PAGE URL]'
    },
    description: '[REPLACE WITH PRODUCT DESCRIPTION]',
    image: '[REPLACE WITH PRODUCT IMAGE URL]'
  },
  Event: {
    organizer: {
      '@type': 'Organization',
      name: 'Alan Ranger Photography',
      logo: 'https://images.squarespace-cdn.com/content/v1/5013f4b2c4aaa4752ac69b17/b859ad2b-1442-4595-b9a4-410c32299bf8/ALAN+RANGER+photography+LOGO+BLACK.+switched+small.png?format=1500w',
      url: 'https://www.alanranger.com'
    },
    performer: {
      '@type': 'Person',
      name: 'Alan Ranger'
    },
    location: {
      '@type': 'Place',
      name: '[REPLACE WITH VENUE NAME]',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'GB'
      }
    },
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
      validFrom: '[AUTO-INFERRED FROM START DATE]'
    },
    description: '[REPLACE WITH EVENT DESCRIPTION]',
    image: '[REPLACE WITH EVENT IMAGE URL]'
  },
  Organization: {
    url: '[REPLACE WITH ORGANIZATION URL]',
    logo: '[REPLACE WITH LOGO URL]',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'GB'
    }
  }
};

/**
 * Extract schema type from JSON-LD block
 */
function getSchemaType(schema) {
  if (schema['@type']) {
    return schema['@type'];
  }
  return null;
}

/**
 * Infer value from URL or existing schema
 */
function inferValue(field, url, existingSchema) {
  // Infer URL from page URL
  if (field === 'url' && url) {
    return url;
  }
  
  // Infer offers.url from page URL
  if (field === 'offers' && existingSchema?.offers && url) {
    if (typeof existingSchema.offers === 'object' && !Array.isArray(existingSchema.offers)) {
      return {
        ...existingSchema.offers,
        url: url
      };
    }
  }
  
  // Try to extract from existing schema
  if (existingSchema && existingSchema[field]) {
    return existingSchema[field];
  }
  
  return null;
}

/**
 * Enhance a single schema block
 */
function enhanceSchema(schema, schemaType, url, missingFields) {
  const enhanced = JSON.parse(JSON.stringify(schema)); // Deep clone
  
  // Ensure @type is set
  if (!enhanced['@type']) {
    enhanced['@type'] = schemaType;
  }
  
  // Ensure @context is set
  if (!enhanced['@context']) {
    enhanced['@context'] = 'https://schema.org';
  }
  
  // Fill missing required fields
  const requirements = SCHEMA_REQUIREMENTS[schemaType];
  if (requirements) {
    requirements.required.forEach(field => {
      if (!enhanced[field] || (Array.isArray(enhanced[field]) && enhanced[field].length === 0)) {
        const inferred = inferValue(field, url, enhanced);
        if (inferred) {
          enhanced[field] = inferred;
        } else if (DEFAULT_VALUES[schemaType] && DEFAULT_VALUES[schemaType][field]) {
          enhanced[field] = DEFAULT_VALUES[schemaType][field];
        } else {
          // Generic placeholder
          enhanced[field] = `[REPLACE WITH ${field.toUpperCase()}]`;
        }
      }
    });
    
    // Fill missing recommended fields (with placeholders)
    requirements.recommended.forEach(field => {
      if (!enhanced[field] || (Array.isArray(enhanced[field]) && enhanced[field].length === 0)) {
        const inferred = inferValue(field, url, enhanced);
        if (inferred) {
          enhanced[field] = inferred;
        } else if (DEFAULT_VALUES[schemaType] && DEFAULT_VALUES[schemaType][field]) {
          enhanced[field] = DEFAULT_VALUES[schemaType][field];
        }
        // Don't add placeholder for recommended fields if no default exists
      }
    });
  }
  
  // Special handling for nested objects
  if (schemaType === 'Product' && enhanced.offers && typeof enhanced.offers === 'object') {
    if (!enhanced.offers.url && url) {
      enhanced.offers.url = url;
    }
  }
  
  if (schemaType === 'Event' && enhanced.location && typeof enhanced.location === 'object') {
    if (!enhanced.location.address) {
      enhanced.location.address = DEFAULT_VALUES.Event.location.address;
    }
  }
  
  return enhanced;
}

/**
 * Enhance schemas from validation results
 */
function enhanceSchemasFromResults(validationResult) {
  const { url, pageAnalysis, schemaType, missingFields } = validationResult;
  const enhancements = {
    url,
    timestamp: new Date().toISOString(),
    originalSchemaTypes: schemaType ? schemaType.split(', ') : [],
    enhancedSchemas: [],
    addedFields: [],
    notes: []
  };
  
  if (!pageAnalysis || !validationResult.schemaFound) {
    enhancements.notes.push('No schema found on page. Cannot enhance.');
    return enhancements;
  }
  
  // We need the actual JSON-LD blocks - fetch them if not in result
  // For now, we'll create schemas based on detected types
  const schemaTypes = validationResult.schemaType ? validationResult.schemaType.split(', ') : [];
  
  if (schemaTypes.length === 0) {
    enhancements.notes.push('No schema types detected. Cannot enhance.');
    return enhancements;
  }
  
  // Generate enhanced schema for each detected type
  schemaTypes.forEach(type => {
    const baseSchema = {
      '@context': 'https://schema.org',
      '@type': type
    };
    
    // Add URL
    if (url) {
      baseSchema.url = url;
    }
    
    const enhanced = enhanceSchema(baseSchema, type, url, missingFields);
    enhancements.enhancedSchemas.push(enhanced);
    
    // Track what was added
    const added = [];
    Object.keys(enhanced).forEach(key => {
      if (!baseSchema[key] || JSON.stringify(baseSchema[key]) !== JSON.stringify(enhanced[key])) {
        added.push(key);
      }
    });
    enhancements.addedFields.push(...added);
  });
  
  return enhancements;
}

/**
 * Fetch actual schema from page and enhance it
 */
async function enhanceSchemaFromPage(url) {
  try {
    const pageData = await fetchPageSchema(url);
    
    if (!pageData.jsonLd || pageData.jsonLd.length === 0) {
      return {
        url,
        error: 'No schema found on page',
        enhancedSchemas: []
      };
    }
    
    const enhancements = {
      url,
      timestamp: new Date().toISOString(),
      enhancedSchemas: [],
      addedFields: [],
      notes: []
    };
    
    // Process each JSON-LD block
    pageData.jsonLd.forEach((block, index) => {
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
        const schemaType = getSchemaType(schema);
        if (schemaType && SCHEMA_REQUIREMENTS[schemaType]) {
          // Identify missing fields
          const requirements = SCHEMA_REQUIREMENTS[schemaType];
          const missingFields = requirements.required.filter(field => !schema[field]);
          
          // Enhance the schema
          const enhanced = enhanceSchema(schema, schemaType, url, missingFields);
          enhancements.enhancedSchemas.push(enhanced);
          
          // Track added fields
          requirements.required.forEach(field => {
            if (!schema[field] && enhanced[field]) {
              enhancements.addedFields.push(`${schemaType}.${field}`);
            }
          });
        } else {
          // Keep schema as-is if we don't know how to enhance it
          enhancements.enhancedSchemas.push(schema);
        }
      });
    });
    
    return enhancements;
  } catch (error) {
    return {
      url,
      error: error.message,
      enhancedSchemas: []
    };
  }
}

/**
 * Format enhanced schemas as HTML script tags
 */
function formatAsHTMLScriptTags(enhancedSchemas) {
  return enhancedSchemas.map(schema => {
    const json = JSON.stringify(schema, null, 2);
    return `<script type="application/ld+json">\n${json}\n</script>`;
  }).join('\n\n');
}

/**
 * Process validation results file
 */
async function processValidationResults(inputFile, options) {
  const content = await fs.readFile(inputFile, 'utf-8');
  const results = JSON.parse(content);
  
  // Handle both single result and array of results
  const resultsArray = Array.isArray(results) ? results : [results];
  
  const enhancedResults = [];
  
  for (const result of resultsArray) {
    console.log(`\n🔧 Enhancing schema for: ${result.url}`);
    
    let enhancement;
    
    if (options.usePageData) {
      // Fetch fresh data from page
      enhancement = await enhanceSchemaFromPage(result.url);
    } else {
      // Use validation result data
      enhancement = enhanceSchemasFromResults(result);
    }
    
    enhancement.originalResult = {
      schemaType: result.schemaType,
      valid: result.valid,
      missingFields: result.missingFields,
      warnings: result.warnings
    };
    
    enhancedResults.push(enhancement);
    
    if (enhancement.enhancedSchemas.length > 0) {
      console.log(`   ✓ Generated ${enhancement.enhancedSchemas.length} enhanced schema(s)`);
      if (enhancement.addedFields.length > 0) {
        console.log(`   ✓ Added fields: ${enhancement.addedFields.join(', ')}`);
      }
    } else {
      console.log(`   ⚠ No schemas to enhance`);
    }
  }
  
  return enhancedResults;
}

/**
 * Main execution
 */
async function main() {
  program
    .name('schema-enhancer')
    .description('Enhance schema markup based on validation results')
    .version('1.0.0')
    .argument('[input-file]', 'Validation results JSON file')
    .option('-o, --output <file>', 'Save enhanced schemas to file')
    .option('-f, --format <format>', 'Output format: json, html, or both', 'json')
    .option('--use-page-data', 'Fetch fresh data from pages instead of using validation results')
    .option('--single-url <url>', 'Enhance schema for a single URL (skips input file)')
    .parse(process.argv);
  
  const options = program.opts();
  const inputFile = program.args[0];
  
  try {
    let enhancedResults;
    
    if (options.singleUrl) {
      console.log(`\n🔧 Enhancing schema for: ${options.singleUrl}`);
      enhancedResults = [await enhanceSchemaFromPage(options.singleUrl)];
    } else if (!inputFile) {
      program.help();
      process.exit(1);
    } else {
      enhancedResults = await processValidationResults(inputFile, options);
    }
    
    // Format output
    const format = options.format.toLowerCase();
    let output;
    
    if (format === 'html' || format === 'both') {
      // Generate HTML script tags for each URL
      const htmlOutput = enhancedResults.map(result => {
        if (result.enhancedSchemas.length === 0) {
          return `<!-- No schema to enhance for ${result.url} -->`;
        }
        
        let html = `<!-- Enhanced schema for: ${result.url} -->\n`;
        html += formatAsHTMLScriptTags(result.enhancedSchemas);
        html += '\n';
        return html;
      }).join('\n\n');
      
      if (format === 'html') {
        output = htmlOutput;
      } else {
        // Both formats - save separately
        const jsonOutput = JSON.stringify(enhancedResults, null, 2);
        console.log('\n📄 JSON Output:');
        console.log(jsonOutput);
        
        if (options.output) {
          const htmlFile = options.output.replace(/\.json$/, '.html');
          await fs.writeFile(options.output, jsonOutput, 'utf-8');
          await fs.writeFile(htmlFile, htmlOutput, 'utf-8');
          console.log(`\n✓ Saved JSON to: ${options.output}`);
          console.log(`✓ Saved HTML to: ${htmlFile}`);
        } else {
          console.log('\n📄 HTML Output:');
          console.log(htmlOutput);
        }
        return;
      }
    } else {
      // JSON format
      output = JSON.stringify(enhancedResults, null, 2);
    }
    
    // Display output
    console.log('\n📄 Enhanced Schemas:');
    console.log(output);
    
    // Save to file if requested
    if (options.output) {
      await fs.writeFile(options.output, output, 'utf-8');
      console.log(`\n✓ Saved to: ${options.output}`);
    }
    
    // Summary
    const totalSchemas = enhancedResults.reduce((sum, r) => sum + r.enhancedSchemas.length, 0);
    const totalAddedFields = enhancedResults.reduce((sum, r) => sum + r.addedFields.length, 0);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`SUMMARY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`URLs processed: ${enhancedResults.length}`);
    console.log(`Enhanced schemas generated: ${totalSchemas}`);
    console.log(`Fields added: ${totalAddedFields}`);
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
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

module.exports = {
  enhanceSchema,
  enhanceSchemaFromPage,
  enhanceSchemasFromResults,
  formatAsHTMLScriptTags
};

