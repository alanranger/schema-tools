# Schema Tools

This repository contains tools to generate JSON-LD schema markup for **products** and **events**, tailored for use with Squarespace websites.

## Tools Included

### 1. `product-schema-generator-v4-alanranger-WORKFLOW-UPDATED.html`
- Generates Google-compliant Product schema blocks.
- Supports review aggregation and filtering (excludes reviews below 4 stars).
- Injects dynamic fields from product CSV exports (e.g., name, price, URL, availability).
- Optionally includes review metadata (rating count, average rating).
- Workflow guide included in the HTML UI.

### 2. `event-schema-generator-v3-FINAL-address-fixed.html`
- Generates Event and ItemList schema blocks for photography workshops.
- Accepts structured CSV files for batch generation.
- Injects performer, organizer, address, validFrom, and location fields.
- Fully structured schema output compliant with Google's Rich Results.

### 3. `unified-schema-generator.html`
- Combines both tools into one UI with three tabs:
  - **Event Schema**: Generate Event and ItemList schema blocks from CSV
  - **Product Schema**: Generate Product schema blocks with review support
  - **Schema Validator**: Validate and enhance schemas from live URLs (NEW!)
- Designed for future expansion with automatic validation and page scanning.
- Includes built-in schema validation and enhancement capabilities.

### 4. `schema-validator.js` (Schema Validator Agent)
- Automated CLI tool to validate schema markup on live URLs.
- Tests against Schema.org validator and Google Rich Results Test.
- Supports single URL or batch processing.
- Provides detailed validation reports with errors and warnings.
- See `schema-validator-README.md` for full documentation.

### 5. `csv-schema-validator.js` (Bulk Schema Validator)
- Accepts CSV files with URLs for bulk validation.
- For each URL, checks:
  - Whether schema markup exists
  - Schema types present (Product, Event, etc.)
  - Missing required and recommended fields
  - Overall validity status
- Generates validator links for Schema.org and Google Rich Results Test.
- Outputs readable JSON or text summary with pass/fail/warnings.
- See "Bulk Schema Validation" section below for usage.

### 6. `schema-enhancer.js` (Schema Enhancement Agent)
- Takes validation results and generates enhanced schema blocks.
- Automatically fills missing required and recommended fields.
- Provides placeholders for fields that need manual input.
- Supports export in JSON or HTML script tag format.
- Can enhance schemas from validation results or fetch fresh from pages.
- See "Schema Enhancement" section below for usage.

## Input Files

- CSV exports from Squarespace (Products & Services panel).
- Review export files from Trustpilot or Squarespace (where available).
- Cleaned and pre-processed versions must match expected schema field mappings.

## Folder Structure

```
schema-tools/
│
├── html-tools/                  # Contains HTML tools
│   ├── product-schema-generator-v4-alanranger-WORKFLOW-UPDATED.html
│   ├── event-schema-generator-v3-FINAL-address-fixed.html
│   └── unified_schema_generator.html
│
├── inputs-csv-files/           # Source CSVs for schema generation
│
├── js/                         # Review JS files for widget rendering (optional)
│
├── readme-and-docs/
│   ├── README.md               # This file
│   └── handover-cursor-ai.md   # Detailed onboarding notes
```

## Workflow Summary

1. Export product list from Squarespace to CSV (`products_*.csv`).
2. Clean fields manually or use future cleanup tool (in development).
3. Merge with review dataset (if reviews available).
4. Load HTML schema generator.
5. Select or paste the CSV file.
6. Generate JSON-LD.
7. Paste each block into the corresponding Squarespace product or event page (not all in one).

## Unified Schema Generator (Browser Tool)

The `unified-schema-generator.html` tool provides three tabs in one interface:

### Event Schema Tab
- Upload CSV file with event data
- Filter by category
- Generate Event + ItemList schema blocks
- Copy to clipboard for Squarespace deployment

### Product Schema Tab
- Upload CSV file with product data
- Automatically filter reviews (4+ stars only)
- Generate Product schema blocks with reviews
- Copy to clipboard for Squarespace deployment

### Schema Validator Tab (NEW!)
- **Single URL Validation**: Quick validation for individual pages
  - Enter a URL and click "Run Validation"
  - Opens both Schema.org and Google Rich Results validators in new tabs
  - Perfect for quick checks before deploying schema
  
- **Batch CSV Validation**: Validate multiple URLs at once
  - Upload CSV file with page URLs
  - Automatically validates each URL:
    - Checks for schema markup presence
    - Identifies schema types (Product, Event, etc.)
    - Detects missing required and recommended fields
    - Shows validation status (✅ Valid / ⚠️ Issues / ❌ No Schema)
  - Generate enhanced schemas with missing fields filled
  - Download enhanced schemas as JSON and HTML files
  - Works entirely in browser (no server required)

**Usage:**
1. Open `unified-schema-generator.html` in your browser
2. Switch to the "Schema Validator" tab
3. **For single URL validation:**
   - Enter a URL in the "Validate a Single URL" field
   - Click "Run Validation" to open both validators in new tabs
4. **For batch validation:**
   - Click "Download Template CSV" to get a sample CSV file with the correct format
   - Fill in your URLs in the CSV file
   - Upload the CSV file
   - Click "Validate URLs" to start processing
   - Review results in the table
   - Click "Generate Enhanced" button for any URL to download improved schema (JSON and HTML formats)
   - Use "Schema.org" and "Google" buttons in the Actions column to manually validate specific URLs

**CSV Format for Validator:**
```csv
URL,Page Name,Category
https://www.example.com/product-1,Product One,Products
https://www.example.com/product-2,Product Two,Products
```

**Features (v1.2.1):**
- ✅ Single URL validation with one-click access to both validators
- ✅ Real-time progress indicator during batch validation
- ✅ Template CSV download for easy setup
- ✅ Enhanced schema generation with multiple schema support (@graph structure)
- ✅ Downloads both JSON and HTML script tag formats
- ✅ Improved table UI with status badges and validator links
- ✅ Better error handling and processing status display
- ✅ Collapsible help section explaining validators
- ✅ Validator links in results table for quick manual validation

## Schema Validation

After deploying schema to your Squarespace pages, use the Schema Validator Agent to automatically test:

### Single URL Validation

```bash
# Install dependencies (first time only)
npm install

# Validate a single URL
node scripts/schema-validator.js https://www.alanranger.com/shop/product-name

# Validate multiple URLs from text file
node scripts/schema-validator.js --batch urls.txt --json --output results.json
```

### Bulk CSV Validation

Validate multiple URLs from a CSV file:

```bash
# CSV file must have a column named: URL, Link, or Website
node scripts/csv-schema-validator.js urls.csv

# Save results to JSON file
node scripts/csv-schema-validator.js urls.csv --output results.json

# Output as JSON
node scripts/csv-schema-validator.js urls.csv --json

# Skip validator checks (faster, just analyzes schema markup)
node scripts/csv-schema-validator.js urls.csv --skip-validators
```

**CSV Format Example:**
```csv
URL,Product Name,Category
https://www.example.com/product-1,Product One,Workshops
https://www.example.com/product-2,Product Two,Gear
```

The bulk validator checks:
- ✅ Schema markup presence
- ✅ Schema types (Product, Event, etc.)
- ✅ Missing required fields
- ✅ Missing recommended fields
- ✅ Generates validator links for manual testing

**Output Format:**
```json
[
  {
    "url": "https://www.example.com/product-123",
    "schemaType": "Product",
    "valid": true,
    "missingFields": [],
    "warnings": ["Missing recommended field: brand"],
    "validatorLinks": {
      "schema": "https://validator.schema.org/#url=...",
      "google": "https://search.google.com/test/rich-results?url=..."
    }
  }
]
```

The validator automatically tests against:
- https://validator.schema.org
- https://search.google.com/test/rich-results

### Schema Enhancement

After validation, use the Schema Enhancement Agent to generate improved schema blocks with missing fields filled:

```bash
# Enhance schemas from validation results
node scripts/schema-enhancer.js validation-results.json

# Save enhanced schemas to file
node scripts/schema-enhancer.js validation-results.json --output enhanced-schemas.json

# Export as HTML script tags (ready to paste into Squarespace)
node scripts/schema-enhancer.js validation-results.json --format html --output enhanced.html

# Enhance a single URL (fetches fresh data from page)
node scripts/schema-enhancer.js --single-url https://www.alanranger.com/shop/product-name

# Fetch fresh data from pages instead of using validation results
node scripts/schema-enhancer.js validation-results.json --use-page-data
```

**Complete Workflow:**

```bash
# Step 1: Validate URLs
node scripts/csv-schema-validator.js urls.csv --output validation-results.json

# Step 2: Enhance schemas based on validation results
node scripts/schema-enhancer.js validation-results.json --format html --output enhanced-schemas.html

# Step 3: Review enhanced schemas and replace placeholders
# Step 4: Copy HTML script tags and paste into Squarespace pages
```

**Enhancement Features:**
- ✅ Fills missing required fields with placeholders or inferred values
- ✅ Adds recommended fields where defaults exist (e.g., Event organizer, Product brand)
- ✅ Infers values from page URL when possible
- ✅ Preserves existing schema structure
- ✅ Tracks what fields were added
- ✅ Outputs ready-to-use HTML script tags

**Output Example:**
```json
[
  {
    "url": "https://www.example.com/product",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "enhancedSchemas": [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "[REPLACE WITH PRODUCT NAME]",
        "url": "https://www.example.com/product",
        "brand": {
          "@type": "Brand",
          "name": "[REPLACE WITH BRAND NAME]"
        },
        "offers": {
          "@type": "Offer",
          "price": "[REPLACE WITH PRICE]",
          "priceCurrency": "GBP",
          "availability": "https://schema.org/InStock",
          "url": "https://www.example.com/product"
        }
      }
    ],
    "addedFields": ["brand", "offers", "description"],
    "notes": []
  }
]
```

## Notes

- You must not inject multiple schema blocks on unrelated pages. Only paste the matching product's schema on its correct Squarespace page.
- Always validate your schema after deployment using the Schema Validator Agent or manually:
  - https://validator.schema.org
  - https://search.google.com/test/rich-results

---