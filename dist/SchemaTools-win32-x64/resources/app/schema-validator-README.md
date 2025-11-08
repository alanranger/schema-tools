# Schema Validator Agent

Automated tool to validate schema markup on live URLs against:
- **Schema.org Validator** (https://validator.schema.org)
- **Google Rich Results Test** (https://search.google.com/test/rich-results)

## Features

- ✅ Fetches and parses live pages to extract schema markup
- ✅ Automatically tests against Schema.org validator
- ✅ Automatically tests against Google Rich Results Test
- ✅ Supports single URL or batch processing
- ✅ JSON output option for integration with other tools
- ✅ Detailed error and warning reporting
- ✅ Detects JSON-LD, Microdata, and schema types

## Installation

1. Install Node.js (v14 or higher)

2. Install dependencies:
```bash
npm install
```

This will install:
- `puppeteer` - For browser automation
- `commander` - For CLI argument parsing

## Usage

### Single URL Validation

```bash
node scripts/schema-validator.js https://example.com/page
```

### Batch Processing

Create a text file with URLs (one per line):
```
https://example.com/product1
https://example.com/product2
https://example.com/event1
```

Then run:
```bash
node scripts/schema-validator.js --batch urls.txt
```

### JSON Output

```bash
node scripts/schema-validator.js https://example.com/page --json
```

### Save Results to File

```bash
node scripts/schema-validator.js https://example.com/page --json --output results.json
```

### Options

- `-b, --batch <file>` - Process multiple URLs from a text file
- `-j, --json` - Output results as JSON
- `-o, --output <file>` - Save results to a file
- `--schema-org-only` - Only test against Schema.org validator
- `--google-only` - Only test against Google Rich Results Test
- `--timeout <ms>` - Timeout for page loads (default: 30000ms)

## Example Output

```
🔍 Analyzing: https://example.com/product

   ✓ Found 2 JSON-LD script(s)
   ✓ Microdata detected

📋 Testing against Schema.org validator...
   ✓ Schema.org: VALID

🔎 Testing against Google Rich Results Test...
   ✓ Google: ELIGIBLE

============================================================
VALIDATION RESULTS
============================================================
URL: https://example.com/product
Timestamp: 2024-01-15T10:30:00.000Z

PAGE ANALYSIS:
  Schema Found: Yes
  JSON-LD Scripts: 2
  Microdata: Yes

Schema.org:
  Status: ✓ VALID

Google Rich Results Test:
  Status: ✓ VALID
  Rich Results Detected: Product, AggregateRating
```

## JSON Output Format

```json
[
  {
    "url": "https://example.com/page",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "pageAnalysis": {
      "url": "https://example.com/page",
      "jsonLd": [...],
      "microdata": true,
      "htmlLength": 45678,
      "schemaFound": true
    },
    "validations": [
      {
        "validator": "Schema.org",
        "url": "https://validator.schema.org/#url=...",
        "valid": true,
        "errors": [],
        "warnings": [],
        "schemasFound": ["Product", "Review"]
      },
      {
        "validator": "Google Rich Results Test",
        "url": "https://search.google.com/test/rich-results",
        "valid": true,
        "errors": [],
        "warnings": [],
        "richResults": ["Product"],
        "eligible": true
      }
    ]
  }
]
```

## Integration with Existing Tools

The validator can be integrated with the unified schema generator (`html - tools/unified-schema-generator.html`). After generating schema and deploying it to your Squarespace pages, use this tool to validate:

```bash
# Validate a single product page
node scripts/schema-validator.js https://www.alanranger.com/shop/product-name

# Validate multiple event pages
node scripts/schema-validator.js --batch event-urls.txt --json --output validation-results.json
```

## Troubleshooting

### Timeout Errors

If pages take too long to load, increase the timeout:
```bash
node scripts/schema-validator.js https://example.com --timeout 60000
```

### Google Rich Results Test Automation Fails

Google's Rich Results Test may change its UI structure. If automation fails, the tool will provide a manual URL for testing. You can also use the `--schema-org-only` flag to skip Google validation.

### Browser Launch Issues

If Puppeteer fails to launch Chrome/Chromium:
- Ensure you have Chrome/Chromium installed
- Try running with `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false npm install`
- On Linux, you may need additional dependencies: `sudo apt-get install -y chromium-browser`

## Notes

- The tool uses headless browser automation, so it may take 10-30 seconds per URL
- Google Rich Results Test automation relies on UI structure and may break if Google updates their interface
- Schema.org validator automation is more reliable as it uses URL parameters
- For batch processing, the tool processes URLs sequentially to avoid overwhelming the validators

## Workflow Integration

1. Generate schema using `unified-schema-generator.html`
2. Deploy schema to Squarespace pages
3. Validate deployed pages using this tool:
   ```bash
   node scripts/schema-validator.js https://www.alanranger.com/shop/product-name
   ```
4. Review errors and fix schema issues
5. Re-validate until all tests pass

